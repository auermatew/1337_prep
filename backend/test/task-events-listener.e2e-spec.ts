import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TaskEventsListener } from '../src/tasks/task-events.listener.js';
import { TaskTransitions } from '../src/tasks/task-transitions.service.js';
import { TASK_EVENTS_CHANNEL, TaskChange } from '../src/tasks/task.types.js';
import { createApp } from './helpers/app.js';
import { resetDb } from './helpers/db.js';

async function waitFor(cond: () => boolean, ms = 5000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > deadline) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('TaskEventsListener (e2e)', () => {
  const apps: INestApplication[] = [];

  // Reset before any listener baselines its lastSeenId from the table.
  beforeEach(async () => {
    const prisma = new PrismaService();
    try {
      await prisma.$connect();
      await resetDb(prisma);
    } finally {
      await prisma.$disconnect();
    }
  });

  async function start(): Promise<INestApplication> {
    const { app } = await createApp();
    apps.push(app);
    return app;
  }

  afterEach(async () => {
    const open = apps.splice(0);
    for (const app of open) {
      try {
        await app.close();
      } catch {
        // keep closing the rest
      }
    }
  });

  it('delivers a create from app A on both A and B', async () => {
    const a = await start();
    const b = await start();
    const onA: TaskChange[] = [];
    const onB: TaskChange[] = [];
    a.get(TaskEventsListener).changes$.subscribe((c) => onA.push(c));
    b.get(TaskEventsListener).changes$.subscribe((c) => onB.push(c));

    const change = await a
      .get(TaskTransitions)
      .create({ name: 'x', durationSeconds: 60 });

    await waitFor(() => onA.length === 1 && onB.length === 1);
    expect(onA[0]).toEqual(change);
    expect(onB[0]).toEqual(change);
    expect(b.get(TaskEventsListener).lastSeenId()).toBe(change.event.id);
  });

  it('reconnects after its connection is killed and catches up missed changes', async () => {
    const a = await start();
    const b = await start();
    const prisma = a.get(PrismaService);
    const listenerB = b.get(TaskEventsListener);
    const received: TaskChange[] = [];
    listenerB.changes$.subscribe((c) => received.push(c));
    const transitions = a.get(TaskTransitions);

    const first = await transitions.create({
      name: 'one',
      durationSeconds: 60,
    });
    await waitFor(() => received.length === 1);

    const pid = listenerB.backendPid();
    expect(pid).toBeTypeOf('number');
    await prisma.$queryRaw`SELECT pg_terminate_backend(${pid}::int)`;
    // Created while B's listener is (likely) down: must still arrive.
    const second = await transitions.create({
      name: 'two',
      durationSeconds: 60,
    });
    const cancelled = await transitions.transition(second.task.id, 'cancelled');

    await waitFor(() => received.length === 3);
    expect(received.map((c) => c.event.id)).toEqual([
      first.event.id,
      second.event.id,
      cancelled!.event.id,
    ]);
    // Catch-up joins the task's current row.
    expect(received[1].event.state).toBe('running');
    expect(received[1].task.state).toBe('cancelled');
    expect(listenerB.backendPid()).not.toBe(pid);

    // Live delivery resumes after catch-up.
    const third = await transitions.create({
      name: 'three',
      durationSeconds: 60,
    });
    await waitFor(() => received.length === 4);
    expect(received[3]).toEqual(third);
  });

  it('does not re-emit a change whose id is <= lastSeenId', async () => {
    const a = await start();
    const prisma = a.get(PrismaService);
    const listener = a.get(TaskEventsListener);
    const received: TaskChange[] = [];
    listener.changes$.subscribe((c) => received.push(c));

    const change = await a
      .get(TaskTransitions)
      .create({ name: 'x', durationSeconds: 60 });
    await waitFor(() => received.length === 1);

    await prisma.$executeRaw`SELECT pg_notify(${TASK_EVENTS_CHANNEL}, ${JSON.stringify(change)})`;
    await prisma.$executeRaw`SELECT pg_notify(${TASK_EVENTS_CHANNEL}, ${'not json'})`;
    const next = await a
      .get(TaskTransitions)
      .create({ name: 'y', durationSeconds: 60 });
    await waitFor(() => received.length === 2);

    expect(received.map((c) => c.event.id)).toEqual([
      change.event.id,
      next.event.id,
    ]);
    expect(listener.lastSeenId()).toBe(next.event.id);
  });
});
