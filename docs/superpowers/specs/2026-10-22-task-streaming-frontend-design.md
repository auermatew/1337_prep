# Task Streaming Frontend — Design

Date: 2026-10-22
Status: approved in conversation ("Implement it")
Scope: the frontend for the task streaming backend
(`2026-10-22-task-streaming-backend-design.md`), styled with the 1337 design
system (`design-system/`).

## Intent

The backend's point is streaming: many viewers, live state changes, replay on
reconnect. The frontend makes that visible and does it in the 1337 look, which
is the main event: a showpiece of the design system, not a bare test console.
It is built in parallel with backend Tasks 4–7, so it must be usable before the
real stream endpoint exists.

## Goals

- Start a timer (name + seconds), see every timer count down live, cancel a
  running one, open any timer's state history.
- Stay correct against the stream: initial list, then `?after=lastEventId`;
  events applied in id order; duplicates skipped; browser reconnect resumes
  through `Last-Event-ID` without a reload.
- Show the stream itself: a `live.log` window with the raw events and the
  connection state.
- Look unmistakably 1337: editorial serif, mono labels, one purple, Mac-style
  windows with hard shadows, stepped motion.

## Non-goals

- Auth, routing, multiple pages, deleting timers, pagination.
- Server rendering, a production deploy, Docker for the frontend.
- A component library beyond what this page needs.

## Anti-goals

- A timer shown in a state the server doesn't hold (e.g. still counting after
  `finished` arrived, or an old event overwriting a newer one).
- A countdown driven by the stream (there are no ticks; it comes from `endsAt`).
- The desk buried under old `sv-` timers from verifier runs.
- Generic dashboard styling: rounded cards, soft shadows, blue-grey, extra accents.

## Constraints

- Lives in `frontend/` at the repo root, on branch `feature/frontend` (own
  worktree). Never edits `backend/`.
- Node 24. Vite + React + TypeScript; oxlint + prettier + Vitest like the backend.
- Plain CSS on the design-system tokens (copied from `design-system/tokens.css`).
  No Tailwind, no CSS-in-JS.
- Backend contract exactly as in the backend design; `TaskDto`/`TaskEventDto`
  match `backend/src/tasks/task.types.ts`.

## Approaches

1. **Vite + React + TS SPA with a `useTaskStream` hook — chosen.** Lightest
   setup, the hook is the unit the `stream-verifier` agent already names, Vite's
   proxy removes CORS in dev, and the motion CSS pastes in directly.
2. Next.js — server rendering adds nothing to a live page and proxying SSE
   through it is awkward.
3. Vanilla HTML/JS — smallest, but hand-rolls list + stream + reconnect state,
   the part most worth getting right, and has no hook to verify.

Layout: three mockups were shown (desk, terminal, departures board); **the
desk** was picked.

## The page (the desk)

Top to bottom, inside the 1240px wrap:

1. **Header**: mono wordmark `1337 · TIMERS`, and the connection label on the right.
2. **Section opener**: tag `01 · TIMERS`, serif headline "Start a *timer.*"
   (one word purple), one lead line.
3. **Start form**: name and seconds inputs (underline style, mono labels), solid
   `START TIMER →` button. Client-side checks mirror the server (name trimmed
   1–100 chars, seconds integer 1–86400); a 400 from the server is shown too.
   Errors are a mono line under the form, never a popup.
4. **Main row**: a grid of **timer windows** for running timers (left), and the
   **`live.log` window** (right, ~320px). At phone width: one column,
   `live.log` below the grid.
5. **Archive**: finished and cancelled timers in a compact mono table (name,
   state, duration, ended at, `HISTORY ↓`), newest first. It replaced
   "every timer is a window" so verifier leftovers don't flood the desk.
   *(Builder's call)* It shows the newest 20 rows with a `SHOW ALL (n)` toggle,
   so hundreds of `sv-` rows don't make the page endless.

### Timer window

- Title bar: close box, pinstripes, `<name>.tmr` in `mono-window`.
- State line: `● running` in purple (blinking dot).
- Big serif countdown `mm:ss` (`h:mm:ss` from one hour), computed locally from
  `endsAt` and refreshed by one shared ~250 ms clock, never below zero.
- Stepped loader bar (19 steps) showing elapsed / duration.
- Footer: `ENDS 13:37:00` and a `CANCEL` action; a 409 shows as a mono line in
  the window. While a cancel is in flight the action is disabled.
- New windows enter with the scroll-reveal motion. When a timer finishes or is
  cancelled, the window plays `leetflash` briefly, then moves to the archive.
- When the countdown hits zero before `finished` arrives, the window shows
  `00:00` and `finishing…`; it never marks itself finished on its own.

### History

`HISTORY ↓` (in the archive, and a small toggle in running windows) fetches
`GET /api/tasks/:id/events` and shows a mono meta table (`#58  running
13:34:19`), with the 0.35s swap motion. It refetches when a new event for that
task arrives while open.

### `live.log`

- One line per stream message, oldest at the top: `#59 pasta cancelled`,
  keeping the last 50, ending with the blinking orange cursor.
- Footer: `● CONNECTED · LAST ID 59`, `CONNECTING…` or `RECONNECTING…` with the
  stepped loader. A replayed batch after reconnect prints like live lines.

## Data flow: `useTaskStream`

State: `tasks: Map<id, TaskDto>`, `lastEventId`, `status`
(`connecting | open | reconnecting`), `log` (last 50 changes).

1. `GET /api/tasks` → fill the map, remember `lastEventId`.
2. Open `new EventSource('/api/tasks/stream' + (lastEventId ? '?after=N' : ''))`.
   Listen for the named event `task`.
3. For each message: parse `{ event, task }`. If `event.id <= lastEventId`, skip
   (duplicate). Otherwise set `tasks[task.id] = task` (the payload carries the
   task's current row, so a task first seen on the stream is simply added),
   update `lastEventId`, append to the log.
4. `onerror`: status `reconnecting`; the browser reconnects itself and sends
   `Last-Event-ID`. `onopen`: status `open`; if this open follows an error, the
   hook reloads `GET /api/tasks` and replaces the map and `lastEventId` with it.
   *(Builder's call)* This covers a server whose ids went backwards (database
   reset with `docker compose down -v`, or a restarted in-memory mock): without
   it every new event would look like a duplicate and old timers would hang at
   `finishing…`. Events with ids above the reloaded `lastEventId` still apply.
   If the browser gives up (`readyState === CLOSED`), the hook reopens the
   stream itself after a short delay with `?after=lastEventId`.
5. On unmount: close the EventSource.

Optimistic updates are not used: create and cancel responses update the map
directly with the returned `Task` (harmless, since the stream event for the
same change carries the same row), and the stream remains the source of truth.

Server times vs local clock: the countdown uses `endsAt` against `Date.now()`;
clock skew is accepted for this project.

## API client

Thin `fetch` wrappers: `listTasks`, `createTask`, `cancelTask`, `taskEvents`.
Non-2xx responses throw an error carrying status and Nest's `message` (string or
string[]), which the UI shows in mono.

## Running it

- `npm run dev` in `frontend/` serves on :5173; Vite proxies `/api` to
  `http://localhost:3000` (override with `BACKEND_URL`). `FRONTEND_ORIGIN` in the
  backend already defaults to `http://localhost:5173`.
- The proxy must not buffer SSE (Vite's http-proxy streams by default; checked
  in verification).
- The mock was dropped because the backend was finished first, so there is no `npm run mock`.

## Fonts

Free stand-ins load from Google Fonts (Playfair Display, Inter, DM Mono). The
font stacks keep PP Editorial Old and General Sans first, so licensed files
dropped into `frontend/public/fonts` with `@font-face` take over with no other
change. Playfair only goes down to 400, so headlines look slightly heavier
than the real site.

## Motion

From `design-system/motion.md`: `ease-1337` for transforms, scroll reveal,
blink, `steps(19)` loader, `leetflash`, swap. Everything honours
`prefers-reduced-motion` with the design system's global rule.

## Testing

- **Vitest unit tests for `useTaskStream`** with a fake `EventSource` and a
  mocked `fetch`: initial load then `?after=`; no `after` when `lastEventId` is
  null; events applied in id order; duplicates and older ids skipped; a task
  first seen on the stream is added; status transitions on error/open; reopen
  after CLOSED; close on unmount.
- Unit tests for countdown formatting and the progress step calculation.
- A light component test that the running/archive split follows task state.
- Manual check in the browser against the real backend (start, watch, cancel, history,
  reconnect by restarting the mock), then against the real backend once Tasks
  5–6 are merged, plus `stream-verifier` since its scope names the frontend
  stream hook.

## Left to the builder

- File layout inside `frontend/`, component boundaries and naming.
- Exact spacing and type sizes within the design-system scale.
- Mock server internals.
