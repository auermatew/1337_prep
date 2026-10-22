import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Subscription } from 'rxjs';
import { TaskEventsListener } from './task-events.listener.js';
import { TaskChange } from './task.types.js';
import { TasksQuery } from './tasks.query.js';

const DEFAULT_KEEPALIVE_MS = 15000;
/** Live changes that may wait in one subscriber's queue (replay is exempt). */
export const MAX_QUEUED_LIVE = 1000;

interface Frame {
  text: string;
  live: boolean;
}

interface Subscriber {
  res: Response;
  /** Highest event id queued so far; ids are queued strictly increasing. */
  lastQueuedId: number;
  closed: boolean;
  subscription: Subscription | null;
  keepAlive: NodeJS.Timeout | null;
  /** Live changes held back until the replay has been queued; null after. */
  buffer: TaskChange[] | null;
  /** The one ordered outbound queue: replay, then buffered, then live. */
  queue: Frame[];
  liveQueued: number;
  writing: boolean;
}

function keepAliveMs(): number {
  const n = Number(process.env.STREAM_KEEPALIVE_MS);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_KEEPALIVE_MS;
}

@Injectable()
export class TaskStreamService implements OnModuleDestroy {
  private readonly logger = new Logger(TaskStreamService.name);
  private readonly subscribers = new Set<Subscriber>();
  private destroyed = false;

  constructor(
    private readonly listener: TaskEventsListener,
    private readonly query: TasksQuery,
  ) {}

  subscriberCount(): number {
    return this.subscribers.size;
  }

  attach(req: Request, res: Response, resumeAfter: number | null): void {
    if (this.destroyed) {
      // Shutting down: nobody would end this stream, and it would keep the
      // HTTP server from closing.
      res.status(503).set('Retry-After', '1').end();
      return;
    }
    // 'close' has already fired; nothing would ever dispose a subscriber.
    if (res.destroyed || req.socket?.destroyed) return;

    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const sub: Subscriber = {
      res,
      lastQueuedId: resumeAfter ?? 0,
      closed: false,
      subscription: null,
      keepAlive: null,
      buffer: [],
      queue: [],
      liveQueued: 0,
      writing: false,
    };
    this.subscribers.add(sub);
    this.logger.log(`stream subscribers: ${this.subscribers.size}`);

    sub.keepAlive = setInterval(() => {
      if (this.writable(sub)) res.write(': ping\n\n');
    }, keepAliveMs());

    // Live changes are held back until the replay has been queued.
    sub.subscription = this.listener.changes$.subscribe({
      next: (change) => {
        if (sub.closed) return;
        if (!sub.buffer) return this.enqueue(sub, change, true);
        if (sub.buffer.length >= MAX_QUEUED_LIVE) return this.overflow(sub);
        sub.buffer.push(change);
      },
    });
    const onClose = () => this.dispose(sub);
    res.once('close', onClose);
    req.once('close', onClose);

    void (async () => {
      if (resumeAfter !== null) {
        const replay = await this.query.replay(resumeAfter);
        // A bogus resume point (beyond the newest event) is dropped, not used
        // as a dedupe threshold.
        if (replay.resume === null) sub.lastQueuedId = 0;
        for (const change of replay.changes) this.enqueue(sub, change, false);
      }
      // Queue the held-back live changes right behind the replay, in the same
      // tick, so no live change can slip in between.
      const pending = sub.buffer ?? [];
      sub.buffer = null;
      for (const change of pending) this.enqueue(sub, change, true);
    })().catch((err: Error) => {
      this.logger.error(`stream setup failed: ${err.message}`);
      this.dispose(sub);
      if (!res.writableEnded) res.end();
    });
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    // The HTTP server's close waits for open connections, so end them all.
    for (const sub of this.subscribers) {
      this.dispose(sub);
      if (!sub.res.writableEnded) sub.res.end();
    }
  }

  private writable(sub: Subscriber): boolean {
    return !sub.closed && !sub.res.writableEnded && !sub.res.destroyed;
  }

  /** Queues one change unless it is a duplicate or the stream is gone. */
  private enqueue(sub: Subscriber, change: TaskChange, live: boolean): void {
    if (sub.closed || change.event.id <= sub.lastQueuedId) return;
    if (live && sub.liveQueued >= MAX_QUEUED_LIVE) return this.overflow(sub);
    sub.lastQueuedId = change.event.id;
    sub.queue.push({
      text: `id: ${change.event.id}\nevent: task\ndata: ${JSON.stringify(change)}\n\n`,
      live,
    });
    if (live) sub.liveQueued++;
    this.pump(sub);
  }

  /** Starts the single writer for this subscriber unless it is running. */
  private pump(sub: Subscriber): void {
    if (sub.writing) return;
    sub.writing = true;
    this.writeQueue(sub).catch((err: Error) => {
      this.logger.error(`stream write failed: ${err.message}`);
      this.dispose(sub);
      if (!sub.res.writableEnded) sub.res.end();
    });
  }

  private async writeQueue(sub: Subscriber): Promise<void> {
    try {
      while (sub.queue.length > 0 && this.writable(sub)) {
        const frame = sub.queue.shift() as Frame;
        if (frame.live) sub.liveQueued--;
        if (!sub.res.write(frame.text)) await this.drained(sub);
      }
    } finally {
      // Cleared in the same tick the loop exits, so a change queued right
      // after cannot see a writer that is about to stop.
      sub.writing = false;
    }
  }

  /** Resolves on 'drain', or on 'close' so a vanished client frees the writer. */
  private drained(sub: Subscriber): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        sub.res.off('drain', done);
        sub.res.off('close', done);
        resolve();
      };
      sub.res.once('drain', done);
      sub.res.once('close', done);
    });
  }

  /**
   * A client too slow to keep up: drop it; it resumes via Last-Event-ID.
   * Destroyed rather than ended, since a graceful end would wait behind the
   * data its socket is not draining.
   */
  private overflow(sub: Subscriber): void {
    this.logger.warn(
      `stream overflow: more than ${MAX_QUEUED_LIVE} live changes queued; ending stream`,
    );
    this.dispose(sub);
    sub.res.destroy();
  }

  private dispose(sub: Subscriber): void {
    if (sub.closed) return;
    sub.closed = true;
    sub.subscription?.unsubscribe();
    if (sub.keepAlive) clearInterval(sub.keepAlive);
    sub.buffer = null;
    // Free the held frames; the writer sees `closed` and stops.
    sub.queue.length = 0;
    sub.liveQueued = 0;
    this.subscribers.delete(sub);
    this.logger.log(`stream subscribers: ${this.subscribers.size}`);
  }
}
