# Seconds Hint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a faded `= 25M`-style hint above the SECONDS field while it is focused.

**Architecture:** A pure `formatDuration(seconds)` in `time/format.ts`; `StartForm` tracks focus and renders the hint inside `.start-seconds`, always in the DOM so it can fade, toggled by a class.

**Tech Stack:** React 19, Vitest + Testing Library, CSS.

**Spec:** `docs/superpowers/specs/2026-10-22-seconds-hint-design.md`

## Global Constraints

- No backend change; the API still receives `durationSeconds`.
- Hint shown only when focused and the value is a whole number 60–86400.
- Copy: `= ` + parts, zero parts omitted, inner parts padded to 2 digits.

## Review Focus

- Value with spaces (` 1500 `): validation already trims, so the hint should too. → Task 1 test.
- Blur while showing: hint hides. → Task 1 test.
- Over 86400 or non-numeric: no hint. → Task 1 test.

---

### Task 1: Seconds hint

**Files:** `frontend/src/time/format.ts`, `format.test.ts`, `frontend/src/components/StartForm.tsx`, `StartForm.css`, `StartForm.test.tsx`

**Interfaces:** Produces `formatDuration(totalSeconds: number): string` (no `=`; e.g. `25M`, `1H 02M 05S`, `2H`, `1H 05S`, `45S`).

- [ ] **Step 1: Failing tests** — `formatDuration`: `1500 → '25M'`, `3725 → '1H 02M 05S'`, `7200 → '2H'`, `3605 → '1H 05S'`, `1505 → '25M 05S'`, `45 → '45S'`. `StartForm`: `it('hints minutes and hours while typing seconds')` — focus SECONDS, clear, type `1500` → element `#start-seconds-hint` has class `on` and text `= 25M`; type to `45` → no `on`; type ` 3725 ` → `= 1H 02M 05S`; `86401` and `abc` → no `on`; blur → no `on`; input `aria-describedby="start-seconds-hint"`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — `focused` state via onFocus/onBlur; `<span id="start-seconds-hint" className={on ? 'start-hint on' : 'start-hint'}>`; `.start-seconds { position: relative }`; `.start-hint`: absolute, `right: 0; bottom: 100%`, mono 11.5px, `--label-weight`, `color: var(--ink)`, `opacity: 0`, `transform: translateY(4px)`, transition opacity/transform `--dur-base` `--ease-1337`, `pointer-events: none`; `.on`: `opacity: 0.5; transform: none`; reduced motion: no transform.
- [ ] **Step 4: Run** `npm test`, lint, `npx tsc -b` → pass.
- [ ] **Step 5: Commit** — `feat(frontend): faded minutes/hours hint while typing seconds`
- [ ] **Step 6: Browser check** — hint position over the label line, fade, 375px.
