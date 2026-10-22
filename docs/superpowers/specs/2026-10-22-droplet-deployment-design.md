# Droplet deployment

## Intent

Put the whole app (React frontend, NestJS backend, Postgres) on the internet
for a short-lived demo, on one DigitalOcean Droplet, and destroy it afterwards
for a bill of cents. Every push to `main` redeploys on its own. The repo is
public, so nothing secret may live in it.

The starting point was a friend's outline (one VM, frontend in compose,
non-root user, root login off, separate login and CI SSH keys, CI secrets in
GitHub Secrets, firewall, destroy after the demo). This design keeps that
outline and fixes the parts that would break, listed under Approaches.

## Goals

- `git push` to `main` → tests, images built, Droplet updated, no manual step.
- One HTTPS origin: the frontend at `/`, the API and its SSE stream at `/api`.
- No credential in the repo. CI-side secrets in GitHub Secrets; the Postgres
  password also lives there and is written to the Droplet by the deploy job.
- Hardened SSH: key-only, no root login, a non-root `deploy` user.
- Postgres never reachable from the internet.
- A written runbook the user follows once to set the Droplet up, and a
  teardown checklist.

## Non-goals

- High availability, more than one backend instance, backups, staging or
  preview environments, monitoring/alerting, log shipping.
- Infrastructure as code (Terraform, doctl scripts). The Droplet is made by
  hand in the DigitalOcean console following the runbook.
- Zero-downtime deploys. A few seconds of downtime on deploy is fine; the
  frontend's stream reconnects and resumes from `lastEventId`.

## Anti-goals

- A secret committed to the repo or printed in a public Actions log.
- Postgres or the backend port exposed on the Droplet's public IP.
- Building images on the Droplet (the out-of-memory kills the friend warned
  about).
- Changing how local development works (`docker-compose.yml`, `npm run
  start:dev`, the e2e tests stay as they are).

## Constraints

- Frontend calls relative `/api/...` (`frontend/src/api/client.ts`,
  `useTaskStream.ts`); backend has global prefix `api` and answers `GET /api`
  for health. Frontend and API must share one origin.
- Backend image already exists (`backend/Dockerfile`); it runs
  `prisma migrate deploy` before `node dist/main`, so migrations need no extra
  step. Shutdown waits up to ~20 s for in-flight transitions.
- SSE stream at `/api/tasks/stream` with `: ping` every 15 s
  (`STREAM_KEEPALIVE_MS`); the proxy must not buffer it.
- Postgres 18, credentials from `POSTGRES_USER` / `POSTGRES_PASSWORD` /
  `POSTGRES_DB`; Postgres applies the password only when its volume is first
  created.
- Node 24 (`.nvmrc`). Frontend build: `npm run build` (`tsc -b && vite
  build`) → `frontend/dist`, including `public/transcripts/*.md` and images.
- Repo `auermatew/1337_prep` is public; default branch `main`.

## Approaches

1. **Everything on the Droplet behind Caddy (chosen).** Caddy serves the built
   frontend and reverse-proxies `/api` to the backend on one HTTPS origin. No
   code changes, the stream talks to Caddy directly, one thing to run and
   destroy. Costs: no CDN, no per-PR previews.
2. **Frontend on Vercel, `/api` rewritten to the Droplet.** Free CDN and
   previews, smaller Droplet. Costs: two platforms, the Droplet still needs
   HTTPS, and Vercel documents no limits for long-lived streams through
   external rewrites, so the SSE path is unproven.
3. **Frontend on Vercel calling the Droplet directly.** Needs an API base-URL
   change and CORS. Only worth it if 2's proxy misbehaved. Dropped.

The user picked 1.

Within 1, two places to build images were considered: on the Droplet
(friend's outline, needs a 2 GB VM, `COMPOSE_PARALLEL_LIMIT=1` and swap to
avoid OOM) and in GitHub Actions pushing to GitHub Container Registry (GHCR),
the Droplet only pulling. **Chosen: build in Actions** (my call) — no OOM
risk, faster deploys, the Droplet needs neither the source nor a GitHub
deploy key.

Corrections to the friend's outline, all adopted here:

- "Serve over a few ports" → one Caddy on 80/443; separate ports would break
  the frontend's relative `/api` calls.
- Docker bypasses `ufw` for published ports → use a DigitalOcean Cloud
  Firewall (outside the VM) and publish only Caddy's ports.
- SSH keys don't expire → "short-lived" means the CI key is deleted at
  teardown.
- No user password in GitHub Secrets: key-only login. The `deploy` user is in
  the `docker` group (root-equivalent; accepted for a throwaway demo box) and
  has no sudo.
- A powered-off Droplet is still billed → teardown means destroy.

## Design

### Runtime on the Droplet

Directory `/opt/1337` owned by `deploy`, holding `compose.yml` (copied from
the repo by each deploy) and `.env` (written by each deploy, mode 600).

`deploy/compose.prod.yml` in the repo, three services:

- **caddy** — image `ghcr.io/auermatew/1337_prep-web:<sha>`. Publishes
  `80:80`, `443:443`, `443:443/udp`. Volumes `caddy_data`, `caddy_config`
  (certificates survive redeploys). Env `SITE_ADDRESS`. Restart
  `unless-stopped`.
- **backend** — image `ghcr.io/auermatew/1337_prep-backend:<sha>`. No
  published ports. Env `DATABASE_URL` built from the `POSTGRES_*` vars,
  `PORT=3000`, `STREAM_KEEPALIVE_MS=15000`, no `FRONTEND_ORIGIN` (same origin,
  so no CORS headers). `init: true`, `stop_grace_period: 25s`, healthcheck as
  in `docker-compose.yml`, `depends_on: postgres: service_healthy`.
- **postgres** — `postgres:18`, no published ports, volume `pgdata`,
  healthcheck as in `docker-compose.yml`, `POSTGRES_*` with `:?` guards.

Images are referenced as `${IMAGE_PREFIX}-web:${IMAGE_TAG}` etc. so the
deploy job pins the exact commit.

### Web image (`frontend/Dockerfile`)

Two stages: `node:24-slim` runs `npm ci` and `npm run build`; `caddy:2`
copies `dist/` to `/srv` and the Caddyfile (below) to
`/etc/caddy/Caddyfile`. Build context is the repo root so the Caddyfile can
live under `deploy/`, or the Caddyfile lives in `frontend/` — builder's
choice; keep the frontend's dev setup untouched either way.

### Caddyfile

```
{$SITE_ADDRESS} {
	encode zstd gzip
	handle /api* {
		reverse_proxy backend:3000 {
			flush_interval -1
		}
	}
	handle {
		root * /srv
		try_files {path} /index.html
		file_server
	}
}
```

`SITE_ADDRESS` is the hostname; Caddy gets a Let's Encrypt certificate for
it automatically. Without a domain, use `<ip-with-dashes>.sslip.io` (a free
wildcard DNS name that resolves to the IP), which Let's Encrypt accepts.
For a local smoke test, `SITE_ADDRESS=localhost` makes Caddy use its own
local certificate.

### CI/CD (`.github/workflows/deploy.yml`)

Triggers: push to `main`, plus `workflow_dispatch`. `concurrency: deploy`
so two pushes don't deploy at once.

1. **test** — Node 24; backend `npm ci && npm test`; frontend `npm ci &&
   npm run lint && npm test && npm run build`. (Backend e2e needs Postgres;
   left out of CI — builder may add a Postgres service container if cheap.)
2. **build** (needs test) — `docker/login-action` to GHCR with
   `GITHUB_TOKEN`, `docker/build-push-action` for both images, tags `<sha>`
   and `latest`, GitHub Actions layer cache. Permissions `packages: write`.
3. **deploy** (needs build) — copy `deploy/compose.prod.yml` to
   `/opt/1337/compose.yml` and run, over SSH as `deploy`:
   write `/opt/1337/.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`,
   `POSTGRES_DB`, `SITE_ADDRESS`, `IMAGE_PREFIX`, `IMAGE_TAG`), `docker login
   ghcr.io` with the job's short-lived `GITHUB_TOKEN`, `docker compose pull`,
   `docker compose up -d --wait`, `docker image prune -f`. Then
   `curl -fsS https://$SITE_ADDRESS/api` from the runner as a smoke check.
   Use `appleboy/ssh-action` / `appleboy/scp-action` (pinned versions) or
   plain `ssh` with a written key and `known_hosts` — builder's choice, but
   the host key must be pinned (no `StrictHostKeyChecking=no`).

Secrets never echoed; the `.env` is written via a heredoc inside the SSH
script from env vars passed to the action, not interpolated into the logged
command line.

GitHub Secrets:

| Secret | What |
|---|---|
| `DROPLET_HOST` | Droplet IPv4 |
| `DROPLET_SSH_KEY` | Private half of the CI key (no passphrase) |
| `DROPLET_KNOWN_HOSTS` | `ssh-keyscan` line for the Droplet, to pin its host key |
| `POSTGRES_PASSWORD` | Long random value |

GitHub Variables (not secret): `SITE_ADDRESS`, `POSTGRES_USER`
(`tasks`), `POSTGRES_DB` (`tasks`).

### Keys

- **Login key** — the user's own, ed25519 with a passphrase, kept on their
  Mac, added to the Droplet at creation. Used by the user only.
- **CI key** — a separate ed25519 key without passphrase (a passphrase stored
  next to the key in Secrets adds nothing), only in `deploy`'s
  `authorized_keys` and in GitHub Secrets. Deleted at teardown.

### Droplet setup (runbook, `deploy/README.md`)

Done once by the user, walked through together:

1. Create the Droplet: Ubuntu 24.04 LTS, Basic, region FRA1 or AMS3, add the
   login key. Size: **1 GB / $6** (my call:
   nothing builds on it; postgres + node + caddy fit, plus 1 GB swap). The
   friend's 2 GB / $12 is the safe choice if they prefer.
2. Cloud Firewall attached to the Droplet: inbound TCP 22, 80, 443 and UDP
   443 from anywhere; all outbound.
3. `ssh root@IP`, run `deploy/bootstrap.sh` (in the repo, read before
   running): apt upgrade, unattended-upgrades, 1 GB swap file, Docker Engine
   from Docker's apt repo, user `deploy` in group `docker` with the login key
   and CI key in `authorized_keys`, `/opt/1337` owned by `deploy`, an sshd
   drop-in `PermitRootLogin no`, `PasswordAuthentication no`,
   `KbdInteractiveAuthentication no`, then reload sshd.
4. From a second terminal confirm `ssh deploy@IP` works before closing the
   root session.
5. Add the GitHub Secrets and Variables, run the workflow by hand
   (`workflow_dispatch`), open `https://SITE_ADDRESS`.

### Teardown (also in the runbook)

Destroy the Droplet (not power off), delete the Cloud Firewall, delete the
CI key's Secrets, optionally delete the GHCR packages, remove the DNS record
if a domain was used. The workflow then fails on push until disabled; disable
it or delete `DROPLET_HOST` deliberately.

## Verification

- Locally: build both images, `docker compose -f deploy/compose.prod.yml up`
  with `SITE_ADDRESS=localhost` and local image tags; check `/` serves the
  app, client-side routes fall back to `index.html`, `/transcripts/*.md`
  serve, `GET /api` is 200, creating a task works, and the SSE stream
  delivers events with no buffering (`curl -N`). Confirm `docker compose
  ps` shows no published port but 80/443.
- Live: workflow green; `https://SITE_ADDRESS` loads; a task runs to
  completion with live updates; `nc -z IP 5432` and `:3000` fail from
  outside; `ssh root@IP` refused; password login refused.

## Settled during review (my calls)

- `POSTGRES_PASSWORD` is generated URL-safe (`openssl rand -hex 32`), since
  it is embedded in `DATABASE_URL`.
- GHCR image names are lowercase (`ghcr.io/auermatew/1337_prep-web`, `-backend`).
- The deploy job has `packages: read` for its `docker login`; build has
  `packages: write`.
- The post-deploy smoke check retries for ~2 minutes: the first deploy waits
  on Let's Encrypt.
- The workflow's deploy job checks that `DROPLET_HOST` is set and fails
  with a clear message otherwise, so the push to `main` before setup fails
  plainly.
- The web image gets a `.dockerignore` if its context is the repo root
  (keep out `node_modules`, `.git`, `.env*`).
- Prod Postgres mounts `pgdata` at `/var/lib/postgresql`, as the dev compose
  does (what Postgres 18 expects).

## Left to the builder

- Exact action versions, cache settings, image labels.
- Where the Caddyfile lives and the web image's build context.
- Whether CI runs backend e2e with a Postgres service container.
- bootstrap.sh details beyond the list above.
