import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TaskTransitions } from '../src/tasks/task-transitions.service.js';
import { TASK_EVENTS_CHANNEL, TaskChange } from '../src/tasks/task.types.js';
import { createApp } from './helpers/app.js';
import { resetDb } from './helpers/db.js';

describe('TaskTransitions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let transitions: TaskTransitions;
  let listener: Client | undefined;

  beforeEach(async () => {
    ({ app } = await createApp());
    prisma = app.get(PrismaService);
    transitions = app.get(TaskTransitions);
    await resetDb(prisma);
  });

  afterEach(async () => {
    await listener?.end();
    listener = undefined;
    await app.close();
  });

  async function listen(): Promise<TaskChange[]> {
    const received: TaskChange[] = [];
    listener = new Client({ connectionString: process.env.DATABASE_URL });
    await listener.connect();
    listener.on('notification', (msg) => {
      if (msg.payload) received.push(JSON.parse(msg.payload) as TaskChange);
    });
    await listener.query(`LISTEN ${TASK_EVENTS_CHANNEL}`);
    return received;
  }

  async function waitFor(cond: () => boolean): Promise<void> {
    const deadline = Date.now() + 5000;
    while (!cond()) {
      if (Date.now() > deadline) throw new Error('timed out waiting');
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  it('create returns a running task and writes one running event', async () => {
    const change = await transitions.create({ name: 'a', durationSeconds: 60 });
    expect(change.task.state).toBe('running');
    expect(Date.parse(change.task.endsAt)).toBe(
      Date.parse(change.task.startedAt) + 60_000,
    );
    expect(change.event.state).toBe('running');
    expect(change.event.taskId).toBe(change.task.id);
    const events = await prisma.taskEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0].state).toBe('running');
  });

  it('cancels a running task', async () => {
    const created = await transitions.create({
      name: 'a',
      durationSeconds: 60,
    });
    const change = await transitions.transition(created.task.id, 'cancelled');
    expect(change?.task.state).toBe('cancelled');
    expect(change?.event.state).toBe('cancelled');
    const row = await prisma.task.findUniqueOrThrow({
      where: { id: created.task.id },
    });
    expect(row.state).toBe('cancelled');
  });

  it('returns null and writes nothing for an already-cancelled task', async () => {
    const created = await transitions.create({
      name: 'a',
      durationSeconds: 60,
    });
    await transitions.transition(created.task.id, 'cancelled');
    expect(
      await transitions.transition(created.task.id, 'finished'),
    ).toBeNull();
    expect(await prisma.taskEvent.count()).toBe(2);
  });

  it('returns null for an unknown uuid', async () => {
    expect(await transitions.transition(randomUUID(), 'finished')).toBeNull();
  });

  it('returns null for a non-uuid id without a database error', async () => {
    expect(await transitions.transition('nope', 'finished')).toBeNull();
  });

  it('notifies listeners with a payload equal to the returned change', async () => {
    const received = await listen();
    const change = await transitions.create({ name: 'a', durationSeconds: 5 });
    await waitFor(() => received.length === 1);
    expect(received[0]).toEqual(change);
    const done = await transitions.transition(change.task.id, 'finished');
    await waitFor(() => received.length === 2);
    expect(received[1]).toEqual(done);
  });

  it('lets exactly one of two racing transitions win', async () => {
    const created = await transitions.create({
      name: 'a',
      durationSeconds: 60,
    });
    const results = await Promise.all([
      transitions.transition(created.task.id, 'finished'),
      transitions.transition(created.task.id, 'cancelled'),
    ]);
    expect(results.filter((r) => r !== null)).toHaveLength(1);
    expect(
      await prisma.taskEvent.count({ where: { taskId: created.task.id } }),
    ).toBe(2);
  });

  it('delivers event ids in strictly increasing order under concurrency', async () => {
    const received = await listen();
    await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        transitions.create({ name: `t${i}`, durationSeconds: 60 }),
      ),
    );
    await waitFor(() => received.length === 50);
    const ids = received.map((c) => c.event.id);
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThan(ids[i - 1]);
    }
  });
});
