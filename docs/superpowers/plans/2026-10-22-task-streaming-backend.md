# Task Streaming Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A NestJS backend that runs persisted timers, lets several processes cooperate on them through Postgres, and streams every state change to all viewers over SSE with replay.

**Architecture:** Every state change goes through one locked transaction that writes the task, appends a `TaskEvent` and calls `pg_notify`. Each process `LISTEN`s, and that single feed drives both its SSE subscribers and its local timers. Every process arms a timer for every running task; a conditional update guarantees exactly one finish.

**Tech Stack:** Node 24, NestJS 12, Prisma 7.10.1 + `@prisma/adapter-pg`, `pg` 8, Postgres 18 (Docker), Jest + supertest.

**Spec:** `docs/superpowers/specs/2026-10-22-task-streaming-backend-design.md`

## Global Constraints

- Node 24 LTS (`.nvmrc` = `24`).
- NestJS 12 in `/backend`; `npm run start:dev` on port 3000; global prefix `/api`.
- `prisma` and `@prisma/client` pinned to exactly `7.10.1`, with `@prisma/adapter-pg` `7.10.1`; never the npm `latest` tag (8.0 RC).
- Postgres 18 via `docker compose`, data in a named volume.
- Task states are exactly `running | finished | cancelled`; there is no `created` state.
- `name`: string, trimmed, 1–100 chars. `durationSeconds`: integer 1–86400.
- NOTIFY channel `task_events`; payload is a `TaskChange` as JSON.
- SSE message format: `id: <eventId>`, `event: task`, `data: <TaskChange JSON>`; keep-alive comment `: ping` every 15 s.
- Resume point precedence: `Last-Event-ID` header, then `?after=`, then none.
- Env: `DATABASE_URL`, `PORT`, `FRONTEND_ORIGIN`, plus `STREAM_KEEPALIVE_MS` (default `15000`; my addition so tests don't wait 15 s).
- `stream-verifier` (`.claude/agents/stream-verifier.md`) must pass all ten checks. Checks 1–6 use `npm run start:dev` on port 3000; checks 7–10 also need the `multi` profile on ports 3001/3002. It needs the HTTP API and stream, so it runs from Task 6 onward, not after Tasks 2–4.
- The `multi` backends use the same `tasks` database as `start:dev`, so all three processes cooperate in checks 7–10.

## Review Focus

1. **Bad resume values.** `Last-Event-ID: abc`, `?after=-5`, or an id larger than the newest event: treat as "no resume point" (or send nothing), keep the stream open, never 500. Test in Task 6.
2. **Client leaves during replay.** A client that disconnects while hundreds of events are replaying: no write-after-end error, subscriber count back to 0. Test in Task 6.
3. **Coerced or junk bodies.** `durationSeconds: "180"`, `1.5`, `0`, `86401`; `name: "   "`; extra unknown fields. All 400, none create a task. Test in Task 5.
4. **Double arming.** At startup, a process can both read a running task and receive its NOTIFY. It must still hold exactly one timer per task. Test in Task 4.
5. **Shutdown with open streams.** `app.close()` with live SSE clients and armed timers resolves promptly (< 2 s) and leaves no handles. Test in Task 6.

---

### Task 1: Project scaffold, database and test harness

**Files:**
- Create: `.nvmrc`, `docker-compose.yml`, `docker/init-test-db.sql`
- Create: `backend/` via `npx @nestjs/cli@12 new backend --package-manager npm --skip-git`
- Create: `backend/prisma/schema.prisma`, `backend/prisma.config.ts`, first migration
- Create: `backend/src/prisma/prisma.module.ts`, `backend/src/prisma/prisma.service.ts`
- Create: `backend/.env.example`, `backend/.env.test`, `backend/test/helpers/db.ts`, `backend/test/helpers/app.ts`
- Modify: `backend/src/main.ts`, `backend/package.json`, `CLAUDE.md`
- Test: `backend/test/prisma.e2e-spec.ts`

**Interfaces:**
- Produces: `PrismaService extends PrismaClient` (global `PrismaModule`), built with `new PrismaPg({ connectionString: process.env.DATABASE_URL })`.
- Produces: `resetDb(prisma: PrismaService): Promise<void>` truncates `TaskEvent` and `Task` with `RESTART IDENTITY CASCADE`.
- Produces: `createApp(): Promise<{ app: INestApplication; url: string }>`. It builds `AppModule`, applies the same setup as `main.ts` (exported as `configureApp(app)`), listens on port 0 and returns the base URL. Multi-process tests call it twice.
- Produces: `configureApp(app: INestApplication): void` in `src/main.ts`. It sets prefix `/api`, CORS from `FRONTEND_ORIGIN`, `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` and `enableShutdownHooks()`.

- [ ] **Step 1: Scaffold the repo.** Write `.nvmrc`. Generate the Nest app. Install `prisma@7.10.1 @prisma/client@7.10.1 @prisma/adapter-pg@7.10.1 pg class-validator class-transformer` and dev `@types/pg`.
- [ ] **Step 2: Docker Compose.** Add a `postgres:18` service with volume `pgdata` and port 5432. It mounts `docker/init-test-db.sql`, which creates the `tasks_test` database. Add a `multi` profile, left empty until Task 7.
- [ ] **Step 3: Prisma schema.** Copy the data model exactly from the spec ("Data model"). Use Prisma 7's layout: the datasource URL lives in `prisma.config.ts`, and the generator is `prisma-client` with output `src/generated/prisma`. Run `npx prisma migrate dev --name init`.
- [ ] **Step 4: npm scripts.**
  - `prestart:dev`: `docker compose -f ../docker-compose.yml up -d --wait postgres && prisma migrate deploy`.
  - `pretest:e2e`: the same, run with `.env.test` loaded (`dotenv -e .env.test --`; add `dotenv-cli` as a dev dependency).
  - Jest e2e loads `.env.test` and runs with `--runInBand`.
- [ ] **Step 5: Write the failing test** `test/prisma.e2e-spec.ts`:

```ts
it('connects to the test database with an empty schema', async () => {
  const { app } = await createApp();
  const prisma = app.get(PrismaService);
  await resetDb(prisma);
  expect(await prisma.task.count()).toBe(0);
  expect(await prisma.taskEvent.count()).toBe(0);
  await app.close();
});
```

- [ ] **Step 6: Run it and see it fail.** `npm run test:e2e -- prisma`. It fails because `PrismaService` doesn't exist yet.
- [ ] **Step 7: Implement `PrismaService`, `PrismaModule`, `configureApp`, `createApp` and `resetDb`.** `PrismaService` connects in `onModuleInit` and disconnects in `onModuleDestroy`.
- [ ] **Step 8: Run it and see it pass.** Same command → PASS.
- [ ] **Step 9: Update `CLAUDE.md`** with the commands to start, test and reset the database (`docker compose down -v`).
- [ ] **Step 10: Commit.** `chore: scaffold backend, postgres and prisma schema`.

### Task 2: `TaskTransitions`, the single write path

**Files:**
- Create: `backend/src/tasks/task.types.ts`, `backend/src/tasks/task-transitions.service.ts`, `backend/src/tasks/tasks.module.ts`
- Test: `backend/test/task-transitions.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `createApp`, `resetDb` (Task 1).
- Produces, in `task.types.ts`:
  - `type TaskStateName = 'running' | 'finished' | 'cancelled'`.
  - `interface TaskDto { id; name; durationSeconds; state; startedAt; endsAt; updatedAt }`, with timestamps as ISO strings.
  - `interface TaskEventDto { id: number; taskId: string; state: TaskStateName; at: string }`.
  - `interface TaskChange { event: TaskEventDto; task: TaskDto }`.
  - `toTaskDto(task): TaskDto` and `toEventDto(event): TaskEventDto`. The second converts the `BigInt` id with `Number()`.
  - `const TASK_EVENTS_CHANNEL = 'task_events'`.
- Produces, in `TaskTransitions`:
  - `create(input: { name: string; durationSeconds: number }): Promise<TaskChange>`.
  - `transition(taskId: string, to: 'finished' | 'cancelled'): Promise<TaskChange | null>`. It returns `null` when the task isn't running.

- [ ] **Step 1: Write the failing tests:**
  - `create` returns `state: 'running'` with `endsAt` = `startedAt` + duration, and writes exactly 1 event, whose `state` is `'running'`.
  - `transition(id, 'cancelled')` on a running task returns the change, and the task row is now `cancelled`.
  - `transition` on an already-cancelled task returns `null`, and the event count stays at 2.
  - `transition` on an unknown uuid returns `null`.
  - A raw `pg.Client` that has run `LISTEN task_events` receives a payload deep-equal to the returned `TaskChange`.
  - A race: `Promise.all([transition(id,'finished'), transition(id,'cancelled')])` gives exactly one non-null result, and the task ends up with exactly 2 events.
  - Ordering: across 50 concurrent `create` calls, the ids the LISTEN client receives arrive strictly increasing.
- [ ] **Step 2: Run them and see them fail** (`npm run test:e2e -- task-transitions`). They fail because `TaskTransitions` doesn't exist.
- [ ] **Step 3: Implement `TaskTransitions`** as one shared private method inside `prisma.$transaction(async tx => …)`. It runs:
  1. `tx.$executeRaw\`SELECT pg_advisory_xact_lock(4242001)\``.
  2. Create, or `tx.task.update({ where: { id, state: 'running' }, … })`. Catch `P2025` → `null`.
  3. `tx.taskEvent.create`.
  4. `tx.$executeRaw\`SELECT pg_notify(${TASK_EVENTS_CHANNEL}, ${json})\``.

  Use `$executeRaw`, not `$queryRaw`, for both void functions: Prisma can't read back a column of type `void`. Validate the id as a uuid before querying, so a non-uuid value returns `null` instead of a database error.
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Commit.** `feat: transactional task transitions with ordered events and notify`.

### Task 3: `TaskEventsListener`, the cross-process feed

**Files:**
- Create: `backend/src/tasks/task-events.listener.ts`
- Test: `backend/test/task-events-listener.e2e-spec.ts`

**Interfaces:**
- Consumes: `TaskChange`, `TASK_EVENTS_CHANNEL`, `PrismaService` (for catch-up reads).
- Produces, in `TaskEventsListener`:
  - `changes$: Observable<TaskChange>`, a hot `Subject`.
  - `lastSeenId(): number`.
  - `onModuleInit` resolves only after `LISTEN` succeeds.
  - `onModuleDestroy` ends the client and stops reconnecting.

- [ ] **Step 1: Write the failing tests:**
  - With two apps from `createApp()`, `create` on app A is delivered on app B's `changes$` and on app A's own.
  - After `SELECT pg_terminate_backend(pid)` on the listener's connection, followed by a `create` while it's down, the listener reconnects and emits that missed change within 5 s. Catch-up reads `TaskEvent where id > lastSeen` joined with the current task row.
  - Duplicates are dropped: a change whose id is ≤ `lastSeenId()` is not re-emitted.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement it** with a dedicated `pg.Client` (not Prisma's pool). Reconnect with exponential backoff, capped (exact timings are yours to choose). Catch up before resuming live delivery.
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Commit.** `feat: LISTEN-based task event feed with reconnect catch-up`.

### Task 4: `TaskTimers`, arming, firing and recovery

**Files:**
- Create: `backend/src/tasks/task-timers.service.ts`
- Test: `backend/test/task-timers.e2e-spec.ts`

**Interfaces:**
- Consumes: `TaskEventsListener.changes$`, `TaskTransitions.transition`, `PrismaService`.
- Produces, in `TaskTimers`:
  - `armedCount(): number`, which tests use.
  - `onApplicationBootstrap` performs recovery: it reads running tasks, finishes the expired ones, and arms the rest. This runs after the listener's `onModuleInit`, so listening always starts first.
  - `onModuleDestroy` clears every timer.

- [ ] **Step 1: Write the failing tests** (real timers, short durations):
  - A 1 s task gets a `finished` event between 1.0 s and 1.5 s after `startedAt`.
  - Cancelling at 0.5 s → no `finished` event ever (wait 1.5 s), and `armedCount()` is 0.
  - Recovery, expired: insert a running task with `endsAt` in the past straight through Prisma, start the app → `finished` within 500 ms.
  - Recovery, pending: insert a running task ending in 1 s, start the app → finished on time.
  - Takeover: with apps A and B, create a 2 s task on A, `await A.close()` → B records `finished` on time.
  - Two instances, one finish: apps A and B with a 1 s task → exactly one `finished` event.
  - Review Focus 4: during startup recovery, the same running task arrives both from the read and from the NOTIFY → `armedCount()` is 1.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement it.** Keep a `Map<taskId, Timeout>`; arming replaces any existing timer. On a `running` change, arm for `max(0, endsAt − now)`; on `finished`/`cancelled`, clear. Firing calls `transition(id, 'finished')` and ignores `null`. After a listener reconnect, the spec says to re-arm every running task. Here the listener's catch-up already replays every missed change through `changes$`, and that arms or clears the right timers, so `TaskTimers` needs no separate re-sync.
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Commit.** `feat: per-process timers with startup recovery and takeover`.

### Task 5: REST API

**Files:**
- Create: `backend/src/tasks/tasks.controller.ts`, `backend/src/tasks/create-task.dto.ts`, `backend/src/tasks/tasks.query.ts`
- Test: `backend/test/tasks-api.e2e-spec.ts`

**Interfaces:**
- Consumes: `TaskTransitions`, `PrismaService`, `toTaskDto`, `toEventDto`.
- Produces: the endpoints and responses exactly as in the spec's "HTTP API" table.
- Produces, in `TasksQuery`:
  - `list(): Promise<{ tasks: TaskDto[]; lastEventId: number | null }>`. It reads the tasks and the max event id in one transaction.
  - `events(taskId): Promise<TaskEventDto[] | null>`.
  - Task 6 reuses `TasksQuery` for replay.

- [ ] **Step 1: Write the failing tests (supertest):**
  - `POST /api/tasks {name:'Tea', durationSeconds:3}` → 201, `state: 'running'`.
  - `GET /api/tasks` → newest `startedAt` first, and `lastEventId` equals the max event id (`null` on an empty database).
  - `GET /api/tasks/:id/events` → oldest first; `404` for an unknown uuid; `400` for `not-a-uuid`.
  - Cancel → 200 `cancelled`; cancelling again → 409; unknown uuid → 404; bad uuid → 400.
  - Review Focus 3: `durationSeconds` of `"180"`, `1.5`, `0` or `86401`; a `name` of `"   "` or 101 chars; an extra field `foo` → each gives 400, and `GET /api/tasks` still shows no tasks.
  - `name: '  Tea  '` is stored as `'Tea'`.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement the controller, DTO and `TasksQuery`.** Use `ParseUUIDPipe` for `:id`. The DTO uses `@Transform` trim, `@IsString @Length(1,100)`, and `@IsInt @Min(1) @Max(86400)`. Don't add `enableImplicitConversion`, because `"180"` must be rejected.
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Commit.** `feat: tasks REST API with validation`.

### Task 6: SSE stream with replay

**Files:**
- Create: `backend/src/tasks/task-stream.controller.ts`, `backend/src/tasks/task-stream.service.ts`
- Create: `backend/test/helpers/sse.ts`
- Test: `backend/test/task-stream.e2e-spec.ts`

**Interfaces:**
- Consumes: `TaskEventsListener.changes$`, `TasksQuery`, `TaskEventDto`.
- Produces, in `TaskStreamService`:
  - `subscriberCount(): number`.
  - `attach(req, res, resumeAfter: number | null): void`.
  - It logs `stream subscribers: <n>` on every connect and disconnect.
- Produces, for tests, `openStream(url, headers?)` in `test/helpers/sse.ts`. It returns `{ messages: {id:number; event:string; data:TaskChange}[]; comments: string[]; waitFor(pred, ms): Promise<void>; close(): void }` and is built on `http.get`, parsing SSE frames.

- [ ] **Step 1: Write the failing tests:**
  - Live: open the stream, then POST a 1 s task → messages for `running` then `finished`, in that order, with `event === 'task'` and numeric `id`.
  - Keep-alive: with `STREAM_KEEPALIVE_MS=200`, there's at least one `ping` comment after 500 ms, and no `task` messages without changes.
  - Replay by header: create 3 tasks, then open with `Last-Event-ID: <first id>` → the 2 later events, in order, then live events with no duplicates.
  - Replay by query: `?after=<id>` works the same; when both are given, the header wins.
  - Replay racing live: open with `?after=0` while creating 20 tasks concurrently → every id exactly once, strictly increasing.
  - Cross-process: a stream on app B receives a task created on app A.
  - Many clients: 8 streams all receive the same id list.
  - Cleanup: open and close 10 streams → `subscriberCount()` returns to 0.
  - Review Focus 1: `Last-Event-ID: abc`, `?after=-5`, or a value of max id + 100 → status 200, stream open, no replayed messages.
  - Review Focus 2: seed 500 events, open with `?after=0` and close after the first message → no unhandled errors, and `subscriberCount()` returns to 0.
  - Review Focus 5: with 3 open streams and an armed 60 s timer, `app.close()` resolves in under 2 s.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement it**, following the spec's "SSE stream" section.
  - The controller uses `@Get('stream')` with `@Req`/`@Res`, and must be declared before `:id` routes.
  - Write the headers and `flushHeaders()`.
  - Order of work: subscribe to `changes$` into a buffer → replay from `TasksQuery` (events `> resumeAfter`, each with its current task) → flush the buffer, skipping ids ≤ the last one sent → go live.
  - A non-numeric or negative resume value is treated as `null`.
  - Stop writing once `res.writableEnded` is set or `close` has fired.
  - On `close`, unsubscribe and clear the keep-alive interval. On module destroy, end every open response.
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Run the `stream-verifier` agent with scope "checks 1–6".** Expected: checks 1–6 PASS, 7–10 NOT RUN.
- [ ] **Step 6: Commit.** `feat: SSE task stream with resume and cleanup`.

### Task 7: Multi-process run in Docker

**Files:**
- Create: `backend/Dockerfile`, `backend/.dockerignore`
- Modify: `docker-compose.yml` (fill in the `multi` profile), `CLAUDE.md`

**Interfaces:**
- Consumes: the whole app.
- Produces: `docker compose --profile multi up -d --build` runs `backend-1` on port 3001 and `backend-2` on port 3002 against the same Postgres. Both run `prisma migrate deploy` before starting.

- [ ] **Step 1: Write the Dockerfile.** Multi-stage on `node:24-slim`. The build stage runs `prisma generate` and `npm run build`. The runtime command is `npx prisma migrate deploy && node dist/main`.
- [ ] **Step 2: Fill in the `multi` profile.** Two services from the same build, with `DATABASE_URL` pointing at `postgres`, depending on postgres being healthy.
- [ ] **Step 3: Verify it by hand:**
  - `curl -N localhost:3002/api/tasks/stream` in the background, then `curl -X POST localhost:3001/api/tasks -H 'content-type: application/json' -d '{"name":"x","durationSeconds":3}'`. Expected: the 3002 stream shows `running`, then `finished` about 3 s later.
  - Repeat with a 10 s task, then `docker compose stop backend-1` straight after creating it. Expected: 3002 still shows `finished` on time.
- [ ] **Step 4: Run the `stream-verifier` agent with scope "all checks".** Expected: all ten checks PASS.
- [ ] **Step 5: Document the commands in `CLAUDE.md`.**
- [ ] **Step 6: Commit.** `feat: two-process docker compose profile`.
