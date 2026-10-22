import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Subscription } from 'rxjs';
import { TaskEventsListener } from './task-events.listener.js';
import { TaskChange } from './task.types.js';
import { TasksQuery } from './tasks.query.js';

interface Subscriber {
  res: Response;
  lastSentId: number;
  closed: boolean;
  subscription: Subscription | null;
  keepAlive: NodeJS.Timeout | null;
}

@Injectable()
export class TaskStreamService implements OnModuleDestroy {
  private readonly logger = new Logger(TaskStreamService.name);
  private readonly subscribers = new Set<Subscriber>();

  constructor(
    private readonly listener: TaskEventsListener,
    private readonly query: TasksQuery,
  ) {}

  subscriberCount(): number {
    return this.subscribers.size;
  }

  attach(req: Request, res: Response, resumeAfter: number | null): void {
    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const sub: Subscriber = {
      res,
      lastSentId: resumeAfter ?? 0,
      closed: false,
      subscription: null,
      keepAlive: null,
    };
    this.subscribers.add(sub);
    this.logger.log(`stream subscribers: ${this.subscribers.size}`);

    const keepAliveMs = Number(process.env.STREAM_KEEPALIVE_MS) || 15000;
    sub.keepAlive = setInterval(() => {
      if (this.writable(sub)) res.write(': ping\n\n');
    }, keepAliveMs);

    // Live changes are buffered until the replay has been sent.
    let buffer: TaskChange[] | null = [];
    sub.subscription = this.listener.changes$.subscribe({
      next: (change) => {
        if (buffer) buffer.push(change);
        else this.send(sub, change);
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
        if (replay.resume === null) sub.lastSentId = 0;
        for (const change of replay.changes) {
          if (!(await this.send(sub, change))) return;
        }
      }
      const pending = buffer ?? [];
      buffer = null;
      for (const change of pending) {
        if (!(await this.send(sub, change))) return;
      }
    })().catch((err: Error) => {
      this.logger.error(`stream setup failed: ${err.message}`);
      this.dispose(sub);
      if (!res.writableEnded) res.end();
    });
  }

  onModuleDestroy(): void {
    // The HTTP server's close waits for open connections, so end them all.
    for (const sub of this.subscribers) {
      this.dispose(sub);
      if (!sub.res.writableEnded) sub.res.end();
    }
  }

  private writable(sub: Subscriber): boolean {
    return !sub.closed && !sub.res.writableEnded && !sub.res.destroyed;
  }

  /**
   * Writes one change unless it was already sent or the stream is gone.
   * Resolves false when the stream is gone; waits out backpressure so a
   * disconnect during a long replay stops it.
   */
  private send(
    sub: Subscriber,
    change: TaskChange,
  ): Promise<boolean> | boolean {
    if (!this.writable(sub)) return false;
    if (change.event.id <= sub.lastSentId) return true;
    sub.lastSentId = change.event.id;
    const ok = sub.res.write(
      `id: ${change.event.id}\nevent: task\ndata: ${JSON.stringify(change)}\n\n`,
    );
    if (ok) return true;
    return new Promise<boolean>((resolve) => {
      const done = () => {
        sub.res.off('drain', done);
        sub.res.off('close', done);
        resolve(this.writable(sub));
      };
      sub.res.once('drain', done);
      sub.res.once('close', done);
    });
  }

  private dispose(sub: Subscriber): void {
    if (sub.closed) return;
    sub.closed = true;
    sub.subscription?.unsubscribe();
    if (sub.keepAlive) clearInterval(sub.keepAlive);
    this.subscribers.delete(sub);
    this.logger.log(`stream subscribers: ${this.subscribers.size}`);
  }
}
