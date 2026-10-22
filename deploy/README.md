# Deploying to a DigitalOcean Droplet

The whole app runs on one Droplet with Docker Compose
([compose.prod.yml](compose.prod.yml)):

- **caddy**: the built frontend plus a reverse proxy for `/api`, on 80/443,
  with an automatic Let's Encrypt certificate ([frontend/Caddyfile](../frontend/Caddyfile)).
- **backend**: the NestJS image; runs migrations on start. Not published.
- **postgres**: Postgres 18 in the `pgdata` volume. Not published.

Every push to `main` runs [.github/workflows/deploy.yml](../.github/workflows/deploy.yml):
tests → both images built and pushed to GHCR → SSH into the Droplet as
`deploy`, write `/opt/1337/compose.yml` and `/opt/1337/.env`, pull, restart →
smoke check `https://$SITE_ADDRESS/api`. Nothing is built on the Droplet.

Until the setup below is done, the deploy job fails with a message listing
what is missing; the test and build jobs still run.

## One-time setup

Commands run on your Mac from the repo root unless noted. `IP` is the
Droplet's IPv4, `app.example.com` your hostname.

### 1. Two SSH keys

```bash
# Your login key: keep it on your Mac, give it a passphrase.
ssh-keygen -t ed25519 -f ~/.ssh/1337_droplet -C "1337 droplet login"

# The CI key: no passphrase (it lives in GitHub Secrets). Make it somewhere temporary.
mkdir -p /tmp/1337-ci && ssh-keygen -t ed25519 -N '' -f /tmp/1337-ci/ci_key -C "github-actions deploy"
```

### 2. Create the Droplet

In the DigitalOcean console: **Create → Droplets**

- Region: Frankfurt (FRA1) or Amsterdam (AMS3)
- Image: Ubuntu 24.04 LTS
- Size: Basic, Regular, **1 GB / $6** (nothing is built on it; 2 GB / $12 if you want headroom)
- Authentication: **SSH key**, add `~/.ssh/1337_droplet.pub`

### 3. Cloud Firewall

**Networking → Firewalls → Create**, apply it to the Droplet:

| Inbound | Ports | Sources |
|---|---|---|
| SSH | TCP 22 | All IPv4, All IPv6 |
| HTTP | TCP 80 | All IPv4, All IPv6 |
| HTTPS | TCP 443 | All IPv4, All IPv6 |
| Custom | UDP 443 (HTTP/3) | All IPv4, All IPv6 |

Outbound: leave the defaults (all). This firewall sits outside the VM, so
Docker can't open holes in it the way it can with `ufw`.

### 4. DNS

At your DNS provider, add an `A` record `app.example.com → IP` (and an
`AAAA` to the Droplet's IPv6 if you enabled it). Caddy can only get a
certificate once this resolves:

```bash
dig +short app.example.com
```

### 5. Bootstrap the Droplet

Read [bootstrap.sh](bootstrap.sh) first, then:

```bash
ssh -i ~/.ssh/1337_droplet root@IP "CI_PUBKEY='$(cat /tmp/1337-ci/ci_key.pub)' bash -s" < deploy/bootstrap.sh
```

It installs Docker, adds 1 GB swap, creates `deploy` (in the `docker` group,
no sudo) with your login key and the CI key, creates `/opt/1337`, and turns
off root login and password login.

Check from your Mac:

```bash
ssh -i ~/.ssh/1337_droplet deploy@IP 'docker ps'   # works
ssh -i ~/.ssh/1337_droplet root@IP                 # Permission denied
```

### 6. GitHub Secrets and Variables

With the [GitHub CLI](https://cli.github.com), from the repo:

```bash
gh secret set DROPLET_HOST --body IP
gh secret set DROPLET_SSH_KEY < /tmp/1337-ci/ci_key
ssh-keyscan -t ed25519 IP | gh secret set DROPLET_KNOWN_HOSTS
openssl rand -hex 32 | gh secret set POSTGRES_PASSWORD
gh variable set SITE_ADDRESS --body app.example.com
rm -rf /tmp/1337-ci
```

Optional variables: `POSTGRES_USER` and `POSTGRES_DB` (both default to
`tasks`). Postgres only takes the password when `pgdata` is first created;
to change it later, see [Reset the database](#reset-the-database).

### 7. First deploy

```bash
gh workflow run deploy.yml --ref main
gh run watch
```

Then open `https://app.example.com`.

## Day to day

- **Deploy**: push to `main`, or `gh workflow run deploy.yml --ref main`.
- **Logs**: `ssh deploy@IP 'cd /opt/1337 && docker compose logs -f --tail 100'`
- **Status**: `ssh deploy@IP 'cd /opt/1337 && docker compose ps'`
- **Roll back**: re-run an older successful deploy run in the Actions tab;
  each run pins its own commit's images.

### Reset the database

Deletes all tasks:

```bash
ssh deploy@IP 'cd /opt/1337 && docker compose down && docker volume rm leet_pgdata'
gh workflow run deploy.yml --ref main
```

## Teardown

1. **Destroy** the Droplet (a powered-off Droplet is still billed).
2. Delete the Cloud Firewall.
3. Remove the DNS record.
4. `gh secret delete DROPLET_SSH_KEY`, `DROPLET_KNOWN_HOSTS`, `DROPLET_HOST`,
   `POSTGRES_PASSWORD`; `gh variable delete SITE_ADDRESS`.
5. Disable the workflow so pushes stop failing: `gh workflow disable deploy.yml`.
6. Optional: delete the `1337_prep-web` and `1337_prep-backend` packages
   under your GitHub profile → Packages.

## Running the production stack locally

```bash
docker build -t local/1337-backend:dev backend
docker build -t local/1337-web:dev frontend
printf '%s\n' POSTGRES_USER=tasks POSTGRES_PASSWORD=local POSTGRES_DB=tasks \
  SITE_ADDRESS=localhost IMAGE_PREFIX=local/1337 IMAGE_TAG=dev > /tmp/1337-prod.env
docker compose -f deploy/compose.prod.yml --env-file /tmp/1337-prod.env -p leet-local up -d --wait
```

Open https://localhost (Caddy's own certificate; the browser warns). Stop
with `docker compose -p leet-local down -v`.
