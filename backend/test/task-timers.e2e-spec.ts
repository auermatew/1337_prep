import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TaskEventsListener } from '../src/tasks/task-events.listener.js';
import { TaskTimers } from '../src/tasks/task-timers.service.js';
import { TaskTransitions } from '../src/tasks/task-transitions.service.js';
import { createApp } from './helpers/app.js';
import { resetDb } from './helpers/db.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(cond: () => boolean, ms = 5000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > deadline) throw new Error('timed out waiting');
    await sleep(10);
  }
}

describe('TaskTimers (e2e)', () => {
  const apps: INestApplication[] = [];
  let db: PrismaService; // test-owned client, independent of any app

  beforeAll(async () => {
    db = new PrismaService();
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  // Reset before any app baselines its listener from the table.
  beforeEach(async () => {
    await resetDb(db);
  });

  async function start(): Promise<INestApplication> {
    const { app } = await createApp();
    apps.push(app);
    return app;
  }

  afterEach(async () => {
    vi.restoreAllMocks();
    const open = apps.splice(0);
    const errors: unknown[] = [];
    for (const app of open) {
      try {
        await app.close();
      } catch (err) {
        errors.push(err); // keep closing the rest
      }
    }
    if (errors.length) {
      throw new AggregateError(errors, 'app.close() failed during teardown');
    }
  });

  const finishedEvents = (taskId: string) =>
    db.taskEvent.findMany({ where: { taskId, state: 'finished' } });

  async function waitForFinished(taskId: string, ms = 5000) {
    const deadline = Date.now() + ms;
    for (;;) {
      const events = await finishedEvents(taskId);
      if (events.length) return events[0];
      if (Date.now() > deadline) throw new Error('timed out waiting');
      await sleep(10);
    }
  }

  it('finishes a 1 s task between 1.0 s and 1.5 s after it started', async () => {
    const app = await start();
    const { task } = await app
      .get(TaskTransitions)
      .create({ name: 'x', durationSeconds: 1 });

    const event = await waitForFinished(task.id);

    const elapsed = event.at.getTime() - new Date(task.startedAt).getTime();
    expect(elapsed).toBeGreaterThanOrEqual(1000);
    expect(elapsed).toBeLessThan(1500);
  });

  it('records no finished event for a task cancelled at 0.5 s', async () => {
    const app = await start();
    const transitions = app.get(TaskTransitions);
    const timers = app.get(TaskTimers);
    const { task } = await transitions.create({
      name: 'x',
      durationSeconds: 1,
    });
    await waitFor(() => timers.armedCount() === 1);

    await sleep(500);
    await transitions.transition(task.id, 'cancelled');
    await waitFor(() => timers.armedCount() === 0);
    await sleep(1500); // the point is that nothing happens

    expect(await finishedEvents(task.id)).toHaveLength(0);
    expect(timers.armedCount()).toBe(0);
  });

  it('recovery: finishes an already expired running task right after startup', async () => {
    const now = Date.now();
    const task = await db.task.create({
      data: {
        name: 'old',
        durationSeconds: 10,
        state: 'running',
        startedAt: new Date(now - 10_000),
        endsAt: new Date(now - 1000),
        updatedAt: new Date(now - 10_000),
      },
    });

    const started = Date.now();
    await start();
    await waitForFinished(task.id, 500);

    expect(Date.now() - started).toBeLessThan(2500); // sanity, includes boot
  });

  it('recovery: arms a pending running task and finishes it on time', async () => {
    const now = Date.now();
    const endsAt = new Date(now + 1000);
    const task = await db.task.create({
      data: {
        name: 'pending',
        durationSeconds: 1,
        state: 'running',
        startedAt: new Date(now),
        endsAt,
        updatedAt: new Date(now),
      },
    });

    const app = await start();
    expect(app.get(TaskTimers).armedCount()).toBe(1);
    const event = await waitForFinished(task.id);

    const lateBy = event.at.getTime() - endsAt.getTime();
    expect(lateBy).toBeGreaterThanOrEqual(0);
    expect(lateBy).toBeLessThan(500);
  });

  it('takeover: B finishes the task on time after A, which created it, closes', async () => {
    const a = await start();
    const b = await start();
    const timersB = b.get(TaskTimers);
    const { task } = await a
      .get(TaskTransitions)
      .create({ name: 'x', durationSeconds: 2 });
    await waitFor(() => timersB.armedCount() === 1);

    await a.close();
    apps.splice(apps.indexOf(a), 1);
    const event = await waitForFinished(task.id);

    const lateBy = event.at.getTime() - new Date(task.endsAt).getTime();
    expect(lateBy).toBeGreaterThanOrEqual(0);
    expect(lateBy).toBeLessThan(500);
  });

  it('two instances record exactly one finished event', async () => {
    const a = await start();
    const b = await start();
    const { task } = await a
      .get(TaskTransitions)
      .create({ name: 'x', durationSeconds: 1 });
    await waitFor(
      () =>
        a.get(TaskTimers).armedCount() === 1 &&
        b.get(TaskTimers).armedCount() === 1,
    );

    await waitForFinished(task.id);
    await waitFor(
      () =>
        a.get(TaskTimers).armedCount() === 0 &&
        b.get(TaskTimers).armedCount() === 0,
    );
    await sleep(300); // let a possible duplicate show up

    expect(await finishedEvents(task.id)).toHaveLength(1);
  });

  it('arms one timer when startup recovery reads a task that also arrives via NOTIFY', async () => {
    const a = await start();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const b = moduleRef.createNestApplication();
    configureApp(b);
    apps.push(b);

    // Once B's listener is up, A creates a task in the middle of B's recovery
    // read: the row is part of the read and its NOTIFY reaches B as well.
    let created: Awaited<ReturnType<TaskTransitions['create']>> | undefined;
    const prismaB = b.get(PrismaService);
    const realFindMany = prismaB.task.findMany.bind(prismaB.task);
    vi.spyOn(prismaB.task, 'findMany').mockImplementation(((
      ...args: Parameters<typeof realFindMany>
    ) => {
      return (async () => {
        created = await a
          .get(TaskTransitions)
          .create({ name: 'x', durationSeconds: 60 });
        return realFindMany(...args);
      })();
    }) as typeof realFindMany);

    await b.listen(0);
    const listenerB = b.get(TaskEventsListener);
    await waitFor(() => listenerB.lastSeenId() === created?.event.id);

    expect(b.get(TaskTimers).armedCount()).toBe(1);
  });

  it('retries after a failed transition and then finishes the task', async () => {
    const app = await start();
    const transitions = app.get(TaskTransitions);
    vi.spyOn(transitions, 'transition').mockRejectedValueOnce(
      new Error('db unavailable'),
    );

    const { task } = await transitions.create({
      name: 'x',
      durationSeconds: 1,
    });
    const event = await waitForFinished(task.id, 4000);

    const elapsed = event.at.getTime() - new Date(task.startedAt).getTime();
    expect(elapsed).toBeGreaterThanOrEqual(2000); // 1 s task + ~1 s retry
    expect(elapsed).toBeLessThan(3000);
  });
});
