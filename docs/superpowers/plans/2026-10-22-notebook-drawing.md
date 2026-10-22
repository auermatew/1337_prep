# Notebook Drawing and Stream Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw on the notebook pages in #7941f2 (cleared on close); trim the header to status only and the log footer to last id only.

**Architecture:** `DrawLayer` component: a canvas absolutely covering `.nb-paper`, strokes in React-free refs as normalised points, redraw on resize (ResizeObserver when available). `Notebook` owns `strokes` reset via `key` on each open. `StreamLabel` loses the last id; `LiveLog` footer renders `LAST ID`.

**Tech Stack:** React 19, Canvas 2D, Pointer Events, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-22-notebook-drawing-design.md`

## Global Constraints

- Ink colour exactly `#7941f2`. No persistence. No new dependencies.
- jsdom has no canvas context: drawing code must tolerate `getContext` returning null.

## Review Focus

- Pointer leaving the canvas mid-stroke ends the stroke (pointer capture). → Task 2 code.
- Reopen after drawing shows a blank page. → Task 2 test.
- Phone: SCROLL mode leaves page scroll working (canvas `pointer-events: none`). → browser check.
- High-DPI: canvas backing store scaled by `devicePixelRatio` so lines are crisp. → browser check.

---

### Task 1: Stream labels
- Tests: `App.test.tsx`/`LiveLog.test.tsx` — header shows `CONNECTED` and no `LAST ID`; log footer shows `LAST ID 7` and no `CONNECTED`.
- Implement: `StreamLabel` drops `· LAST ID …`; `LiveLog` footer `<span>LAST ID {lastEventId ?? '—'}</span>` + loader.
- Commit `fix(frontend): status in the header, last id in the log`.

### Task 2: Draw layer
- Tests (`Notebook.test.tsx`): canvas `aria-label="Drawing layer"` exists in the open notebook; pointerdown/move/up yields `data-strokes="1"`; `CLEAR` resets to `0`; closing and reopening shows `0`; `PEN`/`SCROLL` toggle button flips `data-mode` on the paper between `scroll` and `pen` (default from `matchMedia('(max-width: 599px)')`: phones `scroll`, else `pen`).
- Implement `DrawLayer({ strokes, onStroke, mode })` or keep state inside `DrawLayer` exposing a `clear` via key change; capture pointer on down; points normalised by the canvas rect; draw with `lineCap/lineJoin: round`, `lineWidth: 3`, `strokeStyle: '#7941f2'`.
- Commit `feat(frontend): draw in the notebook`.
