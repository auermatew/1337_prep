# Transcripts, notebook and archive stats — design

Small change to the frontend on `feature/frontend`.

## Intent

Make the site show how it was built: the chat transcripts behind it and the
handwritten planning notes, plus a quick read of how the timers actually got
used. Minimal, inside the 1337 design system.

## Goals

- **Transcripts.** A section listing the three transcripts (design system,
  backend planning, backend build session). Each can be previewed on the page
  as plain monospace text and downloaded as the original `.md`.
- **Notebook.** A small notebook tab on the side of the page; clicking it
  opens the handwritten notes picture.
- **Archive stats.** Above the archive table: finished count, cancelled count,
  and total actual time, counted over every ended task (not just the 20 shown).
- **GitHub link.** A link to https://github.com/auermatew/1337_prep that
  opens in a new tab (added after approval).

## Non-goals

- No markdown rendering; plain text only.
- No uploads, no adding transcripts from the UI. The list is fixed at three.
- No backend changes.

## Approaches

- **A. Static files in `frontend/public/` (chosen).** Files served as-is, a
  small hard-coded list in code, preview fetched on open, download via
  `<a download>`. Keeps the bundle small and the download byte-identical.
- B. Import the text into the JS bundle with `?raw`. Instant preview, but
  ~115 KB shipped to everyone up front.
- C. Serve from the backend. Adds endpoint, tests and deploy surface for
  static content. Rejected.

## Decided

- Actual time per task = `updatedAt − startedAt` (`updatedAt` is stamped at
  the finish/cancel transition). Total = sum over finished + cancelled tasks.
  Stats update live because the archive is fed by the stream.
- Preview and notebook use the native `<dialog>` (Esc closes, focus stays
  inside, backdrop), framed with the existing `Window` component.
- Files: `public/transcripts/*.md` copied from the repo and Downloads;
  `public/notebook.webp` from the provided picture.

## My calls (check these)

- Transcripts become section **03 · TRANSCRIPTS** below the archive: one row
  per transcript with title, size, `PREVIEW` and `DOWNLOAD ↓` link buttons.
- Stats sit between the archive tag and its table as three mono-labelled
  figures: `FINISHED`, `CANCELLED`, `TIME SPENT` (e.g. `1H 04M 12S`). Shown
  only when the archive is shown (at least one ended task).
- The notebook tab is fixed to the right edge, vertically centred: a narrow
  ink tab reading `NOTES` rotated, purple square marker. Opens the picture in
  a dialog, scaled to fit the viewport; on phones it fills the screen width.
- Preview dialog: wide `Window` titled with the filename, body scrolls,
  footer has `DOWNLOAD ↓` and `CLOSE`. Loading and error lines use the
  existing machine voice (`LOADING…`, `COULD NOT LOAD TRANSCRIPT`).

- GitHub link sits in the header between the wordmark and the stream label
  as a mono `GITHUB ↗` link with the purple underline grow,
  `target="_blank" rel="noopener noreferrer"`.

## Left to the builder

Exact spacing, the duration format helper, test layout.
