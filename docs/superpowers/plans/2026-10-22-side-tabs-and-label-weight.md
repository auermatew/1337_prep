# Side Tabs, Two-Page Notebook, Heavier Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop section numbers, make mono labels heavier, move transcripts into a right-edge drawer opened from a side tab (with a casual disclaimer), and replace the notebook picture with a two-page spread on paper.

**Architecture:** Frontend only. A fixed `.side-tabs` column on the right edge holds the `TRANSCRIPTS` and `NOTES` buttons; each owns its native `<dialog>` via the existing `Dialog`. The transcripts drawer is a `Dialog` with a `dlg-drawer` class positioned against the right edge; the preview stays a second, centred `Dialog` on top. Label weight comes from one `--label-weight` custom property.

**Tech Stack:** React 19, Vite 8, Vitest 4 + Testing Library, plain CSS with 1337 tokens.

**Spec:** `docs/superpowers/specs/2026-10-22-side-tabs-and-label-weight-design.md` (follows `2026-10-22-transcripts-notebook-stats-design.md`)

## Global Constraints

- `src/styles/tokens.css` is a verbatim copy of the design system: never edit it. New properties go in `App.css` `:root`.
- Tags read `TIMERS`, `ARCHIVE`; no `NN ·` prefix anywhere.
- Mono labels: weight 600 (`--label-weight: 600`); muted label colour moves from `--muted` to `--ink-mute`. Serif headlines and sans body unchanged.
- Disclaimer copy, exact: `heads up: these aren't all my sessions, and not every prompt I sent is in here either. exporting everything got a bit much lol. happy to show you the rest in person though :)`
- Notebook paper is the same in light and dark mode.
- 375px: no horizontal page scroll; side tabs stay inside the 16px gutter.

## Review Focus

- Esc with the preview open over the drawer closes only the preview; a second Esc closes the drawer. → Task 2 test (CLOSE on preview leaves drawer open) + browser check.
- Reopening the drawer after closing it shows the list again, not a stale preview. → Task 2 test.
- Drawer content taller than the viewport scrolls inside the drawer, page behind does not scroll. → browser check.
- Transparent PNG/WebP pages are legible on the paper in dark mode (paper does not follow `--paper`). → browser check.
- `prefers-reduced-motion`: drawer appears without sliding. → CSS, browser check.

---

### Task 1: No section numbers, heavier labels

**Files:**
- Modify: `frontend/src/App.tsx`, `frontend/src/components/Archive.tsx`, `frontend/src/App.test.tsx`
- Modify CSS: `App.css` (add `--label-weight: 600` to `:root`), and every `font-weight: 500` in `App.css`, `StartForm.css`, `Archive.css`, `TimerWindow.css`, `Window.css`, `Notebook.css`, `Transcripts.css` → `var(--label-weight)`; label rules using `color: var(--muted)` (`.arc th`, `.arc-stat dt`, `.win-foot`, `.hist-id/.hist-at`, `.hist-note`) → `var(--ink-mute)`.

- [ ] **Step 1: Failing test** — in `App.test.tsx`, existing assertions change to `getByText('ARCHIVE')` / `queryByText('ARCHIVE')`; add `it('labels sections without numbers')`: render with one finished task; `getByText('TIMERS')` and `getByText('ARCHIVE')` exist, `queryByText(/^\d\d · /)` is null.
- [ ] **Step 2: Run** `npx vitest run src/App.test.tsx` → FAIL (text is `01 · TIMERS`).
- [ ] **Step 3: Implement** — change the two tag strings; the CSS sweep above.
- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npx tsc -b` → all pass.
- [ ] **Step 5: Commit** — `style(frontend): unnumbered section tags, heavier mono labels`

### Task 2: Side tabs and transcripts drawer

**Files:**
- Create: `frontend/src/components/SideTabs.css` (shared `.side-tabs` column + `.side-tab` button style, moved from `.nb-tab` in `Notebook.css`)
- Modify: `frontend/src/components/Transcripts.tsx`, `Transcripts.css`, `Transcripts.test.tsx`, `Dialog.css`, `Notebook.tsx`, `Notebook.css`, `App.tsx`, `App.test.tsx`

**Interfaces:**
- `Transcripts()` now renders `<button className="side-tab">TRANSCRIPTS</button>` + drawer `Dialog` (title `transcripts/`, className `dlg-drawer`, footer `CLOSE`) + the existing preview `Dialog`. Drawer body: `<p className="tr-note">` disclaimer, then the existing `<ul className="tr-list">`.
- `Notebook()` button gets `className="side-tab"` (was `nb-tab`).
- `App.tsx`: remove `<Transcripts />` from `<main>`; render `<div className="side-tabs"><Transcripts /><Notebook /></div>` where `<Notebook />` was.

- [ ] **Step 1: Failing tests** (`Transcripts.test.tsx`; add helper `openDrawer()` that clicks button `TRANSCRIPTS`; existing tests call it first)
  - `opens the drawer from the side tab`: after click, dialog named `transcripts/` is open; it contains the exact disclaimer text and three `listitem`s.
  - `keeps the drawer open when the preview closes`: open drawer, PREVIEW row 0, click the preview's `CLOSE` → preview dialog closed, drawer dialog still open.
  - `closes the drawer with CLOSE`: drawer's own `CLOSE` → drawer closed.
  - `shows the list again after reopening`: open drawer, PREVIEW, close preview, close drawer, reopen → no preview dialog open.
  - `App.test.tsx`: `queryByText('TRANSCRIPTS', { selector: 'p' })` is null (no on-page section) and `getByRole('button', { name: 'TRANSCRIPTS' })` exists.
  - Note: both dialogs have a `CLOSE` button; scope queries with `within(dialog)`.
- [ ] **Step 2: Run** → FAIL (no TRANSCRIPTS button).
- [ ] **Step 3: Implement.**
  - `.side-tabs`: `position: fixed; right: 0; top: 50%; transform: translateY(-50%); z-index: 10; display: flex; flex-direction: column; gap: 8px`. `.side-tab`: the current `.nb-tab` look minus its own positioning; hover lift `translateX(-2px)` + `--ink-shadow-hard-sm`; phone rules (16px wide) carry over.
  - `.dlg.dlg-drawer`: `margin: 0 0 0 auto; width: min(440px, 100vw); height: 100dvh; max-height: 100dvh`; its `.win` fills the height (`height: 100%`, no right margin, no shadow on the right), body scrolls; slide-in `@keyframes` from `translateX(100%)` with `--ease-1337` over `--dur-swap`, disabled under reduced motion.
  - Remove `.transcripts` section rules; `.tr-note`: mono 11.5px lowercase, `--label-weight`, `line-height: 1.6`, 1px dashed purple outline, 12px padding, `margin-bottom: var(--space-5)`.
  - Drawer rows: drop the size column under 440px only if they overflow; keep title, size, PREVIEW, DOWNLOAD ↓.
- [ ] **Step 4: Run** `npm test`, lint, `npx tsc -b` → pass.
- [ ] **Step 5: Commit** — `feat(frontend): transcripts drawer from a side tab, with a heads-up note`

### Task 3: Two-page notebook on paper

**Files:**
- Delete: `frontend/public/notebook.webp`
- Create: `frontend/public/notes-1.webp` (from the uploaded `2.webp`), `frontend/public/notes-2.png` (from `3.png`)
- Modify: `Notebook.tsx`, `Notebook.css`, `Notebook.test.tsx`

- [ ] **Step 1: Failing test** — `opens the two notebook pages`: click `NOTES` → dialog named `notebook/` open; two `img`: alt `Notes, page 1` src `/notes-1.webp`, alt `Notes, page 2` src `/notes-2.png`; `CLOSE` closes.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — body `.nb-paper`: `display: grid; grid-template-columns: 1fr 1fr`, background fixed `#f7f3ea` with a dot grid (`radial-gradient(#d9d2c3 1px, transparent 1.2px) 0 0 / 18px 18px`) and a centre fold (`linear-gradient` 1px rule at 50% with a soft shade either side). Images `width: 100%; height: auto; max-height: calc(100dvh - 160px); object-fit: contain`, intrinsic 1052×1494 / 1055×1491. Dialog `width: min(1100px, 100vw - 32px)`. Under 600px: one column, no fold, body scrolls. Footer `HANDWRITTEN · 2026-10-22` + `CLOSE`.
- [ ] **Step 4: Run** `npm test`, lint, `npx tsc -b`, `npm run build` → pass.
- [ ] **Step 5: Commit** — `feat(frontend): two-page notebook on paper`

### Task 4: Browser check

- [ ] Desktop dark + light, 375px: tags unnumbered and labels heavier; both side tabs; drawer slides in, scrolls, note visible; preview over drawer, Esc closes preview then drawer; notebook spread legible in dark mode; no horizontal scroll.
