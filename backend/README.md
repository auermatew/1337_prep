# backend

NestJS + Prisma + Postgres service for timed tasks. A task runs for
`durationSeconds` and then finishes on its own, unless it is cancelled first.
Every state change is recorded as an event and pushed to clients over a REST
API plus a Server-Sent Events stream that can resume from the last event id.
Several processes can share one database: transitions are serialised by a
Postgres advisory lock, and changes fan out across processes via
`LISTEN`/`NOTIFY`, so a stream on any process sees every change.

Design: [task streaming backend spec](../docs/superpowers/specs/2026-10-22-task-streaming-backend-design.md).
The repo-root `CLAUDE.md` has the same commands in short form.

## Requirements

Node 24 and Docker. Avoid npm 11.4.2, which crashes during `npm install`.

## Development

```bash
npm install
npm run start:dev
```

`prestart:dev` copies `.env.example` to `.env` if there is none, starts
Postgres 18 with `docker compose up -d --wait postgres`, and runs
`prisma migrate deploy`. The API is then served on `:3000` under `/api`.

Reset the dev database from the repo root with `docker compose down -v` (drops
the `pgdata` volume).

## Tests

```bash
npm test          # unit tests (vitest)
npm run test:e2e  # e2e tests against the tasks_test database from .env.test
```

`pretest:e2e` starts Postgres and migrates `tasks_test`; the tests reset it
themselves.

## Two processes (`multi` profile)

From the repo root:

```bash
docker compose --profile multi up -d --build --wait
```

backend-1 listens on `:3001`, backend-2 on `:3002`, both against the same
Postgres. Inside a git worktree with Postgres already running, append
`--no-deps backend-1 backend-2` so the postgres container is not recreated.
Stop with `docker compose --profile multi stop backend-1 backend-2` and remove
with `docker compose --profile multi rm -f backend-1 backend-2`.

## Environment

| Variable | Example | Meaning |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/tasks` | Postgres connection |
| `PORT` | `3000` | HTTP port |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed CORS origin; unset sends no CORS headers |
| `STREAM_KEEPALIVE_MS` | `15000` | Interval of `: ping` comments on the stream |

## API

| Method & path | Result |
|---|---|
| `POST /api/tasks` `{ name, durationSeconds }` | 201 task |
| `GET /api/tasks` | `{ tasks, lastEventId }`, newest first |
| `GET /api/tasks/:id/events` | the task's events, oldest first |
| `POST /api/tasks/:id/cancel` | 200 task; 409 if not running |
| `GET /api/tasks/stream` | SSE; resumes after `Last-Event-ID` or `?after=` |
