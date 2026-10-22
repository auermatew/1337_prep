# Task Streaming Backend — Design

Date: 2026-10-22
Status: draft, awaiting approval
Scope: the backend only. The frontend gets its own brainstorm and design later.

## Intent

A practice project (`1337_prep`) for building a backend that runs long-running
tasks and streams their progress to any number of viewers. The task itself is
deliberately simple — a timer — so the work goes into the hard parts:
streaming, persistence, and several backend processes cooperating correctly.

## Goals

- Start a timer (name + duration), list all timers, cancel a running one.
- Every state change is pushed live over Server-Sent Events to every connected
  viewer, whichever backend process they are connected to.
- Tasks and their full state history are saved in Postgres and survive restarts.
- Several backend processes run at once against one database. They listen to
  each other: if one dies, the others still finish its timers on time.
- A viewer who reconnects gets the events it missed (`Last-Event-ID`).
- Each task's history can be read through the API (shown in the frontend later).

## Non-goals

- Task types other than timers. The design depends on this (see "Who finishes
  a timer"); doing real work in a task needs a different design.
- Per-second progress ticks on the stream. Clients compute the countdown from
  `endsAt`.
- Users, auth, deleting tasks, pagination, history retention/cleanup.
- Redis or any message broker; Postgres `LISTEN/NOTIFY` is the only fan-out.
- A load balancer in front of the processes.

## Anti-goals — failures even if everything "works"

- A timer recorded as finished twice, or as both finished and cancelled.
- A viewer silently missing an event, before or after a reconnect.
- A restart (of one process or all) losing a timer or making it run long.
- Streams that leave subscribers, intervals or timers behind after disconnect.

## Constraints

- Node 24 LTS (`.nvmrc`). Node 20 is accepted by every dependency but is past
  end of life.
- NestJS 12 in `/backend`, started with `npm run start:dev`, global prefix `/api`.
- Prisma 7.10.1, pinned (npm's `latest` tag currently points at an 8.0 release
  candidate), with `@prisma/adapter-pg` on `pg` 8.
- Postgres 18 in Docker via `docker compose`, data in a named volume.
- `.claude/agents/stream-verifier.md` must pass all ten checks against the
  running backend: six against a single process, four against the
  multi-process setup.

## Approaches considered

**Storage — SQLite vs Postgres.** SQLite costs nothing to set up and tests are
trivial, but it cannot serve several processes and has no notification
mechanism. Postgres needs Docker but supports multiple processes and gives
`LISTEN/NOTIFY` for cross-process streaming. **Chosen: Postgres in Docker**,
because tasks must be saved and several processes must cooperate.

**Database layer — Drizzle vs Prisma vs TypeORM.** Drizzle is closest to SQL
and covers everything natively; TypeORM is the most Nest-native with the
loosest types; Prisma has the best day-to-day experience. **Chosen: Prisma.**
Prisma 7 runs on `pg` through its adapter, so the one thing it cannot do,
`LISTEN`, is a plain `pg` connection from a library already installed.
Conditional updates work natively (`update` with a non-unique filter, Prisma ≥ 5).

**Stream — Nest's `@Sse()` vs a hand-written SSE response.** `@Sse()` is less
code and cleans up on disconnect automatically, but gives less control over
the exact wire output. **Chosen (my call): hand-written** on the raw response,
because replay-then-live needs exact ordering and deduplication, and keep-alive
comments need raw writes. Cleanup is then our job and is tested explicitly.

**Who finishes a timer when processes die — every process arms every timer
vs one process claims each task.** Claiming (leases, heartbeats, takeover) is
needed when a task does real work that must run once. A timer's "work" is only
waiting, so **chosen: every live process arms a timer for every running task**,
and a conditional state change guarantees exactly one wins. No leader, no
heartbeats. This is valid only while tasks are timers.

## Data model

```prisma
enum TaskState { running finished cancelled }

model Task {
  id              String      @id @default(uuid()) @db.Uuid
  name            String      // 1–100 chars, trimmed
  durationSeconds Int         // 1–86400
  state           TaskState
  startedAt       DateTime    @db.Timestamptz
  endsAt          DateTime    @db.Timestamptz   // startedAt + duration
  updatedAt       DateTime    @db.Timestamptz
  events          TaskEvent[]
  @@index([state])
}

model TaskEvent {
  id     BigInt    @id @default(autoincrement())  // global order; the SSE id
  taskId String    @db.Uuid
  task   Task      @relation(fields: [taskId], references: [id])
  state  TaskState
  at     DateTime  @db.Timestamptz                // when the change was recorded
  @@index([taskId, id])
}
```

There is no `created` state: a timer starts the moment it is created, so the
first event is `running`. `at` is when the change was recorded — if all
processes were down at `endsAt`, the `finished` event carries the later
recovery time, while the task still shows the planned `endsAt`.

`BigInt` ids are serialised as JSON numbers (safe far beyond this scale).

## Every state change goes through one function

`recordTransition(taskId, from: 'running' | null, to)` runs one transaction:

0. Take one global transaction-level advisory lock
   (`SELECT pg_advisory_xact_lock(<fixed key>)`). This forces transitions to
   commit one at a time, so event ids are handed out in commit order. Without
   it, two overlapping transitions could get ids 57 and 58 with 58 committing
   first, and a client resuming from 58 would never see 57. Everything keyed
   on event id — `lastEventId`, replay, dedup, listener catch-up — relies on
   this. The cost is negligible at this scale.
1. Create (from `null`) or conditionally update the task —
   `update({ where: { id, state: 'running' }, data: { state: to, updatedAt } })`.
   Prisma error `P2025` means the task was not running: return `null`, write
   nothing, notify nothing.
2. Insert the `TaskEvent`.
3. `SELECT pg_notify('task_events', <json>)` via `$executeRaw`, so the
   notification is sent only if the transaction commits.

The payload is `{ event, task }` as JSON (well under Postgres's 8000-byte
limit, given the 100-char name cap). Nothing broadcasts to SSE clients
directly; every process — including the one that wrote — learns of the change
from `LISTEN`, so there is a single path to viewers.

## Cross-process listener

Each process holds one dedicated `pg.Client` (not from the pool) doing
`LISTEN task_events`. On each notification it:

- forwards `{ event, task }` to its local SSE subscribers;
- on `running`: arms a local timer for `endsAt − now`;
- on `finished`/`cancelled`: clears its local timer for that task.

It remembers the highest event id it has seen. If the connection drops, it
reconnects with backoff, then catches up: reads events with `id > lastSeen`
and processes them as above, then re-arms timers for all running tasks.

## Timers and recovery

At startup, in this order: start `LISTEN` → read all `running` tasks → for each,
if `endsAt ≤ now` call `recordTransition(id, 'running', 'finished')`, else arm
a timer. Listening first means no change between the read and the listen is
missed. When a timer fires, the process calls the same transition; losing the
race (`null`) is normal and silent.

Cancel calls `recordTransition(id, 'running', 'cancelled')`; `null` → 409.

On shutdown (`enableShutdownHooks`): clear all timers and keep-alive intervals,
end open streams, release the listener client.

## HTTP API

| Method & path | Body | Success | Errors |
|---|---|---|---|
| `POST /api/tasks` | `{ name, durationSeconds }` | 201 `Task` | 400 validation |
| `GET /api/tasks` | — | 200 `{ tasks: Task[], lastEventId: number \| null }`, newest `startedAt` first | — |
| `GET /api/tasks/:id/events` | — | 200 `TaskEvent[]`, oldest first | 400 bad uuid, 404 |
| `POST /api/tasks/:id/cancel` | — | 200 `Task` | 400 bad uuid, 404, 409 not running |
| `GET /api/tasks/stream` | — | SSE | — |

`Task` JSON: `id, name, durationSeconds, state, startedAt, endsAt, updatedAt`
(ISO timestamps). `TaskEvent` JSON: `id, taskId, state, at`.

Validation via Nest `ValidationPipe`: `name` string, trimmed, 1–100 chars;
`durationSeconds` integer 1–86400. Errors use Nest's default JSON error shape.

`lastEventId` in the list response closes the gap between loading the list and
opening the stream: the client passes it as `?after=` on the stream.

CORS allows the origin in `FRONTEND_ORIGIN`.

## SSE stream

Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`,
`Connection: keep-alive`, `X-Accel-Buffering: no`; headers flushed immediately.

Each message:

```
id: 57
event: task
data: {"event":{"id":57,"taskId":"…","state":"finished","at":"…"},"task":{…}}

```

Keep-alive: a comment line `: ping` every 15 s.

Connecting:

1. Register the subscriber in the process's in-memory set, buffering live events.
2. Resume point = `Last-Event-ID` header, else `?after=`, else none.
3. If there is one, send every event with `id >` it, oldest first, each with
   the task's current row. Then flush the buffer, skipping ids already sent.
4. From then on, send live events as they arrive.

On request `close`: remove the subscriber and clear its keep-alive interval.
Log the subscriber count on each connect and disconnect (check 4 reads it).

## Running it

- `docker-compose.yml` at the repo root: `postgres` (named volume, port 5432)
  always; a `multi` profile adds two backend containers on ports 3001 and 3002.
- `npm run start:dev` in `/backend` (port 3000) works on its own: a
  `prestart:dev` script runs `docker compose up -d --wait postgres` and
  `prisma migrate deploy` first. That way `stream-verifier`, which only runs
  `npm run start:dev`, never fails for setup reasons.
- Timers the verifier creates stay in the dev database. That's acceptable for
  a practice project; `docker compose down -v` wipes it.
- Config from env: `DATABASE_URL`, `PORT`, `FRONTEND_ORIGIN`; `.env.example`
  committed.

## Testing

- Jest (Nest default). Integration tests run against the compose Postgres
  using a separate test database, reset between tests.
- Multi-process behaviour is tested by starting two Nest app instances in one
  test process against the same database: an event created on one reaches a
  stream on the other; closing one still lets the other finish its timers.
- Race tests: cancel exactly at `endsAt`, and two instances finishing the same
  task — exactly one event recorded each time. Many concurrent transitions
  across two instances — event ids arrive at every stream strictly
  increasing, with no gaps among committed events.
- `stream-verifier` runs after any task touching the tasks service, the stream
  endpoint or (later) the frontend stream hook.

## Left to the builder

- Module/file layout inside `/backend`, naming, and logging setup.
- Backoff timings for the listener reconnect.
- How the test database is created and reset.
