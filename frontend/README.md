# frontend

The 1337-styled live timer desk for the task streaming backend.

Design: [task streaming frontend spec](../docs/superpowers/specs/2026-10-22-task-streaming-frontend-design.md).

## Requirements

Node ≥ 20.19 (24 preferred). `.npmrc` sets `legacy-peer-deps=true` because npm 10.8 crashes resolving Vite 8 peers.

## Development

Start the backend first. From the repo root:

```bash
cd backend && npm run start:dev
```

It serves on `:3000`. Then, in another shell:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to `BACKEND_URL` (default `http://localhost:3000`), so no CORS setup is needed in dev.

## Several processes

With the backend's `multi` compose profile running (ports 3001 and 3002), this opens a second desk on another process:

```bash
BACKEND_URL=http://localhost:3002 npm run dev -- --port 5174
```

Timers started in one desk appear in the other.

## Scripts

- `dev`: Vite dev server on :5173
- `build`: type check, then production build
- `test`: unit tests (vitest)
- `lint`: oxlint over `src/`
- `format`: prettier over the project

## Fonts

Free stand-ins (Playfair Display, Inter, DM Mono) load from Google Fonts. The font stacks list PP Editorial Old and General Sans first, so licensed files added with `@font-face` take over with no other change. Playfair only goes down to 400, so headlines look slightly heavier than the real site.

## Layout of `src/`

- `api/`: REST client and the shared types for the backend's task endpoints.
- `stream/`: the task stream hook with replay, dedup and resync, plus its reducer.
- `time/`: countdown and progress helpers, and the clock hook.
- `components/`: the timer windows, start form, live log, archive and history.
- `styles/`: design tokens and base styles.
