# Short Task Id and Left Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a copyable short task id in archive rows and timer windows; move the side tabs and drawer to the left.

**Spec:** `docs/superpowers/specs/2026-10-22-task-id-and-left-tabs-design.md`

### Task 1: TaskId
- Tests (`TaskId.test.tsx`): renders `3f2a1b9c` for a full UUID with `title` = full id; click calls `navigator.clipboard.writeText(fullId)` and shows `COPIED`, back to the id after 1.2 s (fake timers). App: archive row and timer window contain the short id.
- Implement `TaskId({ id }: { id: string })` as `<button type="button" className="task-id">`, `aria-label="Copy task id <full>"`.
- Commit `feat(frontend): short copyable task id in archive and timer windows`.

### Task 2: Left tabs
- CSS only (jsdom has no layout): `.side-tabs` `left: 0`, hover `translate(2px, -2px)`; `.dlg-drawer` `margin: 0 auto 0 0`, slide keyframes from/to `translateX(-100%)`, `.win` border on the left removed instead of the right. Browser check: tab inside the left gutter, drawer slides in and out from the left, Esc still animates.
- Commit `style(frontend): side tabs and drawer on the left`.
