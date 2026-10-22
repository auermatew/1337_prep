# 1337_prep

This project uses the vendored superpowers skills in `.claude/skills/`.

At the start of every session, invoke the `using-superpowers` skill and follow it.
New features go through `brainstorming` → `writing-plans` → `executing-plans`
(or `subagent-driven-development`). Specs live in `docs/superpowers/specs/`,
plans in `docs/superpowers/plans/`.

## Backend commands (run in `backend/`, Node 24)

- Start: `npm run start:dev` (creates `backend/.env` from `.env.example` if missing, starts Postgres 18 via docker compose, applies migrations, serves on :3000 under `/api`)
- Test: `npm run test:e2e` (uses the `tasks_test` database from `.env.test`)
- Reset the database: `docker compose down -v` (from the repo root; drops the `pgdata` volume)
- Two processes (cross-process streaming check): `docker compose --profile multi up -d --build --no-deps backend-1 backend-2` (from the repo root; backend-1 on :3001, backend-2 on :3002, same Postgres, both run `prisma migrate deploy` first). Stop them with `docker compose --profile multi stop backend-1 backend-2` and `docker compose --profile multi rm -f backend-1 backend-2`. Never use `docker compose down` unless you mean to.
