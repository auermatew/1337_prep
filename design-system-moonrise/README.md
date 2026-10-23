# Moonrise

A second look for the timer desk: a black and silver night with a red seven-segment `1337` above a rising moon, liquid-glass timer cards and hard film grain. It sits next to the existing 1337 design. The plan is for a moon button to switch the frontend between the two; nothing in `frontend/src` uses it yet.

Design system on claude.ai: https://claude.ai/artifact/7W45cEFk9vzQxXRiRdvgAF. The canvas with every screen (desktop, mobile, transcripts, notebook, timer states): https://claude.ai/artifact/YDYvryWWvjVKTK8jzaMunG.

## What is here

| Path | What |
|---|---|
| `BRAND.md` | The rules: voice, colour, type, the clock, surfaces, imagery, layout, motion. Read it before building anything. |
| `tokens.json`, `tokens.css` | Every token (colours, type styles, spacing, radii, shadows, motion) as data and as CSS variables. |
| `components/bundle.css` | All component styles, keyed to the tokens. |
| `components/bundle.js` | A working reference build of every component (`window.Moonrise`, plain JS, React from a global). |
| `components/index.d.ts` | Props of every component, as documentation. |
| `components/<Name>/README.md` | Guidelines per component: what to pass, states, do and don't. |
| `preview/index.html` | The full page running on sample data: real scroll, the TIMER rise, parallax, the notebook and the transcript preview. |
| `../frontend/public/moonrise/` | The photographs: `moon.webp`, `clouds.webp`, `cover.webp` (notebook cover), `paper.webp` (notebook pages). The handwriting scans are the existing `notes-1.webp` and `notes-2.png`. |

## Preview

Open `preview/index.html` in a browser (double-click is enough). It loads React and the fonts from CDNs, so it needs a network connection. Animations follow the system's reduced-motion setting.

## Building it into the frontend

The reference build is for previews and design tools. In the app, port it to TypeScript and keep the data layer you already have.

1. **Styles.** Turn `tokens.css` and `components/bundle.css` into one stylesheet under `frontend/src/themes/moonrise/`, scoped to a `.moonrise` root element so it cannot clash with the current design's tokens or the global `body` background. Load the fonts from that stylesheet only.
2. **Components.** Port each component from `components/bundle.js` to a `.tsx` file in the same folder, using `index.d.ts` for the props and the per-component READMEs for behaviour. Keep the class names so `bundle.css` works unchanged.
3. **Shell.** Add `MoonriseApp.tsx`: `Scene` (with the `1337` `SegmentClock`), `CloudFloor` holding the `StartForm`, the scrolling card list and the `LiveFeed` with the large `LiveIndicator` under it, then the archive (`Stats`, `ArchiveTable`) and the `Footer`.
4. **Data.** Both looks use the same hooks and API:
   - `useTaskStream()` gives tasks, log, status and `upsert`. Running tasks go to `TimerCard`, `log` goes to `LiveFeed`, `status` goes to `LiveIndicator`, ended tasks go to `ArchiveTable`.
   - `useNow()` and `endsAt` give each card's `remainingMs`. `archiveStats()` gives the `Stats` figures.
   - `StartForm` `onStart` calls `createTask`. `TimerCard` `onCancel` calls `cancelTask`, and a 409 becomes the card's `error`. History opens with `taskEvents`.
   - Change the hero clock's `pulseKey` on every new stream event so it flashes.
   - Transcripts reuse the existing files in `public/transcripts/`; the preview shows them in the `ms-crt` console readout.
   - The notebook uses the `Notebook` component with the existing `DrawLayer` as its child, so drawing keeps working.
5. **Switch.** `App.tsx` picks the look from a theme value (`classic` or `moon`), remembered in `localStorage` and overridable with `?theme=moon`. Load `MoonriseApp` with `React.lazy` so its code, fonts and images only download when someone picks it. A small fixed moon button, in a corner of both looks, flips the value.
6. **Behaviour to keep.**
   - Lock page scroll while the transcripts or the notebook are open (`useScrollLock`).
   - The notebook closes only from its Close button.
   - History opens as a popover, never pushing cards or rows.
   - The card list and the feed scroll inside fixed heights.
   - Scroll effects (TIMER rise, moon and cloud parallax) use CSS scroll-driven animations. Browsers without them show a still page.
7. **Tests.** Keep the existing tests passing (they cover the classic look). Add tests for the switch and its persistence, and for the Moonrise shell rendering on a mocked stream.

## Performance notes

- Preload `moon.webp` and `clouds.webp` when the moon look is active.
- Backdrop blur is the heaviest effect. If many timers can run at once, render only the cards on screen or use a lighter blur.
- Each card's countdown redraws an SVG glow every second. Above roughly 20 timers, turn the glow off on cards and keep it on the hero clock.
