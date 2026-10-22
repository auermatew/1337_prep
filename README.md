# 1337_prep

A live timer desk: start a named task with a duration, watch it count down, and
see every start, finish and cancel stream in as it happens, across browser tabs
and across backend processes. The UI follows a design system modelled on
[1337.partners](https://1337.partners/en).

- **`backend/`**: NestJS + Prisma + Postgres. A REST API plus a resumable
  Server-Sent Events stream. Several processes can share one database.
  See [backend/README.md](backend/README.md).
- **`frontend/`**: React + Vite. The desk itself, with timer windows, a live
  log, an archive and per-task history. See [frontend/README.md](frontend/README.md).
- **`design-system/`**: tokens (`tokens.css`, `tokens.json`), motion notes and
  HTML previews of the 1337 style. See [design-system/README.md](design-system/README.md).
- **`deploy/`**: production on one DigitalOcean Droplet behind Caddy, deployed
  by GitHub Actions on every push to `main`. See [deploy/README.md](deploy/README.md).

## Requirements

- Node 24 (`.nvmrc` in the root, `backend/` and `frontend/`)
- Docker, for Postgres 18

## Quick start

Start the backend. It creates `backend/.env` from `.env.example`, starts
Postgres with docker compose, applies migrations and serves on `:3000` under
`/api`:

```bash
cd backend
npm install
npm run start:dev
```

In a second shell, start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the backend, so no CORS
setup is needed in development.

## Two backend processes

To see changes cross from one process to another, run two backend containers
against the same Postgres (from the repo root):

```bash
docker compose --profile multi up -d --build --wait
```

backend-1 listens on `:3001` and backend-2 on `:3002`. Point a second desk at
backend-2:

```bash
cd frontend
BACKEND_URL=http://localhost:3002 npm run dev -- --port 5174
```

A timer started in one desk appears in the other.

## Tests

| Where | Command | What it runs |
|---|---|---|
| `backend/` | `npm test` | unit tests |
| `backend/` | `npm run test:e2e` | e2e tests against the `tasks_test` database (starts Postgres itself) |
| `frontend/` | `npm test` | unit tests |

Both packages also have `npm run lint` and `npm run build`.

## Deployment

Live at https://1337.mateauer.me. Everything runs on one DigitalOcean Droplet
as a single Docker Compose stack: Caddy (the built frontend, the `/api` proxy
and a free Let's Encrypt certificate), the backend and Postgres.

How it was set up:

1. Rented the Droplet with a personal SSH key for root, and made a second,
   separate key for GitHub Actions.
2. Pointed an `A` record for the subdomain at the Droplet.
3. Ran [deploy/bootstrap.sh](deploy/bootstrap.sh) once as root. It adds 1 GB
   of swap, installs Docker, creates a `deploy` user (in the `docker` group,
   no sudo) that accepts both keys, and turns off root and password login.
   Afterwards root was refused and `deploy` could run `docker ps`.
4. Stored the Droplet IP, the CI key, the Droplet's host key and the Postgres
   password as repository secrets, and the hostname as the `SITE_ADDRESS`
   variable.

Every push to `main` runs [deploy.yml](.github/workflows/deploy.yml): tests,
both images built into GHCR, SSH in as `deploy`, pull and restart, then a
smoke check. Postgres keeps its data in the `pgdata` volume, so a deploy never
recreates the database; the backend only applies new migrations. The full
runbook is in [deploy/README.md](deploy/README.md).

## Repository layout

```
backend/          NestJS service, Prisma schema and migrations, e2e tests
frontend/         React + Vite app
design-system/    1337 tokens, motion notes and previews
docker/           Postgres init script (creates tasks_test)
docker-compose.yml  Postgres, plus the two-process `multi` profile
deploy/           production compose file, Droplet bootstrap script, runbook
.github/workflows/  test, build and deploy on push to main
docs/superpowers/ design specs and implementation plans
.claude/          Claude Code skills and agents used to build this
```

## Design docs

- [Task streaming backend](docs/superpowers/specs/2026-10-22-task-streaming-backend-design.md)
- [Task streaming frontend](docs/superpowers/specs/2026-10-22-task-streaming-frontend-design.md)
- [1337 design system](docs/superpowers/specs/2026-10-22-1337-design-system-design.md)

Implementation plans are in [docs/superpowers/plans/](docs/superpowers/plans/).

## Resetting

`docker compose down -v` from the repo root stops Postgres and drops the
`pgdata` volume, which wipes all tasks.
