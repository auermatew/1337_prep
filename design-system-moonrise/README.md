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

It is built in: `frontend/src/moonrise/` holds the look, behind the corner switch (see the frontend README's "Looks" section and [the design](../docs/superpowers/specs/2026-10-23-moonrise-look-switch-design.md)). The app's own logic hooks drive it, so where the reference build's behaviour differs from the app's (validation, cancel, history, paging), the app wins. Moonrise decides how things look and how you interact with them: history popovers, the notebook's cover and Close-only closing, the console screen for transcripts. The stylesheet is generated from `tokens.css` and `components/bundle.css` by `frontend/scripts/scope-moonrise-css.py`.

## Performance notes

- Preload `moon.webp` and `clouds.webp` when the moon look is active.
- Backdrop blur is the heaviest effect. If many timers can run at once, render only the cards on screen or use a lighter blur.
- Each card's countdown redraws an SVG glow every second. Above roughly 20 timers, turn the glow off on cards and keep it on the hero clock.
