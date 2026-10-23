# Hero

A composition, not a component: the first screen and the transition out of it.

- **The hero holds only the word `1337` on the red seven-segment display and the moon.** No headline, form, nav, buttons or scroll hint.
- `Scene` with the moon photograph (`frontend/public/moonrise/moon.webp`) fills the viewport, the moon's limb at 68% of the height. The display sits a little above the middle, optically centred (`opticalCenter`), `fluid` in a box up to 760px wide (90vw on phones), with `boot` (digits scramble, then lock into 1337), `flicker`, and a `pulseKey` that changes on every stream event.
- `Scene`'s `word="TIMER"` sits between the moon and the clouds and rises into view as you scroll, with a silver-to-transparent gradient. The moon lags the scroll and the clouds lead it.
- `CloudFloor` follows: its cloud layer (`frontend/public/moonrise/clouds.webp`) overlaps the moon, and below it the ground runs as a hard gradient from `cloud-floor` to `sky-0`. The start form, the cards and the live feed begin there, with no heading.
- The grain lives in the backgrounds only (the Scene, the cloud floor and the page root with `ms-noise`).
