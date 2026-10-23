# Sheet

The body of a drawer or modal on `glass-strong` with `radius-l`: a title, Close, content and an optional footer. The app owns the native `<dialog>` (focus stays inside) and where it sits.

- **Transcripts:** a drawer from the right, 440px wide (full width on phones). A `ms-note` box with the author's note, then a `ms-files` list: title, size, Preview, Download ↓. Footer "3 files".
- **Transcript preview:** a centred modal up to 880px. The text sits in an `ms-crt` readout: an Apollo-era console screen (Space Mono phosphor text with a soft glow, scanlines, a curved-glass vignette, a status strip with the file name, size and line count and a blinking block cursor at the end). Plain text, shown as it is; scrolls inside the screen. Download ↓ and Close.
- **Notebook:** a centred modal with the two handwritten pages side by side (one with swipe on phones), a drawing layer in `signal` ink, footer "Handwritten · 22 Oct 2026" with Clear and Close. The notebook dialog closes only from Close (no backdrop click).
- Backdrop: `sky-0` at 70% with the page's blur.
- While any drawer or modal is open, the page behind must not scroll: call `Moonrise.util.useScrollLock(open)` in the component that owns the dialog (or `Moonrise.util.lockScroll(true/false)`). It locks `html`/`body`, pads for the scrollbar so nothing shifts, and handles nested dialogs. Give the backdrop `overscroll-behavior: contain`.
