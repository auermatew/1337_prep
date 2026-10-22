# 1337_prep

This project uses the vendored superpowers skills in `.claude/skills/`.

At the start of every session, invoke the `using-superpowers` skill and follow it.
New features go through `brainstorming` → `writing-plans` → `executing-plans`
(or `subagent-driven-development`). Specs live in `docs/superpowers/specs/`,
plans in `docs/superpowers/plans/`.

## Backend commands (run in `backend/`, Node 24)

- Start: `npm run start:dev` (starts Postgres 18 via docker compose, applies migrations, serves on :3000 under `/api`)
- Test: `npm run test:e2e` (uses the `tasks_test` database from `.env.test`)
- Reset the database: `docker compose down -v` (from the repo root; drops the `pgdata` volume)
