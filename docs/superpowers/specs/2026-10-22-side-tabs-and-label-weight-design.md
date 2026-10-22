# Side tabs, two-page notebook, heavier labels — design

Follow-up to `2026-10-22-transcripts-notebook-stats-design.md`, on `feature/frontend`.

## Intent

Make the page read cleaner and the extras feel like things tucked on the side
of the desk: transcripts and notes both live in tabs on the right edge.

## Changes (as asked)

1. **No section numbers.** Tags read `TIMERS` and `ARCHIVE` (no `01 ·` / `02 ·`).
2. **Heavier small labels.** Mono labels go from weight 500 to 600–700 and
   muted ones darken a step: section tags, header line, table/stat headers,
   window title and footer, link buttons, buttons. Serif headlines and sans
   body text stay as they are.
3. **Transcripts move to a side tab.** The `TRANSCRIPTS` section leaves the
   page. A second tab, `TRANSCRIPTS`, sits above `NOTES` on the right edge.
4. **Disclaimer note** at the top of the transcripts drawer, casual, in mono:
   > heads up: these aren't all my sessions, and not every prompt I sent is
   > in here either. exporting everything got a bit much lol. happy to show
   > you the rest in person though :)
5. **Notebook pictures replaced.** The old `notebook.webp` is removed; the two
   new pages (transparent background) show on a warm paper background.

## Approaches (transcripts tab)

- A. Reuse the centred dialog with a list → preview view swap. Consistent
  with NOTES, smallest change.
- **B. Drawer sliding in from the right (chosen).** Feels physically "from
  the side". Previews open in the centred dialog on top of the drawer.

## Decided

- The drawer is a native modal `<dialog>` pinned to the right edge, full
  height, width `min(440px, 100vw)`, sliding in from the right (no slide with
  reduced motion). Esc / `CLOSE` close it; with a preview open on top, Esc
  closes the preview first. Its rows keep the current layout: title, size,
  `PREVIEW`, `DOWNLOAD ↓`.
- The two tabs stack vertically, centred on the right edge, same style.

## My calls (check these)

- The notebook opens as a two-page spread (pages side by side) on desktop,
  stacked and scrollable on phones. Paper is a fixed warm off-white with a
  faint dot grid and a thin centre fold line, the same in light and dark mode,
  like a real notebook.
- The disclaimer sits in a dashed purple outline box (the design system's
  "open slot" motif), so it reads as an aside.
- New files: `public/notes-1.webp`, `public/notes-2.png`.
