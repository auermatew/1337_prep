# Moonrise look and the moon switch — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A moon button that switches the whole frontend between the classic 1337 desk and the Moonrise night, sharing one stream and one set of logic, with a Moonrise-style loading transition.

**Architecture:** `App` keeps the stream and derived data and renders `ClassicLook` or a lazily loaded `MoonriseLook` with the same props. Logic moves out of the classic components into hooks in `src/logic/` that both looks use. `src/look/` holds persistence, the switch button, the transition controller and overlay; the overlay's seven-segment clock lives in the main bundle.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4 + Testing Library (jsdom), plain CSS (native nesting allowed).

**Spec:** `docs/superpowers/specs/2026-10-23-moonrise-look-switch-design.md`

## Global Constraints

- Work on `dev` in `.claude/worktrees/dev`. Never merge, push or PR to `main`.
- Node from `/opt/homebrew/opt/node@24/bin` (prefix `PATH=/opt/homebrew/opt/node@24/bin:$PATH` on every npm command). Run `npm install` once in `frontend/` first (no `node_modules` yet).
- No backend change, no new npm dependencies.
- Existing test files are not edited. `npm test`, `npm run lint`, `npm run build` pass after every task.
- Classic look: DOM, copy and classes unchanged (uppercase copy stays classic-only).
- Moonrise copy is sentence case, no emoji, no all-caps labels, no badges (BRAND.md). Exact strings from the spec are used verbatim.
- Moonrise class names stay the `ms-*` names from `design-system-moonrise/components/bundle.css`.
- Every Moonrise CSS rule is scoped under `.moonrise` (or the clock root class / `html[data-look='moon']`); nothing in it may match classic DOM.
- Look values `'classic' | 'moon'`; URL param `look`; storage key `1337.look`; `<html data-look>`.
- Timings: moon cover 800ms, min boot hold 1200ms (500ms on the fast path), font/photo cap 8000ms, reveal 800ms; classic cover 600ms, reveal 300ms; reduced motion: 150ms fades, no scramble, "Loading…" after 400ms. Transition steps run on timers, never on `transitionend`/`animationend`.
- Overlay and Moonrise reduced-motion fades need scoped `!important` overrides because classic `base.css` sets `animation: none !important; transition: none !important` on everything under reduced motion.
- Photos: `/moonrise/moon.webp`, `/moonrise/clouds.webp`, `/moonrise/cover.webp`, `/moonrise/paper.webp`; scans `/notes-1.webp`, `/notes-2.png`.

## Review Focus

1. **Double clicks and clicks mid-transition** must not start a second switch or leave the overlay stuck: test in Task 9 ("ignores clicks while switching").
2. **Moonrise chunk fails to load** (offline, deploy swapped hashes): error line, Try again retries, Back returns to classic and stores `classic` — Task 9.
3. **Storage unavailable** (Safari private mode throws on `localStorage`): the app still starts in classic and switching still works — Task 4 ("survives storage that throws").
4. **Classic after a round trip**: no `.moonrise` styles leak, `data-look` is `classic`, body grain back — Task 9 asserts `data-look`; browser check in Task 11 covers visuals.
5. **Many timers in Moonrise** (above 20): card clocks drop their glow so the page stays smooth — Task 6 ("drops the card glow above 20 timers").

---

### Task 1: Start-form and cancel logic hooks

**Files:**
- Create: `frontend/src/logic/problems.ts`, `frontend/src/logic/useStartTask.ts`, `frontend/src/logic/useCancelTask.ts`
- Create tests: `frontend/src/logic/useStartTask.test.tsx`, `frontend/src/logic/useCancelTask.test.tsx`
- Modify: `frontend/src/components/StartForm.tsx`, `frontend/src/components/TimerWindow.tsx`

**Interfaces:**
- Produces:
  ```ts
  // problems.ts
  export type Problem =
    | { kind: 'name-required' } | { kind: 'name-too-long' } | { kind: 'seconds-invalid' }
    | { kind: 'server'; messages: string[] } | { kind: 'unreachable' } | { kind: 'not-running' };
  export const NAME_MAX = 100; export const SECONDS_MAX = 86400;
  export function validateStart(name: string, seconds: string): Problem[]; // name already trimmed; same rules as today
  export function parseSeconds(seconds: string): number | null; // /^\d+$/ after trim, else null
  export function secondsEgg(n: number | null): 'leet' | 'hell-naw' | null; // 1337 → leet, > 86400 → hell-naw
  export function problemFromError(err: unknown): Problem; // ApiError 409 → not-running, other ApiError → server, else unreachable
  // useStartTask.ts
  export function useStartTask(onCreated: (t: TaskDto) => void): {
    name: string; setName(v: string): void; seconds: string; setSeconds(v: string): void;
    secondsValue: number | null; submitting: boolean; problems: Problem[]; submit(e?: FormEvent): Promise<void>;
  };
  // useCancelTask.ts
  export function useCancelTask(task: TaskDto, onChanged: (t: TaskDto) => void): {
    cancel(): void; cancelling: boolean; locked: boolean; problem: Problem | null;
  };
  ```

- [ ] **Step 1: Write failing hook tests** with `renderHook` and `vi.mock('../api/client')` (pattern from `StartForm.test.tsx`):
  - `validateStart('', '180')` → `[{kind:'name-required'}]`; `validateStart('x'.repeat(101), '0')` → `[{kind:'name-too-long'},{kind:'seconds-invalid'}]`; `'1.5'`, `'86401'` invalid.
  - `secondsEgg(1337) === 'leet'`, `secondsEgg(86401) === 'hell-naw'`, `secondsEgg(180) === null`.
  - `useStartTask`: submit with name `'  tea '` calls `createTask({name:'tea', durationSeconds:180})`, clears the name, calls `onCreated`; an `ApiError(400, ['a','b'])` gives `problems = [{kind:'server', messages:['a','b']}]`; a TypeError gives `[{kind:'unreachable'}]`; a second submit while one is pending does nothing.
  - `useCancelTask`: two `cancel()` calls send one request; a 409 sets `locked: true` and `problem: {kind:'not-running'}`; success calls `onChanged`.
- [ ] **Step 2: Run** `npx vitest run src/logic` — expect FAIL (modules missing).
- [ ] **Step 3: Implement** the three files by moving the logic out of `StartForm.tsx` / `TimerWindow.tsx` (including `inFlight` ref semantics).
- [ ] **Step 4: Rewire** `StartForm` and `TimerWindow` onto the hooks; classic copy maps problems back to today's strings (`NAME IS REQUIRED`, `NAME IS 100 CHARACTERS AT MOST`, `SECONDS MUST BE A WHOLE NUMBER FROM 1 TO 86400`, server messages uppercased, `COULD NOT REACH THE SERVER`, `TASK IS NOT RUNNING`). Classic hint keeps today's rules (`HELL NAW`, `= LEET`, `= formatDuration(n)` from 60 up, shown on focus) via `secondsEgg`.
- [ ] **Step 5: Run** `npm test && npm run lint` — all pass, existing `StartForm`/`TimerWindow` tests untouched.
- [ ] **Step 6: Commit** `refactor(frontend): move start and cancel logic into shared hooks`

### Task 2: History, archive and transcript logic hooks; DrawLayer ink

**Files:**
- Create: `frontend/src/logic/useTaskHistory.ts`, `frontend/src/logic/useArchive.ts`, `frontend/src/logic/transcripts.ts`, `frontend/src/logic/useTranscript.ts` + a test per hook
- Modify: `frontend/src/components/History.tsx`, `Archive.tsx`, `Transcripts.tsx`, `DrawLayer.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type Loadable<T> = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; value: T };
  export function useTaskHistory(taskId: string, refreshKey: number | null, enabled = true): Loadable<TaskEventDto[]>;
  export const ARCHIVE_PAGE = 20;
  export function useArchive(ended: TaskDto[]): {
    sorted: TaskDto[]; rows: TaskDto[]; total: number; showAll: boolean; toggleShowAll(): void; stats: ArchiveStats;
  };
  export interface Transcript { title: string; file: string; bytes: number }
  export const TRANSCRIPTS: readonly Transcript[]; // today's three entries
  export const transcriptHref: (t: Transcript) => string; // `/transcripts/${file}`
  export function useTranscript(selected: Transcript | null): Loadable<string> | null; // null when nothing selected; never shows another file's text
  // DrawLayer
  export function DrawLayer(props: { ink?: string }): JSX.Element; // default '#7941f2'
  ```
  `Loadable<T>` lives in `frontend/src/logic/loadable.ts`.

- [ ] **Step 1: Write failing tests:** history refetches when `refreshKey` changes and not when `enabled` is false; `useArchive` sorts by `updatedAt` desc, `rows.length === 20` of 25 until `toggleShowAll()`; `useTranscript` returns `{status:'loading'}` right after a new selection even if a previous file failed (mirrors the existing "does not show a previous failure while retrying" test); `DrawLayer` with `ink="#ff2a1f"` sets `strokeStyle` to it (spy on `getContext`).
- [ ] **Step 2: Run** `npx vitest run src/logic` — FAIL.
- [ ] **Step 3: Implement** hooks by moving logic out of the components; components keep their markup and copy.
- [ ] **Step 4: Run** `npm test && npm run lint` — pass.
- [ ] **Step 5: Commit** `refactor(frontend): shared history, archive and transcript hooks`

### Task 3: Seven-segment clock (main bundle)

**Files:**
- Create: `frontend/src/moonrise/clock/segments.ts`, `SegmentClock.tsx`, `clock.css`, `SegmentClock.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface SegmentClockProps {
    value?: string; height?: number; fluid?: boolean; opticalCenter?: boolean; flicker?: boolean;
    boot?: 'once' | 'hold' | false; // 'hold' scrambles until boot becomes false, then locks in left to right
    pulseKey?: string | number | null; urgent?: boolean; dim?: boolean; glow?: boolean; // glow default true
    blinkColon?: boolean; label?: string; className?: string;
  }
  export function SegmentClock(p: SegmentClockProps): JSX.Element;
  export function reducedMotion(): boolean;
  ```
- Port geometry, boot, flicker, pulse and the `data-clock-light` hand-off from `bundle.js` lines 27–169 (drop the reflection). `boot='hold'` is new: keep scrambling every 70ms while it is `'hold'`; when it turns `false`, run the lock-in frames (10, 14, 18, 22 …) and stop.
- `clock.css`: the `.ms-clock*`, `.ms-seg-*` rules and keyframes from `bundle.css` lines 16–48 plus the reduced-motion lines for them, with `--signal`, `--signal-ghost`, `--signal-dim`, `--ink-3`, `--line` defined on `.ms-clock` itself, so it renders outside `.moonrise`. `role="img"` with `aria-label` (`label ?? value`).

- [ ] **Step 1: Failing tests:** `value="13:37"` renders 4 digits × 7 polygons + 4 colon rects; `1` lights only `b,c` (2 `.ms-seg-on` polygons); label lands on `role="img"`; `pulseKey` change adds `ms-clock-flash` and removes it after 320ms (fake timers); `boot="hold"` → `false` ends with the real value lit; `glow={false}` renders no `filter` attribute.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/moonrise/clock` — PASS.
- [ ] **Step 5: Commit** `feat(frontend): seven-segment clock for the Moonrise look`

### Task 4: Look persistence and the no-flash boot

**Files:**
- Create: `frontend/src/look/look.ts`, `frontend/src/look/look.test.ts`
- Modify: `frontend/index.html`, `frontend/src/styles/base.css` (append page-level moon rules only)

**Interfaces:**
- Produces:
  ```ts
  export type Look = 'classic' | 'moon';
  export const LOOK_KEY = '1337.look';
  export function readInitialLook(): Look; // ?look= > storage > 'classic'; invalid values ignored
  export function saveLook(look: Look): void; // storage (try/catch), replaceState the `look` param only if present, set <html data-look>
  export function applyLookAttr(look: Look): void;
  ```
- `index.html`: inline `<script>` before the module script that mirrors `readInitialLook()` (try/catch) and sets `data-look`; inline `<style>html[data-look='moon']{background:#050505}</style>`.
- `base.css` (append): `html[data-look='moon'] body { background: #050505; }` and `html[data-look='moon'] body::before, html[data-look='moon'] body::after { display: none; }`.

- [ ] **Step 1: Failing tests:** default `classic`; storage `moon` → `moon`; `?look=classic` beats storage `moon`; `?look=nope` ignored; `saveLook('moon')` with `?look=classic&x=1` → URL `?look=moon&x=1` and storage `moon`; with no param the URL is unchanged; `saveLook` sets `document.documentElement.dataset.look`; **"survives storage that throws"** (`vi.spyOn(Storage.prototype,'getItem'/'setItem').mockImplementation(() => { throw … })`) → `readInitialLook()` is `classic`, `saveLook` does not throw.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/look` — PASS.
- [ ] **Step 5: Commit** `feat(frontend): remember the chosen look`

### Task 5: Moonrise stylesheet, page shell and ClassicLook split

**Files:**
- Create: `frontend/src/look/types.ts`, `frontend/src/ClassicLook.tsx`
- Create: `frontend/src/moonrise/moonrise.css`, `MoonriseLook.tsx`, `Scene.tsx`, `CloudFloor.tsx`, `Footer.tsx`, `LiveFeed.tsx`, `LiveIndicator.tsx`, `copy.ts`, `MoonriseLook.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Produces:
  ```ts
  // look/types.ts
  export interface DeskProps {
    onDesk: TaskDto[]; ended: TaskDto[]; departing: ReadonlySet<string>; log: LogLine[];
    status: StreamStatus; lastEventId: number | null; error: string | null;
    upsert(t: TaskDto): void; newestEventIds: Map<string, number>; now: number;
  }
  // ClassicLook.tsx — today's App JSX, unchanged
  export function ClassicLook(p: DeskProps): JSX.Element;
  // moonrise/MoonriseLook.tsx
  export default function MoonriseLook(p: DeskProps): JSX.Element; // root <div className="moonrise ms-noise">
  // moonrise/copy.ts
  export function problemText(p: Problem): string; // exact spec copy:
  // name-required|name-too-long → 'Give the timer a name of 1 to 100 characters.'
  // seconds-invalid → 'Seconds must be a whole number from 1 to 86400.'
  // server → first message, first letter capitalised; unreachable → "Couldn't reach the server. Check your connection and try again."
  // not-running → 'This timer already ended.'
  export function humanize(seconds: number): string; // 180 → '3m', 3725 → '1h 2m 5s', 0 → ''
  export const STATUS_WORD: Record<StreamStatus, string>; // open 'Live', connecting 'Connecting…', reconnecting 'Reconnecting…'
  ```
- `moonrise.css`: `tokens.css` + `bundle.css` (minus the clock rules already in `clock.css`), with the Google Fonts `@import` first, the `:root` / `[data-theme="night"]` token blocks and `--ms-noise` moved onto `.moonrise`, text-style classes and every component rule nested under `.moonrise { … }`, the `html, body` ground rules dropped (Task 4 covers them), `html.ms-scroll-locked` dropped (the existing `html:has(dialog[open])` rule locks scroll). Keyframes stay top level. The reduced-motion block at the end of `bundle.css` becomes `@media (prefers-reduced-motion: reduce)` rules under `.moonrise` whose exit fades (`ms-fade`) carry `!important` so classic `base.css`'s `animation: none !important` cannot cancel them. Add the page layout rules from `preview/index.html`'s `<style>` (`.wrap`, `.desk`, `.desk-cards`, `.desk-feed`, `.cards`, phone rules) under `.moonrise`, renamed `ms-wrap`, `ms-desk`, `ms-desk-cards`, `ms-desk-feed`, `ms-cards` so they can't collide with classic `.wrap`/`.desk`.
- `App.tsx`: keeps stream/now/departing/derivations, builds `DeskProps`, renders `<ClassicLook …/>` (the switch arrives in Task 9). `MoonriseLook` is reachable only through `React.lazy` from Task 9 on; this task tests it directly.
- `MoonriseLook` page order per spec: `Scene` (word `TIMER`, clock `fluid opticalCenter flicker pulseKey={lastEventId}`, `boot={false}`), `CloudFloor` (stream error line, start form slot, desk with cards slot + `LiveFeed` + `LiveIndicator size="lg"`; empty desk "Nothing running"), archive slot, `Footer` (GitHub ↗ new tab, Transcripts, Notebook buttons styled as belt links). Slots are filled by Tasks 6–8.
- `LiveFeed`: lines oldest first (the log already is), auto-scroll to the newest on change, newest gets `ms-feed-new`, footer "Last event #n" / "No events yet", empty "Waiting for the first event.", list `aria-live="polite"`.

- [ ] **Step 1: Failing tests** (`MoonriseLook.test.tsx`, plain props, no stream mock needed): root has class `moonrise`; status `open` shows "Live"; log lines render as `#id name state`; "Last event #7"; empty desk shows "Nothing running"; `error` renders with `role="alert"`; GitHub link has `target="_blank"` and `rel="noopener noreferrer"`; `humanize(3725) === '1h 2m 5s'`; `problemText({kind:'server',messages:['name must be shorter']})` → `'Name must be shorter'`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test && npm run lint && npm run build` — PASS; `App.test.tsx` unchanged and green.
- [ ] **Step 5: Commit** `feat(frontend): Moonrise page shell and scoped styles`

### Task 6: Moonrise start form and timer cards

**Files:**
- Create: `frontend/src/moonrise/StartForm.tsx`, `TimerCard.tsx`, `MoonPhase.tsx`, `HistoryPopover.tsx` + `TimerCard.test.tsx`, `StartForm.test.tsx`
- Modify: `frontend/src/moonrise/MoonriseLook.tsx` (fill the form and cards slots)

**Interfaces:**
- Consumes: `useStartTask`, `useCancelTask`, `useTaskHistory`, `problemText`, `humanize`, `secondsEgg`, `SegmentClock`, `formatCountdown`, `formatClock`, `remainingMs`.
- Produces:
  ```ts
  export function MoonStartForm(p: { onCreated(t: TaskDto): void }): JSX.Element;
  export function TimerCard(p: { task: TaskDto; now: number; departing: boolean; onChanged(t: TaskDto): void;
    newestEventId: number | null; glow: boolean }): JSX.Element;
  export function MoonPhase(p: { progress: number; size?: number }): JSX.Element; // aria-label `${pct}% elapsed`
  export function HistoryPopover(p: { taskId: string; name: string; refreshKey: number | null; variant: 'card' | 'row' }): JSX.Element;
  ```
- Start form: labels "Name" / "Seconds", placeholder "tea", default seconds "180", button "Start timer →" / "Starting…", hint always shown: `= LEET`, `= HELL NAW`, else `= ${humanize(n)}` (empty when not a positive int); one error line = `problemText(problems[0])`, `role="alert"`.
- Card: state word Running / Finishing… (remaining 0 while running) / Cancelling… / Finished / Cancelled; countdown clock height 52, `urgent` when running and ≤10s or finishing, `dim` when not live, `glow` prop; "Ends {formatClock(endsAt)}"; History / Hide history toggles a `HistoryPopover`; Cancel disabled unless running and not cancelling/locked; `problem` → `problemText` under the card; `departing` → class `ms-exit-finished` or `ms-exit-cancelled`; mount adds an entering class (rise 24px + fade, `dur-slow`, add `.ms-enter` keyframes to `moonrise.css`). `MoonriseLook` passes `glow={onDesk.length <= 20}`.
- History popover copy: "Loading…", "Couldn't load the history.", events as `#id State at`.

- [ ] **Step 1: Failing tests:** card counts down from `endsAt`; shows "Finishing…" at 0; one cancel request on double click; 409 shows "This timer already ended." and Cancel stays disabled; History opens a region "History of {name}" and Hide history closes it; departing finished task has `ms-exit-finished`; **"drops the card glow above 20 timers"** (render `MoonriseLook` with 21 running tasks → no card clock svg has a `filter` attribute; with 20 they do); form: empty name shows the name sentence, `1337` hint "= LEET", 180 hint "= 3m", success clears the name and calls `onCreated`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test && npm run lint` — PASS.
- [ ] **Step 5: Commit** `feat(frontend): Moonrise start form and timer cards`

### Task 7: Moonrise archive

**Files:**
- Create: `frontend/src/moonrise/Archive.tsx`, `Archive.test.tsx`
- Modify: `frontend/src/moonrise/MoonriseLook.tsx`

**Interfaces:**
- Consumes: `useArchive`, `HistoryPopover`, `humanize`, `formatCountdown`, `formatClock`.
- Produces: `export function MoonArchive(p: { ended: TaskDto[]; newestEventIds: Map<string, number> }): JSX.Element | null;`
- Renders nothing when `ended` is empty. "Archive" (`display-m`), `dl.ms-stats` with Finished / Cancelled / Time spent (`humanize(round(spentMs/1000))`, "0s" when zero), table columns Name / State / Duration / Ended / (empty), state as a coloured word, duration `formatCountdown(durationSeconds*1000)`, ended `formatClock(updatedAt)`; History opens one row popover at a time (`openId` state); "Show all (n)" / "Show less" when more than 20.

- [ ] **Step 1: Failing tests:** hidden with no ended tasks; 25 rows → 20 until "Show all (25)", then 25 and "Show less"; stats values `25`, `1`, `26m` for the `App.test.tsx` fixture shape; opening row B's history closes row A's.
- [ ] **Step 2–4:** run (FAIL), implement, run `npm test && npm run lint` (PASS).
- [ ] **Step 5: Commit** `feat(frontend): Moonrise archive`

### Task 8: Moonrise sheets: transcripts and notebook

**Files:**
- Create: `frontend/src/moonrise/Sheet.tsx`, `Transcripts.tsx`, `Notebook.tsx` + `Transcripts.test.tsx`, `Notebook.test.tsx`
- Modify: `frontend/src/moonrise/MoonriseLook.tsx` (footer buttons open them)

**Interfaces:**
- Consumes: `TRANSCRIPTS`, `transcriptHref`, `useTranscript`, `DrawLayer`.
- Produces:
  ```ts
  export function Sheet(p: { title: string; open: boolean; onClose(): void; escCloses?: boolean; className?: string;
    footer?: ReactNode; children?: ReactNode }): JSX.Element; // native <dialog> + showModal; Esc → onClose unless escCloses === false (then ignored)
  export function MoonTranscripts(p: { open: boolean; onClose(): void }): JSX.Element;
  export function MoonNotebook(p: { open: boolean; onClose(): void }): JSX.Element;
  ```
- Transcripts: list sheet "Transcripts" with the note verbatim (same lowercase text as classic), rows title · `n KB` · Preview · Download ↓ (`download` attr); preview sheet titled with the transcript title, `.ms-crt` with head `"{file} · {n} KB · {lines} lines"` and the text in `pre.ms-crt-text`, footer Download ↓ and Close; "Loading…" / "Couldn't load this transcript."; closing the preview keeps the list open.
- Notebook: sheet "Notebook", `escCloses={false}`; spread per `bundle.js` `Notebook` (lines 393–418) with `coverSrc`, `paperSrc`, `leftSrc=/notes-1.webp`, `rightSrc=/notes-2.png`, alts "Handwritten notes, page 1/2", `pageWidth = nbWidth()` from `preview/index.html`; auto-opens after 1800ms (0 with reduced motion); cover click opens; `DrawLayer ink="#ff2a1f"` absolutely positioned over the whole `.ms-nb-book` spread, `pointer-events` enabled only 1100ms after opening; footer "Handwritten · 22 Oct 2026", Clear (remounts the draw layer), Close (closes the cover, calls `onClose` after 2300ms). Opening always starts blank (remount on open).

- [ ] **Step 1: Failing tests** (fake timers where needed): transcripts list shows three rows with download links; Preview shows the fetched text inside `.ms-crt`; a failed fetch shows "Couldn't load this transcript."; notebook: open shows the cover, after 1800ms the book has `ms-notebook-open`; Esc keydown does not call `onClose`; Close calls `onClose` only after 2300ms; the draw layer canvas is inside the spread with `strokeStyle` red after a stroke; Clear resets `data-strokes` to 0.
- [ ] **Step 2–4:** run (FAIL), implement, run `npm test && npm run lint` (PASS).
- [ ] **Step 5: Commit** `feat(frontend): Moonrise transcripts and notebook sheets`

### Task 9: The switch: button, loader, transition controller, overlay

**Files:**
- Create: `frontend/src/look/loadMoonrise.ts`, `useLookSwitch.ts`, `LookSwitch.tsx`, `LookTransition.tsx`, `look.css`, `useLookSwitch.test.tsx`, `switch.test.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/moonrise/Scene.tsx` (one-off moon rise on arrival)

**Interfaces:**
- Consumes: `readInitialLook`, `saveLook`, `applyLookAttr`, `SegmentClock`, `reducedMotion`, `DeskProps`.
- Produces:
  ```ts
  // loadMoonrise.ts
  export function loadMoonrise(): Promise<typeof import('../moonrise/MoonriseLook')>; // memoised; a rejection clears the memo
  export function preloadMoonrise(): void; // fire and forget, swallow errors
  export function isMoonriseReady(): boolean; // chunk, fonts and photos settled
  // useLookSwitch.ts
  export type Phase = 'idle' | 'cover' | 'boot' | 'failed' | 'uncover' | 'reveal';
  export function useLookSwitch(): {
    shown: Look | null; target: Look; phase: Phase; origin: { x: number; y: number };
    switchTo(next: Look, origin: { x: number; y: number }): void; retry(): void; back(): void;
  };
  export function LookSwitch(p: { look: Look; busy: boolean; onSwitch(origin: {x:number;y:number}): void }): JSX.Element;
  export function LookTransition(p: { phase: Phase; target: Look; origin: {x:number;y:number}; ready: boolean;
    onRetry(): void; onBack(): void }): JSX.Element | null;
  ```
- `loadMoonrise`: `import('../moonrise/MoonriseLook')`, then in parallel (each capped by one shared 8000ms race, failures ignored) `document.fonts?.load('700 64px Archivo')`, `document.fonts?.load('400 15px Geist')`, and `decode()` of `/moonrise/moon.webp` and `/moonrise/clouds.webp`. Only the import can reject.
- Controller state machine (timings in Global Constraints):
  - Start: `readInitialLook()`; classic → `shown='classic'`, `idle`; moon → `shown=null`, `boot` (overlay already covering), `applyLookAttr('moon')`.
  - `switchTo('moon')` from idle: `cover` → after cover, `boot`; boot ends when `loadMoonrise()` resolved and the hold has passed (500ms if `isMoonriseReady()` at click, else 1200ms; reduced motion 0) → `shown='moon'`, `saveLook('moon')`, `scrollTo(0,0)` → `reveal` → `idle`. Rejection → `failed`.
  - `retry()` from failed → `boot` with a new `loadMoonrise()`.
  - `back()` from failed → `uncover` → `shown='classic'`, `saveLook('classic')` → `idle`.
  - `switchTo('classic')` from idle: `cover` (600ms) → `shown='classic'`, `saveLook('classic')`, `scrollTo` → `reveal` (300ms) → `idle`.
  - Any `switchTo` while not `idle` is ignored.
- `LookTransition`: fixed full-screen `aria-hidden` layer, z-index 1000. Moon: `#050505`, `clip-path: circle(r at x y)` grown via CSS transition on `phase`, star field (reuse the `Scene` star generator), `SegmentClock value="1337" fluid opticalCenter boot={ready ? false : 'hold'}` in a box with the same rules as `.ms-scene-content > .ms-clock`; `failed` shows "Couldn't load the night. Try again." with Try again and Back buttons (these are not aria-hidden: put them in a sibling focusable region). Classic target: `var(--paper)` circle, no clock. Reduced motion: fades only (the 150ms `opacity` transition in `look.css` carries `!important` with a class selector so it beats `base.css`), "Loading…" after 400ms. A polite live region outside it says "Switching to Moonrise…" / "Switching to classic…".
- `LookSwitch`: fixed bottom-right (24px; 16px under 600px), 44×44; classic: ink square, paper crescent SVG, hard shadow hover like `.btn`, `aria-label="Switch to Moonrise"`, `onPointerEnter`/`onFocus` → `preloadMoonrise()`; moon: glass, silver sun-outline SVG, `aria-label="Switch to classic"`; `disabled` while `busy`. Origin = the button's centre.
- `App`: `const sw = useLookSwitch()`; render `ClassicLook` when `shown==='classic'`, `<Suspense fallback={null}><LazyMoonrise …/></Suspense>` when `'moon'`, nothing when `null`; then `LookSwitch` and `LookTransition`. `LazyMoonrise = lazy(loadMoonrise)`.
- `Scene`: when mounted right after a switch (`document.documentElement` has `data-arriving`, set by the controller during `reveal`), the moon layer gets class `ms-moon-arrive` (keyframes on `translate: 0 12%` → `0 0`, 1200ms `ease-drift`).

- [ ] **Step 1: Failing controller tests** (`renderHook`, fake timers, `vi.mock('./loadMoonrise')`): idle classic by default; `switchTo('moon')` walks `cover → boot → reveal → idle` with `shown` becoming `moon` and storage `moon`; with `isMoonriseReady() === true` the boot lasts 500ms not 1200ms; a rejected load ends in `failed`, `retry()` calls `loadMoonrise` again, `back()` ends at `shown='classic'` and storage `classic`; **"ignores clicks while switching"** (second `switchTo` during `cover` changes nothing and loads once); stored `moon` starts at `shown=null`, `phase='boot'`.
- [ ] **Step 2: Failing App-level test** (`switch.test.tsx`, `useTaskStream` mocked as in `App.test.tsx`, `loadMoonrise` real so `React.lazy` resolves, `document.fonts` absent, `Image.prototype.decode` stubbed): the "Switch to Moonrise" button exists; clicking it and running timers ends with a `.moonrise` root and `html[data-look="moon"]`; "Switch to classic" brings the classic `.top` header back and `data-look="classic"`; the stream is never remounted: give the mocked `useTaskStream` an implementation that runs `useEffect(() => { mounts += 1 }, [])` and returns the fixture, switch moon → classic → moon, assert `mounts === 1`.
- [ ] **Step 3: Run** — FAIL. **Step 4: Implement.** **Step 5: Run** `npm test && npm run lint && npm run build` — PASS. Check `dist/assets` has a separate Moonrise JS and CSS chunk and the main CSS has no `ms-panel` rule: `grep -l "ms-panel" dist/assets/*.css` lists only the Moonrise chunk.
- [ ] **Step 6: Commit** `feat(frontend): moon switch with the Moonrise loading transition`

### Task 10: Docs

**Files:**
- Modify: `frontend/README.md` (a short "Looks" section: the moon button, `?look=moon|classic`, `1337.look`, where the Moonrise code lives), `design-system-moonrise/README.md` ("Building it into the frontend" → one paragraph pointing at the spec and `frontend/src/moonrise/`, noting the app's logic hooks are used instead of the reference build's behaviour where they differ).
- [ ] **Step 1:** Edit both. **Step 2:** `npx prettier --check README.md ../design-system-moonrise/README.md` → clean. **Step 3: Commit** `docs: how the two looks fit together`

### Task 11: Browser verification

- [ ] **Step 1:** Start the backend (launch config `backend`, which runs from the `feature/backend` worktree) and this worktree's frontend (add a launch config `frontend-dev` pointing `npm --prefix …/.claude/worktrees/dev/frontend run dev`, port 5173; stop any other frontend on 5173 first).
- [ ] **Step 2:** Classic loads unchanged plus the moon button; start two timers.
- [ ] **Step 3:** Click the moon: circle, scramble, lock-in, moon rise; the timers and the feed are still there, connection stays "Live" (network panel: no second `/api/tasks/stream` request).
- [ ] **Step 4:** Scroll: `TIMER` rise and parallax; cancel a timer (exit animation); open a history popover, transcripts preview, notebook (auto-open, draw on both pages in red, Esc ignored, Close swings shut).
- [ ] **Step 5:** Switch back: paper circle; classic visuals intact (no Moonrise fonts on classic text, body grain back). Switch again: fast path (~2s total).
- [ ] **Step 6:** Reload while in Moonrise: no paper flash; `?look=classic` opens classic without changing storage.
- [ ] **Step 7:** 375px width and `prefers-reduced-motion` emulation in both directions.
- [ ] **Step 8:** Fix anything found (with a test where it is logic), re-run `npm test && npm run lint && npm run build`, commit.
