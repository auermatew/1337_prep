# Transcripts, Notebook and Archive Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add archive stats (finished, cancelled, actual time spent), a transcripts section with plain-text preview and download, and a side notebook tab that opens the handwritten notes picture.

**Architecture:** Pure frontend. Transcripts and the picture are static files in `frontend/public/`, fetched or linked on demand. Preview and notebook share one `Dialog` component: a native `<dialog>` opened with `showModal()`, framed by the existing `Window`. Stats are a pure function over the ended tasks the archive already receives.

**Tech Stack:** React 19, Vite 8, Vitest 4 + Testing Library (jsdom), plain CSS with the 1337 tokens.

**Spec:** `docs/superpowers/specs/2026-10-22-transcripts-notebook-stats-design.md`

## Global Constraints

- No new dependencies. No backend changes.
- Plain text preview only, no markdown rendering.
- Exactly three transcripts; the list is hard-coded.
- Actual time per task = `updatedAt − startedAt`; total over finished + cancelled tasks.
- Copy is uppercase mono for labels: `03 · TRANSCRIPTS`, `PREVIEW`, `DOWNLOAD ↓`, `CLOSE`, `NOTES`, `FINISHED`, `CANCELLED`, `TIME SPENT`, `LOADING…`, `COULD NOT LOAD TRANSCRIPT`.
- Square corners, hard ink shadows, purple as the only accent; reuse `.tag`, `.btn`, `.link-btn`, `.err-line`, `Window`.
- Works at 390px width with no horizontal page scroll, and in the dark theme.

## Review Focus

- `updatedAt` earlier than `startedAt` (clock skew between processes): that task counts 0, never negative. → Task 1 test.
- Stats count every ended task, not just the first 20 rows. → Task 1 test.
- Transcript fetch fails (404 / network): dialog shows `COULD NOT LOAD TRANSCRIPT`, does not hang on `LOADING…`. → Task 2 test.
- Long unbroken lines in a transcript wrap inside the dialog instead of widening the page (`white-space: pre-wrap; overflow-wrap: anywhere`). → Task 2 CSS, checked in browser.
- Esc / CLOSE closes the dialog and focus returns to the button that opened it (native `<dialog>` does this; the component must not remount the trigger). → Task 2 test (close path).

---

### Task 1: Archive stats

**Files:**
- Create: `frontend/src/time/stats.ts`, `frontend/src/time/stats.test.ts`
- Modify: `frontend/src/time/format.ts` (add `formatSpent`), `frontend/src/time/format.test.ts`
- Modify: `frontend/src/components/Archive.tsx`, `frontend/src/components/Archive.css`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Produces: `archiveStats(tasks: TaskDto[]): { finished: number; cancelled: number; spentMs: number }`; `formatSpent(ms: number): string`.

- [ ] **Step 1: Failing tests**

`format.test.ts` — `describe('formatSpent')`: `formatSpent(0) === '0S'`, `formatSpent(42_000) === '42S'`, `formatSpent(61_000) === '1M 01S'`, `formatSpent(3_852_000) === '1H 04M 12S'`, `formatSpent(1_400) === '1S'` (rounds to nearest second), `formatSpent(-5) === '0S'`.

`stats.test.ts` — with the `task()` factory from `format.test.ts`:
- counts: two finished + one cancelled + one running → `{ finished: 2, cancelled: 1 }`; running is ignored in `spentMs` too.
- `spentMs`: finished started 10:00:00 updated 10:00:10 plus cancelled started 10:00:00 updated 10:00:04 → `14_000`.
- skew: `updatedAt` one second before `startedAt` → contributes `0`.

`App.test.tsx` — `it('shows archive stats over all ended tasks')`: 25 finished tasks (60 s each via the existing `task()` factory) + 1 cancelled → region labelled `ARCHIVE STATS` contains `25` next to `FINISHED`, `1` next to `CANCELLED`, and `26M 00S` next to `TIME SPENT`.

- [ ] **Step 2: Run, expect FAIL** — `npm test -- src/time src/App.test.tsx` fails on missing exports / missing region.

- [ ] **Step 3: Implement**

`formatSpent` in `format.ts`: round to whole seconds, clamp at 0; omit leading zero units (`42S`, `1M 01S`, `1H 04M 12S`), pad inner units to 2 digits.
`archiveStats` in `time/stats.ts`: single pass; `Math.max(0, Date.parse(updatedAt) − Date.parse(startedAt))` per non-running task.
In `Archive.tsx`, compute from `tasks` (all ended, before paging) with `useMemo`, render between the tag and the table:

```tsx
<dl className="arc-stats" aria-label="ARCHIVE STATS">
  <div><dt>FINISHED</dt><dd>{finished}</dd></div>
  <div><dt>CANCELLED</dt><dd>{cancelled}</dd></div>
  <div><dt>TIME SPENT</dt><dd>{formatSpent(spentMs)}</dd></div>
</dl>
```

CSS: three equal columns separated by 1px `--line` hairlines (stat columns per the design system), `dt` mono label muted 9.5px, `dd` serif display weight 200 ~40px (28px under 600px). `FINISHED` value purple. Columns stay three across on phones.

- [ ] **Step 4: Run, expect PASS** — `npm test`, `npm run lint`, `npx tsc -b`.

- [ ] **Step 5: Commit** — `feat(frontend): archive stats for finished, cancelled and time spent`

### Task 2: Dialog and transcripts section

**Files:**
- Create: `frontend/public/transcripts/1337-design-system.md` (copy of `/Users/auermate2005/main/1337test/docs/transcripts/2026-10-22-1337-design-system-chat.md`), `frontend/public/transcripts/backend-planning.md` (copy of `/Users/auermate2005/Downloads/chat-transcript-2026-10-22-backend planning.md`), `frontend/public/transcripts/backend-build.md` (copy of `/Users/auermate2005/main/1337test/chat-transcript-2026-10-22.md`)
- Create: `frontend/src/components/Dialog.tsx`, `Dialog.css`, `Transcripts.tsx`, `Transcripts.css`, `Transcripts.test.tsx`
- Create: `frontend/src/test/dialog.ts` (jsdom polyfill), modify `vite.config.ts` `test.setupFiles`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Produces: `Dialog({ title, open, onClose, footer?, className?, children })` — renders `<dialog>` containing `<Window title footer>`; calls `showModal()` when `open` becomes true and `close()` when false; listens for the native `close` event to call `onClose`; backdrop click (target is the dialog itself) closes.
- Produces: `TRANSCRIPTS: { title: string; file: string; bytes: number }[]` in `Transcripts.tsx`, order: design system, backend planning, backend build. Titles: `1337 design system`, `Backend planning`, `Backend build session`. `bytes` from `wc -c`.

- [ ] **Step 1: jsdom polyfill** — `src/test/dialog.ts`: if `HTMLDialogElement.prototype.showModal` is missing, define `showModal` (sets `open`) and `close` (removes `open`, dispatches `close`). Register as `test.setupFiles: ['./src/test/dialog.ts']`.

- [ ] **Step 2: Failing tests** (`Transcripts.test.tsx`, `fetch` stubbed per test)
- `lists the three transcripts`: three rows with the titles above; each has a `DOWNLOAD ↓` link whose `href` is `/transcripts/<file>` and has a `download` attribute equal to the file name.
- `previews a transcript as plain text`: fetch resolves `new Response('# Title\n**bold**')`; click `PREVIEW` on row 1 → dialog with name `1337-design-system.md` is open and contains a `pre` with text exactly `# Title\n**bold**`; fetch called with `/transcripts/1337-design-system.md`.
- `shows an error when the transcript cannot load`: fetch resolves `new Response('', { status: 404 })` → `COULD NOT LOAD TRANSCRIPT`.
- `closes with CLOSE`: open, click `CLOSE` → dialog no longer has `open`.

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: Implement**

Copy the three files. `Transcripts` section: `<p className="tag">03 · TRANSCRIPTS</p>`, then a list styled like the archive rows (mono, hairlines): title, size in KB (`14 KB`), `PREVIEW` link-btn, `DOWNLOAD ↓` `<a className="link-btn" href download>`. One `Dialog` for the selected transcript; fetch on open (treat `!res.ok` as failure), ignore a stale response if the selection changed. Body: `LOADING…` (`.hist-note` style), error `.err-line`, or `<pre className="tr-text">`. Footer: `DOWNLOAD ↓` link and `CLOSE` button (`btn btn-ghost btn-sm`).
Dialog CSS: no native border/padding, `max-width: min(960px, 100vw − 32px)`, `max-height: 85vh`; body scrolls; `::backdrop` ink at ~40% opacity. `.tr-text`: mono 12px, `white-space: pre-wrap; overflow-wrap: anywhere; margin: 0`.
Mount `<Transcripts />` in `App.tsx` after `<Archive>`, wrapped in `<section className="transcripts">` with `margin-top: var(--space-section)`.

- [ ] **Step 5: Run, expect PASS** — `npm test`, lint, `npx tsc -b`.

- [ ] **Step 6: Commit** — `feat(frontend): transcripts section with plain-text preview and download`

### Task 3: Notebook tab and GitHub link

**Files:**
- Create: `frontend/public/notebook.webp` (copy of the provided picture)
- Create: `frontend/src/components/Notebook.tsx`, `Notebook.css`, `Notebook.test.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/App.css`, `frontend/src/App.test.tsx`

GitHub link: `App.test.tsx` `it('links to the GitHub repo in a new tab')` — link named `GITHUB ↗` has `href` `https://github.com/auermatew/1337_prep`, `target` `_blank`, `rel` `noopener noreferrer`. Implement as `<a className="link-btn top-gh">` in the header between wordmark and stream label (header keeps `space-between`; group the link and stream label on the right). Same red/green/commit cycle as the notebook, one commit for both.

**Interfaces:**
- Consumes: `Dialog` from Task 2.
- Produces: `Notebook()` — no props.

- [ ] **Step 1: Failing test** — `opens the notes picture`: button named `NOTES` exists; clicking it opens a dialog titled `notebook.webp` containing `img` with `src` `/notebook.webp` and alt `Handwritten planning notes`; `CLOSE` closes it.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** — fixed button on the right edge, vertically centred (`position: fixed; right: 0; top: 50%`), ink fill, paper text, text rotated with `writing-mode: vertical-rl`, a 9px purple square above the label, lift-on-hover like `.btn`, `z-index` above page content. Dialog with the image: `max-width: 100%; max-height: 75vh; display: block; margin: auto`, `loading="lazy"`, footer `CLOSE`. Mount in `App.tsx` inside `.wrap`.

- [ ] **Step 4: Run, expect PASS** — `npm test`, lint, `npx tsc -b`, `npm run build`.

- [ ] **Step 5: Commit** — `feat(frontend): notebook tab with the handwritten notes`

### Task 4: Browser check

- [ ] Start `frontend` and `backend` from `.claude/launch.json`. Create one timer, cancel another, let one finish. Confirm stats, preview (scroll, long lines wrap, Esc closes), downloads, notebook — desktop, 375px, and dark scheme. Screenshot each.
