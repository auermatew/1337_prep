import http from 'node:http';
import { INestApplication, Logger } from '@nestjs/common';
import type { Subject } from 'rxjs';
import { vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TaskEventsListener } from '../src/tasks/task-events.listener.js';
import { TasksQuery } from '../src/tasks/tasks.query.js';
import {
  MAX_QUEUED_LIVE,
  TaskStreamService,
} from '../src/tasks/task-stream.service.js';
import { TaskDto, TaskEventDto } from '../src/tasks/task.types.js';
import { createApp } from './helpers/app.js';
import { resetDb } from './helpers/db.js';
import { openStream, SseStream } from './helpers/sse.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Pressure = 'ok' | 'drain' | 'stall';

interface WriteSpy {
  /** Responses that received a task frame. */
  reses: Set<http.ServerResponse>;
  taskWrites: number;
  writesAfterEnd: number;
}

/**
 * Wraps ServerResponse.write. `decide` is asked for every task frame: 'ok'
 * behaves normally, 'drain' reports backpressure and emits 'drain' a little
 * later (what a real socket does), 'stall' reports backpressure and never
 * drains. The frame itself is always really written.
 */
function spyWrites(
  decide: (taskWriteNo: number) => Pressure,
  drainMs = 5,
): WriteSpy {
  const spy: WriteSpy = {
    reses: new Set(),
    taskWrites: 0,
    writesAfterEnd: 0,
  };
  const realWrite = http.ServerResponse.prototype.write as (
    ...a: unknown[]
  ) => boolean;
  vi.spyOn(http.ServerResponse.prototype, 'write').mockImplementation(function (
    this: http.ServerResponse,
    ...args: unknown[]
  ) {
    if (this.destroyed || this.writableEnded) spy.writesAfterEnd++;
    const ok = realWrite.apply(this, args);
    if (typeof args[0] !== 'string' || !args[0].includes('event: task')) {
      return ok;
    }
    spy.reses.add(this);
    const pressure = decide(++spy.taskWrites);
    if (pressure === 'ok') return ok;
    if (pressure === 'drain') {
      // A socket that has gone away never drains.
      setTimeout(() => {
        if (!this.destroyed) this.emit('drain');
      }, drainMs);
    }
    return false;
  } as typeof http.ServerResponse.prototype.write);
  return spy;
}

describe('Task SSE stream (e2e)', () => {
  const apps: INestApplication[] = [];
  const streams: SseStream[] = [];
  const unhandled: unknown[] = [];
  const onUnhandled = (e: unknown) => unhandled.push(e);
  let db: PrismaService;
  const savedKeepAlive = process.env.STREAM_KEEPALIVE_MS;

  beforeAll(async () => {
    db = new PrismaService();
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await resetDb(db);
    unhandled.length = 0;
    process.on('unhandledRejection', onUnhandled);
    process.on('uncaughtException', onUnhandled);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.off('unhandledRejection', onUnhandled);
    process.off('uncaughtException', onUnhandled);
    if (savedKeepAlive === undefined) delete process.env.STREAM_KEEPALIVE_MS;
    else process.env.STREAM_KEEPALIVE_MS = savedKeepAlive;
    const errors: unknown[] = [];
    for (const s of streams.splice(0)) {
      try {
        s.close();
      } catch (e) {
        errors.push(e);
      }
    }
    for (const app of apps.splice(0)) {
      try {
        await app.close();
      } catch (e) {
        errors.push(e);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'teardown failed');
  });

  async function start(): Promise<{ app: INestApplication; url: string }> {
    const created = await createApp();
    apps.push(created.app);
    return created;
  }

  async function open(
    url: string,
    query = '',
    headers: Record<string, string> = {},
  ): Promise<SseStream> {
    const s = await openStream(`${url}/api/tasks/stream${query}`, headers);
    streams.push(s);
    return s;
  }

  async function create(
    url: string,
    name: string,
    durationSeconds = 3600,
  ): Promise<TaskDto> {
    const res = await fetch(`${url}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, durationSeconds }),
    });
    expect(res.status).toBe(201);
    return (await res.json()) as TaskDto;
  }

  async function firstEventId(url: string, task: TaskDto): Promise<number> {
    const res = await fetch(`${url}/api/tasks/${task.id}/events`);
    return ((await res.json()) as TaskEventDto[])[0].id;
  }

  const ids = (s: SseStream) => s.messages.map((m) => m.id);
  const strictlyIncreasing = (a: number[]) =>
    a.every((v, i) => i === 0 || v > a[i - 1]);

  it('streams running then finished for a task created after connecting', async () => {
    const { url } = await start();
    const s = await open(url);
    expect(s.status).toBe(200);
    expect(s.headers['content-type']).toContain('text/event-stream');
    expect(s.headers['cache-control']).toBe('no-cache');
    expect(s.headers['x-accel-buffering']).toBe('no');
    const task = await create(url, 'live', 1);
    const mine = () => s.messages.filter((m) => m.data.task.id === task.id);
    await s.waitFor(() => mine().length >= 2, 6000);
    expect(mine().map((m) => m.data.event.state)).toEqual([
      'running',
      'finished',
    ]);
    for (const m of mine()) {
      expect(m.event).toBe('task');
      expect(typeof m.id).toBe('number');
      expect(m.id).toBe(m.data.event.id);
    }
  });

  it('sends keep-alive pings and no task messages without changes', async () => {
    process.env.STREAM_KEEPALIVE_MS = '200';
    const { url } = await start();
    const s = await open(url);
    await sleep(500);
    expect(
      s.comments.filter((c) => c === 'ping').length,
    ).toBeGreaterThanOrEqual(1);
    expect(s.messages).toEqual([]);
  });

  it('replays events after Last-Event-ID, then goes live without duplicates', async () => {
    const { url } = await start();
    const t1 = await create(url, 'a');
    const t2 = await create(url, 'b');
    const t3 = await create(url, 'c');
    const first = await firstEventId(url, t1);
    const s = await open(url, '', { 'Last-Event-ID': String(first) });
    await s.waitFor(() => s.messages.length >= 2);
    expect(s.messages.map((m) => m.data.task.id)).toEqual([t2.id, t3.id]);
    const t4 = await create(url, 'd');
    await s.waitFor(() => s.messages.length >= 3);
    await sleep(150);
    expect(s.messages.map((m) => m.data.task.id)).toEqual([
      t2.id,
      t3.id,
      t4.id,
    ]);
    expect(ids(s)).toEqual([first + 1, first + 2, first + 3]);
  });

  it('replays by ?after=, and the header wins when both are given', async () => {
    const { url } = await start();
    const t1 = await create(url, 'a');
    const t2 = await create(url, 'b');
    const t3 = await create(url, 'c');
    const first = await firstEventId(url, t1);

    const byQuery = await open(url, `?after=${first}`);
    await byQuery.waitFor(() => byQuery.messages.length >= 2);
    expect(byQuery.messages.map((m) => m.data.task.id)).toEqual([t2.id, t3.id]);

    // header = first+1 (1 later event), query = first (2 later events)
    const both = await open(url, `?after=${first}`, {
      'Last-Event-ID': String(first + 1),
    });
    await both.waitFor(() => both.messages.length >= 1);
    await sleep(150);
    expect(both.messages.map((m) => m.data.task.id)).toEqual([t3.id]);
  });

  it('falls back to ?after= when the Last-Event-ID header is invalid', async () => {
    const { url } = await start();
    const t1 = await create(url, 'a');
    const t2 = await create(url, 'b');
    const first = await firstEventId(url, t1);
    const s = await open(url, `?after=${first}`, { 'Last-Event-ID': 'abc' });
    await s.waitFor(() => s.messages.length >= 1);
    await sleep(150);
    expect(s.messages.map((m) => m.data.task.id)).toEqual([t2.id]);
  });

  it('delivers every id exactly once when replay races live creation', async () => {
    const { url } = await start();
    const seeded: TaskDto[] = [];
    for (let i = 0; i < 5; i++) seeded.push(await create(url, `seed${i}`));
    const s = await open(url, '?after=0');
    const created = await Promise.all(
      Array.from({ length: 20 }, (_, i) => create(url, `race${i}`)),
    );
    const want = new Set([...seeded, ...created].map((t) => t.id));
    await s.waitFor(
      () => new Set(s.messages.map((m) => m.data.task.id)).size >= want.size,
    );
    await sleep(200);
    expect(s.messages).toHaveLength(25);
    expect(strictlyIncreasing(ids(s))).toBe(true);
    expect(new Set(s.messages.map((m) => m.data.task.id))).toEqual(want);
  });

  it('delivers a task created on one app to a stream on another', async () => {
    const a = await start();
    const b = await start();
    const s = await open(b.url);
    const task = await create(a.url, 'cross');
    await s.waitFor(() => s.messages.some((m) => m.data.task.id === task.id));
  });

  it('gives 8 clients the same id list', async () => {
    const { url } = await start();
    const clients = await Promise.all(
      Array.from({ length: 8 }, () => open(url)),
    );
    const tasks: TaskDto[] = [];
    for (let i = 0; i < 4; i++) tasks.push(await create(url, `m${i}`));
    await Promise.all(
      clients.map((c) => c.waitFor(() => c.messages.length >= 4)),
    );
    await sleep(100);
    const first = ids(clients[0]);
    expect(first).toHaveLength(4);
    for (const c of clients) expect(ids(c)).toEqual(first);
  });

  it('returns subscriberCount to 0 after 10 streams open and close', async () => {
    const { app, url } = await start();
    const svc = app.get(TaskStreamService);
    // The listener's feed gets one observer per open stream, and loses it on close.
    const feed = (
      app.get(TaskEventsListener) as unknown as { subject: Subject<unknown> }
    ).subject;
    const baseline = feed.observers.length;
    const opened = await Promise.all(
      Array.from({ length: 10 }, () => open(url)),
    );
    expect(svc.subscriberCount()).toBe(10);
    expect(feed.observers.length - baseline).toBe(10);
    for (const s of opened) s.close();
    const deadline = Date.now() + 5000;
    while (svc.subscriberCount() > 0 && Date.now() < deadline) await sleep(10);
    expect(svc.subscriberCount()).toBe(0);
    expect(feed.observers).toHaveLength(baseline);
  });

  it('clears each stream keep-alive timer on disconnect and on shutdown', async () => {
    process.env.STREAM_KEEPALIVE_MS = '54321';
    const timers: { _destroyed?: boolean }[] = [];
    const realSetInterval = global.setInterval;
    vi.spyOn(global, 'setInterval').mockImplementation(((
      fn: () => void,
      ms?: number,
    ) => {
      const t = realSetInterval(fn, ms);
      if (ms === 54321) timers.push(t as unknown as { _destroyed?: boolean });
      return t;
    }) as typeof setInterval);
    const { app, url } = await start();
    const a = await open(url);
    await open(url);
    expect(timers).toHaveLength(2);
    expect(timers.map((t) => t._destroyed)).toEqual([false, false]);
    a.close();
    const deadline = Date.now() + 5000;
    while (!timers[0]._destroyed && Date.now() < deadline) await sleep(10);
    expect(timers.map((t) => t._destroyed)).toEqual([true, false]);
    await app.close();
    expect(timers.map((t) => t._destroyed)).toEqual([true, true]);
  });

  it('does not duplicate or reorder events that arrive live while the replay is being read', async () => {
    const { app, url } = await start();
    const first = await create(url, 'before');
    const firstId = await firstEventId(url, first);
    // Hold the replay read back so the new tasks reach the buffer first and
    // are then also contained in the replay snapshot.
    const query = app.get(TasksQuery);
    const real = query.replay.bind(query);
    vi.spyOn(query, 'replay').mockImplementation(async (after) => {
      await sleep(400);
      return real(after);
    });
    const s = await open(url, `?after=${firstId - 1}`);
    const t2 = await create(url, 'during1');
    const t3 = await create(url, 'during2');
    await s.waitFor(() => s.messages.length >= 3);
    await sleep(200);
    expect(s.messages.map((m) => m.data.task.id)).toEqual([
      first.id,
      t2.id,
      t3.id,
    ]);
    expect(strictlyIncreasing(ids(s))).toBe(true);
  });

  describe.each([
    ['an invalid Last-Event-ID header', '', { 'Last-Event-ID': 'abc' }],
    ['a negative ?after=', '?after=-5', {}],
    ['an exponent ?after=', '?after=1e3', {}],
    ['a hex ?after=', '?after=0x10', {}],
    ['an empty ?after=', '?after=', {}],
    ['an ?after= beyond the newest id', 'BEYOND', {}],
  ])('resume value: %s', (_label, queryIn, headers) => {
    it('opens the stream, replays nothing and still delivers live events', async () => {
      const { url } = await start();
      const t1 = await create(url, 'a');
      await create(url, 'b');
      const query =
        queryIn === 'BEYOND'
          ? `?after=${(await firstEventId(url, t1)) + 100}`
          : queryIn;
      const s = await open(url, query, headers);
      expect(s.status).toBe(200);
      await sleep(300);
      expect(s.messages).toEqual([]);
      expect(s.ended).toBe(false);
      const live = await create(url, 'live');
      await s.waitFor(() => s.messages.length >= 1);
      await sleep(100);
      expect(s.messages.map((m) => m.data.task.id)).toEqual([live.id]);
    });
  });

  it('stops cleanly when the client leaves in the middle of a large replay', async () => {
    // Seed before the app starts so the listener baseline includes the rows.
    const startedAt = new Date();
    const task = await db.task.create({
      data: {
        name: 'x'.repeat(100),
        durationSeconds: 60,
        state: 'finished',
        startedAt,
        endsAt: new Date(startedAt.getTime() + 60_000),
        updatedAt: startedAt,
      },
    });
    await db.taskEvent.createMany({
      data: Array.from({ length: 500 }, () => ({
        taskId: task.id,
        state: 'finished' as const,
        at: startedAt,
      })),
    });
    const { app, url } = await start();
    const svc = app.get(TaskStreamService);
    // Every 5th frame reports backpressure and drains 5 ms later, so the
    // replay really progresses in steps of a few frames.
    const spy = spyWrites((n) => (n % 5 === 0 ? 'drain' : 'ok'));
    const s = await open(url, '?after=0');
    await s.waitFor(() => s.messages.length >= 20);
    s.close();
    const deadline = Date.now() + 5000;
    while (svc.subscriberCount() > 0 && Date.now() < deadline) await sleep(10);
    expect(svc.subscriberCount()).toBe(0);
    await sleep(300);
    expect(unhandled).toEqual([]);
    expect(spy.taskWrites).toBeGreaterThan(1);
    expect(spy.taskWrites).toBeLessThan(500);
    expect(spy.writesAfterEnd).toBe(0);
    // The writer settled: it is no longer waiting on this response.
    expect(spy.reses.size).toBe(1);
    for (const res of spy.reses) expect(res.listenerCount('drain')).toBe(0);
  });

  it('keeps every id, in order, when a live change arrives while the flush waits for drain', async () => {
    const { app, url } = await start();
    const tasks: TaskDto[] = [];
    for (let i = 0; i < 3; i++) tasks.push(await create(url, `old${i}`));
    const query = app.get(TasksQuery);
    const real = query.replay.bind(query);
    // The snapshot is taken first; the replay is then held back until the
    // test has created the buffered tasks, which are not in the snapshot.
    let snapshotTaken: () => void = () => {};
    const snapshot = new Promise<void>((r) => (snapshotTaken = r));
    let release: () => void = () => {};
    const released = new Promise<void>((r) => (release = r));
    vi.spyOn(query, 'replay').mockImplementation(async (after) => {
      const result = await real(after);
      snapshotTaken();
      await released;
      return result;
    });
    // The 4th frame, the first one of the buffered flush, reports
    // backpressure; its drain arrives 250 ms later.
    const spy = spyWrites((n) => (n === 4 ? 'drain' : 'ok'), 250);
    const s = await open(url, '?after=0');
    await snapshot;
    // Created after the snapshot, so they reach the stream only as buffered
    // live changes.
    tasks.push(await create(url, 'buffered1'));
    tasks.push(await create(url, 'buffered2'));
    release();
    await s.waitFor(() => spy.taskWrites >= 4);
    // The writer now waits for drain with a buffered frame still queued.
    tasks.push(await create(url, 'live'));
    await s.waitFor(() => s.messages.length >= 6);
    await sleep(300);
    expect(s.messages.map((m) => m.data.task.id)).toEqual(
      tasks.map((t) => t.id),
    );
    expect(strictlyIncreasing(ids(s))).toBe(true);
  });

  it('ends a stream whose queue overflows, and the client resumes without gaps', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const { app, url } = await start();
    const svc = app.get(TaskStreamService);
    let stall = true;
    spyWrites(() => (stall ? 'stall' : 'ok'));
    const s = await open(url);
    // The first frame is written, then the writer waits forever for drain.
    await create(url, 'first');
    await s.waitFor(() => s.messages.length === 1);
    const lastId = s.messages[0].id;
    const total = MAX_QUEUED_LIVE + 100;
    for (let i = 0; i < total; i += 50) {
      await Promise.all(
        Array.from({ length: Math.min(50, total - i) }, (_, j) =>
          create(url, `bulk${i + j}`),
        ),
      );
    }
    await s.waitFor(() => s.ended, 5000);
    expect(svc.subscriberCount()).toBe(0);
    expect(warn.mock.calls.some((c) => String(c[0]).includes('overflow'))).toBe(
      true,
    );
    expect(s.messages).toHaveLength(1);

    stall = false;
    const rows = await db.taskEvent.findMany({
      where: { id: { gt: BigInt(lastId) } },
      orderBy: { id: 'asc' },
    });
    expect(rows).toHaveLength(total);
    const again = await open(url, '', { 'Last-Event-ID': String(lastId) });
    await again.waitFor(() => again.messages.length >= total, 10000);
    await sleep(200);
    expect(ids(again)).toEqual(rows.map((r) => Number(r.id)));
  }, 60000);

  it('answers 503 to a stream that arrives after shutdown began, and closes promptly', async () => {
    const { app, url } = await start();
    const svc = app.get(TaskStreamService);
    const real = svc.onModuleDestroy.bind(svc);
    let lateStatus = 0;
    vi.spyOn(svc, 'onModuleDestroy').mockImplementation((async () => {
      real();
      const late = await open(url);
      lateStatus = late.status;
    }) as unknown as typeof svc.onModuleDestroy);
    const t0 = Date.now();
    await app.close();
    expect(lateStatus).toBe(503);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(svc.subscriberCount()).toBe(0);
  });

  it('ends the stream and leaks nothing when the replay read fails', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const { app, url } = await start();
    vi.spyOn(app.get(TasksQuery), 'replay').mockRejectedValue(
      new Error('boom'),
    );
    const s = await open(url, '?after=0');
    expect(s.status).toBe(200);
    await s.waitFor(() => s.ended);
    expect(app.get(TaskStreamService).subscriberCount()).toBe(0);
    await sleep(100);
    expect(unhandled).toEqual([]);
  });

  it('falls back to a 15 s keep-alive for 0 or negative STREAM_KEEPALIVE_MS', async () => {
    const delays: unknown[] = [];
    const realSetInterval = global.setInterval;
    vi.spyOn(global, 'setInterval').mockImplementation(((
      fn: () => void,
      ms?: number,
    ) => {
      delays.push(ms);
      return realSetInterval(fn, ms);
    }) as typeof setInterval);
    const { url } = await start();
    delays.length = 0;
    for (const value of ['0', '-5', 'abc', '2.5']) {
      process.env.STREAM_KEEPALIVE_MS = value;
      await open(url);
    }
    expect(delays).toEqual([15000, 15000, 15000, 15000]);
  });

  it('closes the app in under 2 s with 3 open streams and a 60 s keep-alive', async () => {
    process.env.STREAM_KEEPALIVE_MS = '60000';
    const { app, url } = await start();
    const opened = await Promise.all([open(url), open(url), open(url)]);
    expect(opened.map((s) => s.status)).toEqual([200, 200, 200]);
    expect(app.get(TaskStreamService).subscriberCount()).toBe(3);
    const t0 = Date.now();
    await app.close();
    expect(Date.now() - t0).toBeLessThan(2000);
    await Promise.all(opened.map((s) => s.waitFor(() => s.ended, 2000)));
  });
});
