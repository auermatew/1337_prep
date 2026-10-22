import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TaskDto, TaskEventDto } from '../src/tasks/task.types.js';
import { createApp } from './helpers/app.js';
import { resetDb } from './helpers/db.js';

const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Tasks REST API (e2e)', () => {
  const apps: INestApplication[] = [];
  let db: PrismaService;
  let url: string;

  beforeAll(async () => {
    db = new PrismaService();
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await resetDb(db);
    const created = await createApp();
    apps.push(created.app);
    url = created.url;
  });

  afterEach(async () => {
    const errors: unknown[] = [];
    for (const app of apps.splice(0)) {
      try {
        await app.close();
      } catch (e) {
        errors.push(e);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'app close failed');
  });

  const post = (body?: unknown) => {
    const req = request(url).post('/api/tasks');
    return body === undefined ? req : req.send(body as object);
  };

  async function create(
    name: string,
    durationSeconds = 3600,
  ): Promise<TaskDto> {
    const res = await post({ name, durationSeconds }).expect(201);
    return res.body as TaskDto;
  }

  describe('POST /api/tasks', () => {
    it('creates a running task', async () => {
      const res = await post({ name: 'Tea', durationSeconds: 3 }).expect(201);
      const task = res.body as TaskDto;
      expect(task.state).toBe('running');
      expect(task.name).toBe('Tea');
      expect(task.durationSeconds).toBe(3);
      expect(await db.task.count({ where: { id: task.id } })).toBe(1);
    });

    it('trims the name before storing it', async () => {
      const res = await post({ name: '  Tea  ', durationSeconds: 3600 }).expect(
        201,
      );
      const task = res.body as TaskDto;
      expect(task.name).toBe('Tea');
      const row = await db.task.findUniqueOrThrow({ where: { id: task.id } });
      expect(row.name).toBe('Tea');
    });

    it.each([
      ['string duration "180"', { name: 'Tea', durationSeconds: '180' }],
      ['fractional duration 1.5', { name: 'Tea', durationSeconds: 1.5 }],
      ['duration 0', { name: 'Tea', durationSeconds: 0 }],
      ['duration 86401', { name: 'Tea', durationSeconds: 86401 }],
      ['missing duration', { name: 'Tea' }],
      ['blank name', { name: '   ', durationSeconds: 60 }],
      ['101-char name', { name: 'x'.repeat(101), durationSeconds: 60 }],
      ['missing name', { durationSeconds: 60 }],
      ['numeric name', { name: 5, durationSeconds: 60 }],
      ['null name', { name: null, durationSeconds: 60 }],
      ['extra field foo', { name: 'Tea', durationSeconds: 60, foo: 1 }],
    ])('rejects %s with 400 and creates nothing', async (_label, body) => {
      await post(body).expect(400);
      expect(await db.task.count()).toBe(0);
      expect(await db.taskEvent.count()).toBe(0);
      const list = await request(url).get('/api/tasks').expect(200);
      expect((list.body as { tasks: unknown[] }).tasks).toEqual([]);
    });

    it('rejects a missing body with 400', async () => {
      await post().expect(400);
      expect(await db.task.count()).toBe(0);
    });

    it('rejects a non-JSON body with 400', async () => {
      await request(url)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .send('{not json')
        .expect(400);
      expect(await db.task.count()).toBe(0);
    });
  });

  describe('GET /api/tasks', () => {
    it('returns no tasks and a null lastEventId on an empty database', async () => {
      const res = await request(url).get('/api/tasks').expect(200);
      expect(res.body).toEqual({ tasks: [], lastEventId: null });
    });

    it('lists newest startedAt first with the max event id', async () => {
      const a = await create('A');
      await sleep(5);
      const b = await create('B');
      await sleep(5);
      const c = await create('C');
      await request(url).post(`/api/tasks/${a.id}/cancel`).expect(200);

      const res = await request(url).get('/api/tasks').expect(200);
      const body = res.body as { tasks: TaskDto[]; lastEventId: number };
      expect(body.tasks.map((t) => t.id)).toEqual([c.id, b.id, a.id]);
      expect(body.tasks.find((t) => t.id === a.id)?.state).toBe('cancelled');

      const max = await db.taskEvent.aggregate({ _max: { id: true } });
      expect(body.lastEventId).toBe(Number(max._max.id));
      expect(body.lastEventId).toBe(4);
    });
  });

  describe('GET /api/tasks/:id/events', () => {
    it('returns events oldest first', async () => {
      const t = await create('Tea');
      await request(url).post(`/api/tasks/${t.id}/cancel`).expect(200);
      const other = await create('Other');

      const res = await request(url)
        .get(`/api/tasks/${t.id}/events`)
        .expect(200);
      const events = res.body as TaskEventDto[];
      expect(events.map((e) => e.state)).toEqual(['running', 'cancelled']);
      expect(events.every((e) => e.taskId === t.id)).toBe(true);
      expect(events[0].id).toBeLessThan(events[1].id);
      expect(events.some((e) => e.taskId === other.id)).toBe(false);
    });

    it('returns 404 for an unknown uuid', async () => {
      await request(url).get(`/api/tasks/${UNKNOWN_UUID}/events`).expect(404);
    });

    it('returns 400 for a malformed uuid', async () => {
      await request(url).get('/api/tasks/not-a-uuid/events').expect(400);
    });
  });

  describe('POST /api/tasks/:id/cancel', () => {
    it('cancels a running task', async () => {
      const t = await create('Tea');
      const res = await request(url)
        .post(`/api/tasks/${t.id}/cancel`)
        .expect(200);
      expect((res.body as TaskDto).id).toBe(t.id);
      expect((res.body as TaskDto).state).toBe('cancelled');
      const row = await db.task.findUniqueOrThrow({ where: { id: t.id } });
      expect(row.state).toBe('cancelled');
    });

    it('returns 409 when cancelling again, without a new event', async () => {
      const t = await create('Tea');
      await request(url).post(`/api/tasks/${t.id}/cancel`).expect(200);
      await request(url).post(`/api/tasks/${t.id}/cancel`).expect(409);
      expect(await db.taskEvent.count({ where: { taskId: t.id } })).toBe(2);
    });

    it('returns 404 for an unknown uuid', async () => {
      await request(url).post(`/api/tasks/${UNKNOWN_UUID}/cancel`).expect(404);
    });

    it('returns 400 for a malformed uuid', async () => {
      await request(url).post('/api/tasks/not-a-uuid/cancel').expect(400);
    });
  });
});
