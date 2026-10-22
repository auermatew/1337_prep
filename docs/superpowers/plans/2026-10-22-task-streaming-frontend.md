# Task Streaming Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-page "desk" in `frontend/` that starts, shows, cancels and inspects timers live over the backend's SSE stream, in the 1337 look.

**Architecture:** Vite + React + TypeScript SPA. A `useTaskStream` hook owns the task map, the stream connection and the log; components are dumb views over it. There is no mock: the frontend runs against the real backend through Vite's dev proxy, which flushes SSE response headers so an idle stream still opens.

**Tech Stack:** Vite 8, React 19, TypeScript 6, plain CSS on the design-system tokens, Vitest + Testing Library + jsdom, oxlint, prettier.

**Spec:** `docs/superpowers/specs/2026-10-22-task-streaming-frontend-design.md` (and the backend contract in `docs/superpowers/specs/2026-10-22-task-streaming-backend-design.md`).

## Global Constraints

- Everything lives in `frontend/`; never edit `backend/` or `design-system/`.
- Node ≥ 20.19 (Vite's floor); `frontend/.nvmrc` says `24`. ESM (`"type": "module"`). `frontend/.npmrc` sets `legacy-peer-deps=true` (npm 10.8 crashes resolving Vite 8 peers).
- Plain CSS only. `frontend/src/styles/tokens.css` is a verbatim copy of `design-system/tokens.css` and is listed in `frontend/.prettierignore` so formatting never rewrites it. No Tailwind, no CSS-in-JS, no UI library.
- Square corners; hard shadows and ghost rings are written against `var(--ink)` (`--ink-shadow-hard`, `--ink-shadow-hard-sm`, `--ink-shadow-ring` in `App.css`, because the token shadows hard-code `#111`); purple `#783ff3` the only accent; orange only for the live.log cursor. Headings serif, labels uppercase DM Mono.
- Name 1–100 chars after trim; seconds integer 1–86400.
- Dev server :5173; `/api` proxied to `process.env.BACKEND_URL ?? 'http://localhost:3000'`.
- Every animation honours `prefers-reduced-motion` (design system's global rule).
- Types `TaskDto` / `TaskEventDto` / `TaskChange` match `backend/src/tasks/task.types.ts` field for field.

## Review Focus

- **Database reset while the page is open** (`docker compose down -v`): new event ids restart below the client's `lastEventId`, and naive dedup would drop every event forever. Expected: after the stream reopens, the page resyncs from `GET /api/tasks` (holding stream events per attempt and replaying them) and works again. Test in Task 2.
- **Event for a task id the client doesn't know** (created before a reconnect, or on another process): expected to appear, not be ignored. Test in Task 2.
- **Countdown reaches zero before `finished` arrives** (or a backend is down): expected `00:00 · FINISHING…`, never negative, never self-finished. Test in Task 4 (`TimerWindow`), helpers in Task 3.
- **Long name / long duration**: a 100-char name must not break the window grid; 86400 s shows `24:00:00`. Test in Task 3 (format), CSS ellipsis checked in the browser in Task 5.
- **Double-clicked cancel / cancel racing finish**: second click ignored; a 409 shows `TASK IS NOT RUNNING` in the window, not an alert, `CANCEL` stays disabled, and the stream's state wins. Test in Task 4.

---

### Task 1: Scaffold, tokens, API client

**Files:**
- Create: `frontend/package.json`, `frontend/package-lock.json`, `frontend/index.html`, `frontend/vite.config.ts`, `frontend/tsconfig.json` (references only) + `frontend/tsconfig.app.json` (`src`, bundler mode, `noEmit`) + `frontend/tsconfig.node.json` (the Vite config)
- Create: `frontend/.oxlintrc.json` (react, typescript, oxc plugins; `rules-of-hooks` error, `only-export-components` warn), `frontend/.prettierrc` (single quotes, trailing commas), `frontend/.prettierignore` (`src/styles/tokens.css`), `frontend/.npmrc` (`legacy-peer-deps=true`), `frontend/.nvmrc` (`24`)
- Create: `frontend/src/main.tsx`, `frontend/src/styles/tokens.css`, `frontend/src/styles/base.css`
- Create: `frontend/src/api/types.ts`, `frontend/src/api/client.ts`
- Create: `.gitignore` at repo root (`node_modules`, `dist`, `.superpowers/`, `.DS_Store`, `*.tsbuildinfo`)
- Test: `frontend/src/api/client.test.ts`

**Interfaces:**
- Produces: types `TaskState = 'running'|'finished'|'cancelled'`, `TaskDto`, `TaskEventDto`, `TaskChange { event; task }`, `TaskList { tasks: TaskDto[]; lastEventId: number|null }`.
- Produces: `class ApiError extends Error { status: number; messages: string[] }`; `listTasks(): Promise<TaskList>`, `createTask(input: { name: string; durationSeconds: number }): Promise<TaskDto>`, `cancelTask(id: string): Promise<TaskDto>`, `taskEvents(id: string): Promise<TaskEventDto[]>`. All use relative `/api/...` URLs. Error bodies: Nest's `message` array or string becomes `messages`; a non-JSON body becomes `['HTTP <status>']`.

- [x] **Step 1:** Scaffold with Vite's `react-ts` template; dev deps `vitest @testing-library/react @testing-library/dom @testing-library/user-event jsdom oxlint prettier @types/node`. Scripts: `dev` (`vite`), `build` (`tsc -b && vite build`), `test` (`vitest run`), `lint` (`oxlint src/`), `format` (`prettier --write .`). Vitest config inside `vite.config.ts` (`test: { environment: 'jsdom' }`). Proxy: `server: { port: 5173, proxy: { '/api': { target: BACKEND_URL, changeOrigin: true, configure } } }`, where `configure` listens for `proxyRes` and, for `text/event-stream` responses, calls `res.flushHeaders()` on the next tick (guarded by `!res.destroyed && !res.writableEnded`), because the proxy otherwise holds headers until the first body bytes and an idle stream never opens. Template demo files and CSS deleted.
- [x] **Step 2:** `design-system/tokens.css` copied to `src/styles/tokens.css` unchanged (its Google Fonts `@import` stays) and excluded from prettier. `base.css`: body on `--paper`/`--ink`, `--font-sans` 15px/1.7, the `.wrap` (max-width `--wrap`, 24px gutter, 16px under 600px), and the reduced-motion rule from `design-system/motion.md`.
- [x] **Step 3: Failing tests** in `client.test.ts` with `vi.stubGlobal('fetch', …)`: `createTask POSTs JSON and returns the body`; `throws ApiError with validation messages on 400`; `wraps a string message on 409`; `falls back to HTTP status for non-JSON error bodies`; `cancelTask POSTs to the cancel route`; `taskEvents GETs the events route`.
- [x] **Step 4:** Run → FAIL. Implement `types.ts` and `client.ts`. Run → PASS. `npm run build` and `npm run lint` clean.
- [x] **Step 5: Commit** `feat(frontend): scaffold vite app, tokens and API client` (follow-ups: `@testing-library/dom` peer, `.npmrc`, tokens restored verbatim and prettier-ignored).

### Task 2: `useTaskStream`

**Files:**
- Create: `frontend/src/stream/useTaskStream.ts`, `frontend/src/stream/reducer.ts`
- Test: `frontend/src/stream/reducer.test.ts`, `frontend/src/stream/useTaskStream.test.tsx`, `frontend/src/test/fakeEventSource.ts`

**Interfaces:**
- Consumes: `listTasks`, `ApiError`, `TaskDto`, `TaskChange`, `TaskList` (Task 1).
- Produces (reducer, pure): `interface LogLine { seq: number; id: number; taskId: string; name: string; state: TaskState; at: string }` (`seq` unique per line even when a database reset reuses ids); `type StreamState = { tasks: Map<string, TaskDto>; lastEventId: number|null; loggedEventId: number|null; log: LogLine[]; seq: number }`; `LOG_LIMIT = 50`; `initialState`; actions `{type:'reset', list: TaskList}`, `{type:'change', change: TaskChange}`, `{type:'upsert', task: TaskDto}`.
- Produces (hook): `type StreamStatus = 'connecting'|'open'|'reconnecting'`; `RESYNC_HOLD_LIMIT = 500`; `useTaskStream(): { tasks: TaskDto[] /* newest startedAt first */; status: StreamStatus; lastEventId: number|null; log: LogLine[] /* oldest first, max 50 */; upsert(task: TaskDto): void; error: string|null }`.

Decisions as built:
- **Apply vs log.** A `change` is applied when `event.id > lastEventId` (row replaces the map entry, unknown ids added, `lastEventId = event.id`) and printed when `event.id > loggedEventId` (new `LogLine` with the next `seq`, `loggedEventId = event.id`, log trimmed to 50). Neither → same state object. So duplicates and older ids are skipped, while a replayed event the resync list already covers is not applied but still prints, once.
- **`reset`** replaces the map and `lastEventId` from the list and keeps the log. `loggedEventId` stays behind the list (so a replayed batch prints), except on the first load (`loggedEventId` null: nothing to print) and when the list's id is lower (database reset): then it takes the list's id.
- **`upsert`** replaces the row only if the incoming `updatedAt` is not older than the stored one; never touches `lastEventId` or the log.
- **Lifecycle.** `listTasks()` → `reset` → `EventSource('/api/tasks/stream?after=' + (lastEventId ?? 0))` (`after=0` replays everything, so an event between list and subscribe is not lost on an empty database) → listen for `task`. If the first `listTasks()` fails, `error` is set, status stays `connecting`, retry every 2000 ms. `onerror`: status `reconnecting`; if `readyState === CLOSED`, close and recreate after 2000 ms with `?after=<current lastEventId ?? 0>`. Unmount sets a disposed guard, clears all timers and closes the source.
- **Resync.** `onopen` after an error: status `open`, clear any pending retry timer, start `resync(++resyncGen)`. A resolve or reject from an older gen is ignored, so only the newest attempt applies when reconnects overlap.
- **Per-attempt hold.** Each `resync(gen)` attempt (the first and every retry) holds stream events in `buffered`. Success: `reset` with the list, replay `buffered` through the reducer, stop holding, clear `error`. Failure: set `error`, replay `buffered` (the reducer's dedup decides), stop holding, retry after 2000 ms; events between attempts go straight to the reducer. Cap: when the hold reaches `RESYNC_HOLD_LIMIT`, the attempt is abandoned the same way under a new gen (its result ignored) and a fresh attempt starts after 2000 ms. Accepted trade-off: after a database reset, events applied between failed attempts are judged against the old, higher `lastEventId` and dropped until a reload succeeds.

- [x] **Step 1:** `fakeEventSource.ts`: static `CONNECTING/OPEN/CLOSED`, `instances`, `reset()`, `url`, `readyState`, `closed`, `close()`, `addEventListener`, `onopen`/`onerror`, and helpers `open()`, `emit(change)` (a `MessageEvent('task', { data, lastEventId })`), `fail(closed = false)`. Installed with `vi.stubGlobal('EventSource', FakeEventSource)`.
- [x] **Step 2: Failing reducer tests** (`reducer.test.ts`): reset fills the map and last event id; reset keeps the log; applies a newer change and logs it; ignores a duplicate event id; ignores an older event id; logs a change the reset already covers without applying it, once; does not log events the first list already covers; logs low ids again after a reset whose ids went backwards; gives every log line a unique increasing seq; adds unknown tasks; trims the log to the last 50; upsert ignores older rows and applies newer ones, leaving ids and log; upsert adds an unknown task.
- [x] **Step 3: Failing hook tests** (`useTaskStream.test.tsx`, `renderHook`, fake timers, mocked `listTasks`): resumes after the list lastEventId; opens with after=0 when there are no events; tracks status; resyncs with a fresh list after an error then open; keeps events received while the resync fetch is pending; applies low-id events received during a database-reset resync; logs a replayed event the resync list already covers; logs a replayed event that arrives after the resync list; ignores a stale resync that resolves while a newer one is pending; retries a failed resync every 2s; applies held events when a resync attempt fails; applies events directly between failed resync attempts; holds again during the retry and replays on success; abandons an attempt that holds RESYNC_HOLD_LIMIT events; stops retrying a failed resync once a newer one supersedes it; recreates a closed source after 2s using the current lastEventId; sorts newest startedAt first; exposes upsert; closes on unmount and stops reconnecting; retries the first list on failure.
- [x] **Step 4:** Run → FAIL. Implement `reducer.ts` then `useTaskStream.ts` (`useReducer` + one `useEffect` holding the source, timers, gen and hold buffer in closure; a ref mirrors `lastEventId` for reconnect URLs). Run → PASS.
- [x] **Step 5: Commit** `feat(frontend): useTaskStream with replay, dedup and resync` (follow-ups: buffer during resync; log replayed batches, serialize and retry resyncs, `after=0`; per-attempt hold with the 500-event cap).

### Task 3: Time helpers and shared clock

**Files:**
- Create: `frontend/src/time/format.ts`, `frontend/src/time/useNow.ts`
- Test: `frontend/src/time/format.test.ts`, `frontend/src/time/useNow.test.tsx`

**Interfaces:**
- Produces: `remainingMs(task: TaskDto, now: number): number` (clamped ≥ 0, uses `endsAt`); `formatCountdown(ms: number): string` (`ceil` to seconds; `mm:ss` under one hour, `h:mm:ss` from one hour); `progressStep(task: TaskDto, now: number, steps = 19): number` (`floor(elapsed/duration*steps)`, clamped to 0..steps); `formatClock(iso: string): string` (`toLocaleTimeString('en-GB')`, local 24h `HH:MM:SS`); `useNow(intervalMs = 250): number` via `useSyncExternalStore` over a module-level subscription: one shared `setInterval` started by the first subscriber and cleared by the last.

- [x] **Step 1: Failing tests:** `formatCountdown` formats zero as 00:00, rounds partial seconds up, formats minutes as mm:ss, switches to h:mm:ss from one hour, formats long durations with multi-digit hours (`24:00:00`); `remainingMs` is clamped to 0 when endsAt is in the past and is endsAt minus now while running; `progressStep` is 0 at the start, 9 at half of a 10 s timer, clamped to 19 past the end; `formatClock` formats as local 24h HH:MM:SS; `useNow` shares one interval between hook instances and clears it on last unmount.
- [x] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [x] **Step 3: Commit** `feat(frontend): countdown and progress helpers`.

### Task 4: Desk components

**Files:**
- Create: `frontend/src/components/Window.tsx` + `Window.css` (title bar, menu and close boxes, pinstripes, body, optional footer: the design-system Window motif)
- Create: `frontend/src/components/StartForm.tsx` + `.css`
- Create: `frontend/src/components/TimerWindow.tsx` + `.css`
- Create: `frontend/src/components/History.tsx` + `.css`
- Create: `frontend/src/components/LiveLog.tsx` + `.css` (also exports `StreamLabel`)
- Create: `frontend/src/components/Archive.tsx` + `.css`
- Create: `frontend/src/stream/useDeparting.ts`
- Create: `frontend/src/App.tsx`, `frontend/src/App.css` (layout plus shared primitives: tag, buttons, cursor, blink, reveal, `leetflash`, ink shadows)
- Test: `frontend/src/components/StartForm.test.tsx`, `frontend/src/components/TimerWindow.test.tsx`, `frontend/src/components/LiveLog.test.tsx`, `frontend/src/stream/useDeparting.test.tsx`, `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `useTaskStream` (Task 2), time helpers and `useNow` (Task 3), API client (Task 1).
- Produces: `<Window title: string; footer?: ReactNode; className?: string>`; `<StartForm onCreated(task: TaskDto)>`; `<TimerWindow task: TaskDto; now: number; onChanged(task: TaskDto); newestEventId: number|null>`; `<History taskId: string; refreshKey: number|null>`; `<StreamLabel status: StreamStatus; lastEventId: number|null>`; `<LiveLog log: LogLine[]; status: StreamStatus; lastEventId: number|null>` (memo); `<Archive tasks: TaskDto[]; newestEventIds: Map<string, number>>` (memo); `DEPART_MS = 1200`, `useDeparting(tasks: TaskDto[], ms = DEPART_MS): ReadonlySet<string>`.

Copy and behaviour as built:
- Header: `1337 · TIMERS` left; right the shared `StreamLabel` (same component as the LiveLog footer). The hook's `error` shows uppercase under the header as an alert line.
- Opener: tag `01 · TIMERS`; h1 `Start a ` + purple `timer.`; lead `Every timer is shared with everyone watching. Start one, watch it count down, cancel it if you change your mind.`
- Form labels `NAME`, `SECONDS` (default `180`); button `START TIMER →`, disabled while submitting. Client messages: `NAME IS REQUIRED`, `NAME IS 100 CHARACTERS AT MOST`, `SECONDS MUST BE A WHOLE NUMBER FROM 1 TO 86400`. Server `ApiError.messages` shown uppercase, one per line. On success: clear name, keep seconds, call `onCreated` (wired to `upsert`).
- TimerWindow: title `<name>.tmr` (ellipsis when long); state line `● RUNNING` (dot blinks, purple), `● FINISHING…` at zero remaining, `[x] FINISHED` / `[ ] CANCELLED` while departing; countdown `formatCountdown(remainingMs)`; loader of 19 cells with `progressStep` filled (`role="progressbar"`); footer `ENDS <formatClock(endsAt)>`, `HISTORY ↓`/`HISTORY ↑` (shows `<History>` in place of countdown and bar) and ghost `CANCEL` (disabled while in flight, after a 409, or once not running). A 409 shows `TASK IS NOT RUNNING`; other `ApiError`s their messages uppercase; network failure `COULD NOT REACH THE SERVER`. Scroll-reveal: `.rv` wrapper gets `.in` on the next animation frame.
- Departing: `useDeparting` derives, during render, the ids that just left `running` and keeps them for 1.2 s; App keeps those windows on the desk with the `leetflash` animation (1.2 s) before they move to the archive. Tasks first seen already ended go straight to the archive.
- Empty desk: a full-width dashed purple open slot reading `NO TIMERS RUNNING`.
- Archive (rendered only if non-empty): newest `updatedAt` first, capped at the first 20 rows with a `SHOW ALL (<n>)` / `SHOW LESS` toggle; tag `02 · ARCHIVE`; columns `NAME`, `STATE` (`[x] FINISHED` / `[ ] CANCELLED`), `DURATION` (`formatCountdown(durationSeconds*1000)`), `ENDED` (`formatClock(updatedAt)`), and `HISTORY ↓` expanding a detail row (`colSpan=5`) with `<History>`. Below 600 px the DURATION column becomes a zero-width hidden column (not `display: none`), so every row keeps five columns and spans the full width.
- History rows: `#<id>  <STATE>  <formatClock(at)>`; `LOADING…`; failure `COULD NOT LOAD HISTORY`. Refetches when `refreshKey` (newest logged event id for that task, derived in App from the log) changes.
- LiveLog: window title `live.log`; `role="log"`; lines keyed by `seq`, `#<id> <name> <state>`, running state purple; auto-scroll to bottom; blinking orange block cursor after the last line; footer `● CONNECTED · LAST ID <n>` (`—` when null), `CONNECTING…` or `RECONNECTING…` with the stepped loader.
- Layout: desk grid `minmax(0, 1fr) 320px` (LiveLog on the right), windows in `repeat(auto-fill, minmax(260px, 1fr))`, newest first; below 900 px one column with LiveLog under the windows.

- [x] **Step 1: Failing tests:**
  - `StartForm`: requires a name and does not call the API; submits a trimmed name, clears it and reports the task; shows every server validation message.
  - `TimerWindow`: counts down from endsAt; shows 00:00 and FINISHING… once endsAt has passed; cancels once even when clicked twice; shows a 409 and keeps CANCEL disabled.
  - `LiveLog`: renders lines with a reused event id under a log role.
  - `useDeparting`: holds a task that left running for 1.2 s; ignores tasks first seen already ended.
  - `App` (mocked `useTaskStream` module): splits running windows from the archive by state; hides the archive when nothing has ended; shows 20 archive rows until SHOW ALL is clicked.
- [x] **Step 2:** Run → FAIL. Implement components and CSS from the design-system recipes: Window motif (1px ink frame, ink hard shadow, 28px bar, pinstripes), buttons (solid ink / ghost ink ring, `mono-button`), section opener, hairline table rows, `.cur` cursor, stepped loader, scroll reveal, `leetflash`.
- [x] **Step 3:** Run → PASS; `npm run build`, `npm run lint` clean.
- [x] **Step 4: Commit** `feat(frontend): the desk — timer windows, live.log, archive, history` (follow-up: error lines without the orange prefix).

### Task 5: README and browser verification against the real backend

**Files:**
- Create: `frontend/README.md`

- [x] **Step 1:** `README.md`: requirements (Node ≥ 20.19, 24 preferred; why `.npmrc`), running against the real backend (`cd backend && npm run start:dev`, then `npm install` and `npm run dev` in `frontend/`, open http://localhost:5173, `BACKEND_URL` override), a second desk on another process (`BACKEND_URL=http://localhost:3002 npm run dev -- --port 5174` with the backend's `multi` profile), scripts, the fonts note, and the layout of `src/`.
- [x] **Step 2: Browser check** against the real backend (`npm run dev`, http://localhost:5173): start a 5 s and a 60 s timer; both windows appear and count down; the 5 s one flashes and moves to the archive; live.log shows `running` / `finished` lines with ids; cancel the 60 s one → archive `[ ] CANCELLED`; history shows two rows; restart the backend → footer goes `RECONNECTING…` then `CONNECTED` and the page resyncs; 375 px width is one column with no horizontal scroll.
- [x] **Step 3:** Fix what the check found:
  - The desk sat at `CONNECTING…` on an idle stream because Vite's proxy held the SSE response headers until the first body bytes; fixed with the `proxyRes` header flush in `vite.config.ts` (Task 1), later guarded against destroyed or ended responses.
  - At phone width the archive table lost full width when DURATION was hidden with `display: none`; fixed with the zero-width hidden column (Task 4).
- [x] **Step 4: Commits** `docs(frontend): README for running against the real backend; drop mock`, `fix(frontend): flush SSE response headers through the dev proxy`, `fix(frontend): keep archive columns full width on phones`, `chore(frontend): guard SSE header flush, add .nvmrc, fix docs drift`.
