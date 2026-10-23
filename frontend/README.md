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

## Looks

The page has two looks: the classic 1337 desk and Moonrise, a black and silver night ([design](../docs/superpowers/specs/2026-10-23-moonrise-look-switch-design.md), [design system](../design-system-moonrise/README.md)). The button in the bottom-right corner switches between them. On the classic side it is a moon, and in the night it is a sun.

- The choice is saved in `localStorage['1337.look']`. `?look=moon` or `?look=classic` in the URL wins for that visit, but only a click on the button is remembered.
- `App` keeps the one task stream, so switching never reconnects or empties the feed.
- Moonrise (its code, styles, fonts and photos) downloads only on the first switch. Hovering or focusing the moon button starts that download early.
- While it loads, the red `1337` display scrambles over the night. Once Moonrise is cached, later switches are quicker.
- `src/moonrise/moonrise.generated.css` comes from the design system. After changing `design-system-moonrise/tokens.css` or `components/bundle.css`, regenerate it from the repo root:

```bash
python3 frontend/scripts/scope-moonrise-css.py design-system-moonrise/tokens.css design-system-moonrise/components/bundle.css > frontend/src/moonrise/moonrise.generated.css
```

## Layout of `src/`

- `api/`: REST client and the shared types for the backend's task endpoints.
- `stream/`: the task stream hook with replay, dedup and resync, plus its reducer.
- `time/`: countdown and progress helpers, and the clock hook.
- `logic/`: what both looks share: start, cancel, history, archive and transcript hooks, with problems as kinds that each look words itself.
- `look/`: which look is shown, the corner switch, and the transition between looks.
- `components/` and `ClassicLook.tsx`: the classic look.
- `moonrise/`: the Moonrise look, loaded lazily. `moonrise/clock/` holds the seven-segment display, which the transition uses too, so it lives in the main bundle.
- `styles/`: design tokens and base styles.
