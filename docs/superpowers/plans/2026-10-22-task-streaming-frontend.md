# Task Streaming Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-page "desk" in `frontend/` that starts, shows, cancels and inspects timers live over the backend's SSE stream, in the 1337 look.

**Architecture:** Vite + React + TypeScript SPA. A `useTaskStream` hook owns the task map, the stream connection and the log; components are dumb views over it. A dependency-free Node mock stands in for the backend on :3000 until backend Task 6 is merged.

**Tech Stack:** Vite, React 19, TypeScript, plain CSS on the design-system tokens, Vitest + Testing Library + jsdom, oxlint, prettier.

**Spec:** `docs/superpowers/specs/2026-10-22-task-streaming-frontend-design.md` (and the backend contract in `docs/superpowers/specs/2026-10-22-task-streaming-backend-design.md`).

## Global Constraints

- Everything lives in `frontend/`; never edit `backend/` or `design-system/`.
- Node ≥ 20.19 (Vite's floor; Node 24 preferred, `.nvmrc` says 24). ESM (`"type": "module"`).
- Plain CSS only, on tokens copied verbatim from `design-system/tokens.css` into `frontend/src/styles/tokens.css`. No Tailwind, no CSS-in-JS, no UI library.
- Square corners, hard shadows (`--shadow-hard`), purple `#783ff3` the only accent, orange only for the cursor. Headings serif, labels uppercase DM Mono.
- Name 1–100 chars after trim; seconds integer 1–86400.
- Dev server :5173; `/api` proxied to `process.env.BACKEND_URL ?? 'http://localhost:3000'`.
- Every animation honours `prefers-reduced-motion` (design system's global rule).
- Types `TaskDto` / `TaskEventDto` / `TaskChange` match `backend/src/tasks/task.types.ts` field for field.

## Review Focus

- **Database reset while the page is open** (`docker compose down -v`): new event ids restart below the client's `lastEventId`, and naive dedup would drop every event forever. Expected: after the stream reopens, the page resyncs from `GET /api/tasks` and works again. Test in Task 2.
- **Event for a task id the client doesn't know** (created before a reconnect, or on another process): expected to appear, not be ignored. Test in Task 2.
- **Countdown reaches zero before `finished` arrives** (or a backend is down): expected `00:00 · finishing…`, never negative, never self-finished. Test in Task 3.
- **Long name / long duration**: a 100-char name must not break the window grid; 86400 s shows `24:00:00`. Test in Task 3 (format) and Task 5 (CSS ellipsis, checked in browser).
- **Double-clicked cancel / cancel racing finish**: second click disabled; a 409 shows `TASK IS NOT RUNNING` in the window, not an alert, and the stream's state wins. Test in Task 4.

---

### Task 1: Scaffold, tokens, API client

**Files:**
- Create: `frontend/package.json`, `frontend/index.html`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/oxlint.json`, `frontend/.prettierrc` (copy backend's), `frontend/src/main.tsx`, `frontend/src/styles/tokens.css`, `frontend/src/styles/base.css`
- Create: `frontend/src/api/types.ts`, `frontend/src/api/client.ts`
- Create: `.gitignore` at repo root (`node_modules`, `dist`, `.superpowers/`, `.DS_Store`, `*.tsbuildinfo`) if missing on this branch
- Test: `frontend/src/api/client.test.ts`

**Interfaces:**
- Produces: types `TaskState = 'running'|'finished'|'cancelled'`, `TaskDto`, `TaskEventDto`, `TaskChange { event; task }`, `TaskList { tasks: TaskDto[]; lastEventId: number|null }`.
- Produces: `class ApiError extends Error { status: number; messages: string[] }`; `listTasks(): Promise<TaskList>`, `createTask(input: { name: string; durationSeconds: number }): Promise<TaskDto>`, `cancelTask(id: string): Promise<TaskDto>`, `taskEvents(id: string): Promise<TaskEventDto[]>`. All use relative `/api/...` URLs.

- [ ] **Step 1:** Scaffold with `npm create vite@latest frontend -- --template react-ts`, then add dev deps `vitest @testing-library/react @testing-library/user-event jsdom oxlint prettier`. Scripts: `dev`, `build` (`tsc -b && vite build`), `test` (`vitest run`), `lint` (`oxlint src/ mock/`), `format`, `mock` (`node mock/server.mjs`). Vitest config inside `vite.config.ts` with `environment: 'jsdom'`. Proxy: `server: { port: 5173, proxy: { '/api': { target: BACKEND_URL, changeOrigin: true } } }`. Delete the template's demo files and CSS.
- [ ] **Step 2:** Copy `design-system/tokens.css` to `src/styles/tokens.css` unchanged (its `@import` of Google Fonts stays). `base.css`: body on `--paper`/`--ink`, `--font-sans` 15px/1.7, the `.wrap` (max-width `--wrap`, 24px gutter, 16px under 600px), and the reduced-motion rule from `design-system/motion.md`.
- [ ] **Step 3: Write failing tests** in `client.test.ts` with `vi.stubGlobal('fetch', …)`:
  - `createTask` POSTs JSON `{name, durationSeconds}` to `/api/tasks` with `Content-Type: application/json` and returns the body.
  - A 400 with body `{"message":["name must be longer than or equal to 1 characters"],"error":"Bad Request","statusCode":400}` throws `ApiError` with `status 400` and `messages` equal to that array.
  - A 409 with `{"message":"Task is not running",…}` throws `ApiError` with `messages: ['Task is not running']`.
  - A non-JSON error body throws `ApiError` with `messages: ['HTTP 502']`.
  - `cancelTask('x')` POSTs to `/api/tasks/x/cancel`; `taskEvents('x')` GETs `/api/tasks/x/events`.
- [ ] **Step 4:** Run `npm test` → FAIL (module missing). Implement `types.ts` and `client.ts`. Run → PASS. `npm run build` and `npm run lint` clean.
- [ ] **Step 5: Commit** `feat(frontend): scaffold vite app, tokens and API client`.

### Task 2: `useTaskStream`

**Files:**
- Create: `frontend/src/stream/useTaskStream.ts`, `frontend/src/stream/reducer.ts`
- Test: `frontend/src/stream/reducer.test.ts`, `frontend/src/stream/useTaskStream.test.tsx`, `frontend/src/test/fakeEventSource.ts`

**Interfaces:**
- Consumes: `listTasks`, `TaskDto`, `TaskChange` (Task 1).
- Produces: `type StreamStatus = 'connecting'|'open'|'reconnecting'`; `interface LogLine { id: number; name: string; state: TaskState; at: string }`; `useTaskStream(): { tasks: TaskDto[] /* newest startedAt first */; status: StreamStatus; lastEventId: number|null; log: LogLine[] /* oldest first, max 50 */; upsert(task: TaskDto): void; error: string|null }`.
- Produces (reducer, pure): `type StreamState = { tasks: Map<string, TaskDto>; lastEventId: number|null; log: LogLine[] }`; actions `{type:'reset', list: TaskList}`, `{type:'change', change: TaskChange}`, `{type:'upsert', task: TaskDto}`.

Decisions the tests pin:
- `change` with `event.id <= lastEventId` is ignored entirely (no task update, no log line). Otherwise the task row replaces the map entry (adding unknown ids), `lastEventId = event.id`, a log line is appended, log trimmed to the last 50.
- `upsert` replaces the row only if the incoming `updatedAt` is not older than the stored one (so a late create/cancel response can't overwrite a newer stream state); never touches `lastEventId` or the log.
- `reset` replaces the whole map and `lastEventId` from the list, keeps the log.
- Hook lifecycle: `listTasks()` → dispatch `reset` → open `EventSource('/api/tasks/stream?after=' + (lastEventId ?? 0))` → `addEventListener('task', …)`. `onopen`: status `open`; if this open follows an error, call `listTasks()` again and dispatch `reset` (this is the database-reset resync; stream events with ids above the fresh `lastEventId` still apply). `onerror`: status `reconnecting`; if `readyState === EventSource.CLOSED`, close and recreate after 2000 ms using `?after=` with the current `lastEventId`. If the first `listTasks()` fails, `error` is set, status stays `connecting`, and it retries every 2000 ms. Unmount closes the EventSource and clears timers.

- [ ] **Step 1:** Write `fakeEventSource.ts`: a class with static `instances`, `url`, `readyState`, `close()`, `addEventListener`, `onopen`/`onerror`, and test helpers `open()`, `emit(change: TaskChange)` (dispatches a `MessageEvent('task', { data: JSON.stringify(change), lastEventId: String(change.event.id) })`), `fail(closed = false)`. Install with `vi.stubGlobal('EventSource', FakeEventSource)`.
- [ ] **Step 2: Write failing reducer tests** (`reducer.test.ts`): `reset` fills map and id; `change` with id 5 after lastEventId 4 updates task, sets 5, logs one line; `change` id 5 again → state unchanged (same object); `change` id 3 → unchanged; unknown task id is added; 60 changes → log length 50 ending with id of the last; `upsert` with older `updatedAt` ignored, newer applied, lastEventId untouched.
- [ ] **Step 3: Write failing hook tests** (`useTaskStream.test.tsx`, `renderHook` + fake timers where needed):
  - `lastEventId 7` from the list → EventSource URL `/api/tasks/stream?after=7`; `null` → `/api/tasks/stream?after=0`.
  - status `connecting` → `open` after `open()`; `fail()` → `reconnecting`.
  - after `fail()` then `open()`, `listTasks` called twice and its second result replaces tasks (simulate reset: second list returns `lastEventId 2`, then an emitted change with id 3 is applied).
  - `fail(true)` (CLOSED) → after 2000 ms a second EventSource exists with `?after=<current lastEventId>`; first was closed.
  - `tasks` sorted newest `startedAt` first.
  - unmount → `close()` called, no new instances after advancing 5000 ms.
  - first `listTasks` rejects → `error` set; after 2000 ms it retries and on success opens the stream.
- [ ] **Step 4:** Run → FAIL. Implement `reducer.ts` then `useTaskStream.ts` (`useReducer` + one `useEffect` with refs for the source and timers). Run → PASS.
- [ ] **Step 5: Commit** `feat(frontend): useTaskStream with replay, dedup and resync`.

### Task 3: Time helpers and shared clock

**Files:**
- Create: `frontend/src/time/format.ts`, `frontend/src/time/useNow.ts`
- Test: `frontend/src/time/format.test.ts`

**Interfaces:**
- Produces: `remainingMs(task: TaskDto, now: number): number` (clamped ≥ 0, uses `endsAt`); `formatCountdown(ms: number): string` (`ceil` to seconds; `mm:ss` under one hour, `h:mm:ss` from one hour); `progressStep(task: TaskDto, now: number, steps = 19): number` (0..steps, `floor(elapsed/duration*steps)`, clamped); `formatClock(iso: string): string` (`HH:MM:SS`, local time, 24h); `useNow(intervalMs = 250): number` (one shared interval for all subscribers, started on first subscriber, stopped on last).

- [ ] **Step 1: Write failing tests:** `formatCountdown(0) === '00:00'`; `formatCountdown(1) === '00:01'` (ceil); `formatCountdown(61_000) === '01:01'`; `formatCountdown(3_600_000) === '1:00:00'`; `formatCountdown(86_400_000) === '24:00:00'`; `remainingMs` of a task whose `endsAt` is 5 s ago `=== 0`; `progressStep` at start `0`, at half of a 10 s timer `9`, past end `19`; `formatClock('2026-10-22T11:37:00.000Z')` equals `new Date(…).toLocaleTimeString('en-GB')`.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Commit** `feat(frontend): countdown and progress helpers`.

### Task 4: Desk components

**Files:**
- Create: `frontend/src/components/Window.tsx` + `Window.css` (title bar, close box, pinstripes, body, optional footer — the design-system Window motif)
- Create: `frontend/src/components/StartForm.tsx` + `.css`
- Create: `frontend/src/components/TimerWindow.tsx` + `.css`
- Create: `frontend/src/components/History.tsx` + `.css`
- Create: `frontend/src/components/LiveLog.tsx` + `.css`
- Create: `frontend/src/components/Archive.tsx` + `.css`
- Create: `frontend/src/App.tsx`, `frontend/src/App.css`
- Test: `frontend/src/components/StartForm.test.tsx`, `frontend/src/components/TimerWindow.test.tsx`, `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `useTaskStream` (Task 2), time helpers (Task 3), API client (Task 1).
- Produces: `<Window title: string; footer?: ReactNode; className?: string>`; `<StartForm onCreated(task: TaskDto)>`; `<TimerWindow task: TaskDto; now: number; onChanged(task: TaskDto); newestEventId: number|null>`; `<History taskId: string; refreshKey: number|null>`; `<LiveLog log: LogLine[]; status: StreamStatus; lastEventId: number|null>`; `<Archive tasks: TaskDto[]; newestEventIds: Map<string, number>>`.

Copy and behaviour (exact):
- Header: `1337 · TIMERS` left; right the stream label (same text as LiveLog footer).
- Opener: tag `01 · TIMERS`; h1 `Start a ` + purple `timer.`; lead `Every timer is shared with everyone watching. Start one, watch it count down, cancel it if you change your mind.`
- Form labels `NAME`, `SECONDS`; button `START TIMER →`, disabled while submitting. Client validation messages: `NAME IS REQUIRED`, `NAME IS 100 CHARACTERS AT MOST`, `SECONDS MUST BE A WHOLE NUMBER FROM 1 TO 86400`. Server `ApiError.messages` shown uppercase, one per line. On success: clear name, keep seconds, call `onCreated`.
- TimerWindow: title `<name>.tmr` (ellipsis when long); state line `● RUNNING` (dot blinks, purple); countdown from `formatCountdown(remainingMs)`; when remaining is 0 the state line reads `● FINISHING…`; loader = 19 cells, `progressStep` of them filled; footer `ENDS <formatClock(endsAt)>` and `CANCEL` (ghost, disabled while in flight or after a 409); `HISTORY ↓`/`HISTORY ↑` toggle shows `<History>` in place of countdown+bar. Errors as uppercase mono line in the window.
- Archive (shown only if non-empty): newest `updatedAt` first, first 20 rows, then a `SHOW ALL (<n>)` / `SHOW LESS` toggle; tag `02 · ARCHIVE`; table columns `NAME`, `STATE` (`[x] FINISHED` / `[ ] CANCELLED`), `DURATION` (`formatCountdown(durationSeconds*1000)`), `ENDED` (`formatClock(updatedAt)`), `HISTORY ↓` which expands a row beneath with `<History>`.
- History rows: `#<id>  <STATE>  <formatClock(at)>`; loading `LOADING…`; failure `COULD NOT LOAD HISTORY`. Refetches when `refreshKey` (newest event id for that task) changes.
- LiveLog: window title `live.log`; lines `#<id> <name> <state>`, the running state in purple; auto-scroll to bottom; blinking orange block cursor after the last line; footer `● CONNECTED · LAST ID <n>` (`—` when null), `CONNECTING…`, `RECONNECTING…`.
- Layout: running windows in a grid `repeat(auto-fill, minmax(260px, 1fr))`, LiveLog 320px column on the right; below 900px one column with LiveLog under the grid. Running sorted newest first.
- App tracks per-task newest event id from the log for History refresh.

- [ ] **Step 1: Write failing tests:**
  - `StartForm`: empty name → shows `NAME IS REQUIRED` and `createTask` not called; seconds `0` and `1.5` → seconds message; valid submit calls `createTask({name:'tea', durationSeconds:180})` with trimmed name, then name field empty; `ApiError` 400 with two messages shows both.
  - `TimerWindow`: running task with 61 s left shows `01:01`; `now` past `endsAt` shows `00:00` and `FINISHING…`; clicking `CANCEL` twice calls `cancelTask` once; a 409 shows `TASK IS NOT RUNNING` and leaves `CANCEL` disabled.
  - `App` (mock `useTaskStream` module): two running + one finished + one cancelled → 2 windows and an archive with 2 rows; zero non-running → no `02 · ARCHIVE`; 25 finished → 20 rows and `SHOW ALL (25)`, clicking it → 25 rows.
- [ ] **Step 2:** Run → FAIL. Implement components and CSS using the design-system recipes: Window motif (1px ink frame, `--shadow-hard`, 28px bar, pinstripes), buttons (solid ink / ghost `--shadow-ring`, `mono-button`), section opener, hairline table rows, `.cur` cursor, stepped loader, scroll-reveal `.rv` on new windows (IntersectionObserver not needed: add `.in` on next frame after mount), `leetflash` when a window's task leaves `running` — keep it mounted 1.2 s with the flash, then let it move to the archive.
- [ ] **Step 3:** Run → PASS; `npm run build`, `npm run lint` clean.
- [ ] **Step 4: Commit** `feat(frontend): the desk — timer windows, live.log, archive, history`.

### Task 5: Mock backend and browser verification

> Revised: the backend landed first, so the mock is dropped; this task is the README plus verification against the real backend.

**Revised scope:** create `frontend/README.md` (run against the real backend with `npm run dev`, `BACKEND_URL`, the fonts note), then do the Step 4 browser check against the real backend (restart the backend instead of the mock). Commit `docs(frontend): README for running against the real backend; drop mock`. The original steps below are superseded.

~~**Files:**~~
~~- Create: `frontend/mock/server.mjs`~~
~~- Create: `frontend/README.md`~~
~~- Test: `frontend/mock/server.test.mjs` (run by Vitest; include `mock/**/*.test.mjs` in config)~~

~~**Interfaces:**~~
~~- Produces: `startMock({ port }): Promise<{ url: string; close(): Promise<void> }>` exported from `server.mjs`; when run directly it listens on `PORT ?? 3000`. Pure `node:http`, no deps. Same routes, status codes and JSON shapes as the backend design (including Nest-style error bodies), SSE exactly per its "SSE stream" section (headers, `id:`/`event: task`/`data:` blocks, `: ping` every 15 s, replay from `Last-Event-ID` header, else `?after=`), in-memory tasks with real `setTimeout` finishing.~~

~~- [ ] **Step 1: Write failing tests** against `startMock({ port: 0 })`: POST valid → 201 running; POST `{name:''}` → 400 with `message` array; `GET /api/tasks` returns `lastEventId`; a 1 s timer emits `running` then `finished` on an open stream with increasing ids; stream with `?after=<id>` replays only later events; cancel twice → 200 then 409; cancel unknown uuid → 404; cancel `abc` → 400.~~
~~- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.~~
~~- [ ] **Step 3:** `README.md`: how to run (`npm run mock` + `npm run dev`, or the real backend + `npm run dev`), `BACKEND_URL`, and the fonts note from the spec.~~
~~- [ ] **Step 4: Browser check** (`npm run mock` and `npm run dev`, open http://localhost:5173): start a 5 s and a 60 s timer; both windows appear and count down; 5 s one flashes and moves to the archive; live.log shows `running` / `finished` lines with ids; cancel the 60 s one → archive `[ ] CANCELLED`; history shows two rows; stop and restart the mock → footer goes `RECONNECTING…` then `CONNECTED` and the page resyncs (old timers gone, since the mock is in memory: the database-reset case); 375 px width is one column with no horizontal scroll. Capture a screenshot.~~
~~- [ ] **Step 5: Commit** `feat(frontend): mock backend, README`.~~
