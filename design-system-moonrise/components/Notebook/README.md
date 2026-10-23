# Notebook

The handwritten notebook: it appears closed on its cover, then the cover swings open on the spine (a 3D page turn, 1.1 s, `ease-drift` for the slide) into a two-page spread.

- Provide `coverSrc` (`frontend/public/moonrise/cover.webp`, burgundy, embossed "Mate Auer / trial day"), `paperSrc` (`frontend/public/moonrise/paper.webp`) and the handwriting scans as `leftSrc` / `rightSrc`.
- Show it with `autoOpen`: the opening scene is the closed cover, held for 1.8 s so the cover text can be read (`autoOpenDelay`), then it opens by itself. Clicking the cover opens it. Once open it stays open: only the dialog's Close button closes it (pass `open={false}` to swing the cover shut first, let it rest closed for about a second, and remove the dialog ~2.3 s after Close).
- The left page is the paper mirrored, so both sets of tabs face outward and the straight edges meet at the spine, with a soft fold shadow on each side.
- Handwriting is ink on white: it is multiplied onto the paper and hue-shifted to red (the only ink colour the system allows).
- Put the drawing layer (an `<svg>` or canvas) as children: it lands on the right page.
- Inside a `Sheet` (glass-strong modal) with the footer "Handwritten · 22 Oct 2026", Clear and Close. On phones use `pageWidth` around 160 so the spread fits, or show one page at a time.
- Reduced motion: it opens instantly.
- Its images can't be dragged or selected; clicks go to the cover/page.
