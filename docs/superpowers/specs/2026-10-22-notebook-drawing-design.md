# Notebook drawing and stream labels — design

Small change on `feature/frontend`.

## Decided (with the user)

- **Draw in the notebook** with mouse, finger or pen, colour `#7941f2`.
  Drawings **disappear** when the notebook closes (scratch pad, no storage).
- **Header** shows only the connection status (`● CONNECTED`,
  `CONNECTING…`, `RECONNECTING…`), no `LAST ID`.
- **live.log footer** shows only `LAST ID <n>` (plus the existing loader
  while not connected), no `CONNECTED`.

## Approaches

- **Canvas overlay (chosen):** one `<canvas>` over `.nb-paper`, Pointer
  Events for mouse/touch/pen, strokes kept in memory as points normalised to
  the paper box and redrawn on resize. Cheap at any stroke count.
- SVG paths: easy to inspect, but one DOM node per stroke and the same
  pointer handling; no advantage here.
- Shared/persisted drawings: rejected by the user.

## My calls

- Round strokes, 3px, `#7941f2`; a `CLEAR` button in the notebook footer.
- On phones (≤599px) a `PEN` / `SCROLL` toggle in the footer, defaulting to
  `SCROLL` so the stacked pages stay scrollable; in pen mode the canvas sets
  `touch-action: none`. Desktop is always pen (toggle hidden).
