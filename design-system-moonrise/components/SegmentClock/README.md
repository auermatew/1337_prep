# SegmentClock

The 1337 display: a seven-segment readout drawn in SVG, lit segments in `signal` with a layered bloom (`signal-haze`), unlit segments kept as `signal-ghost` ghosts.

- **Hero:** `value="1337"`: the name as one word, never a time, so no colon. Use `fluid` inside a box 60–70vw wide (90vw on phones), with `boot` (every digit scrambles through random numbers, then locks into place left to right), `flicker` (a segment drops out now and then, or the display dips) and a `pulseKey` that changes on every stream event. It is the only thing on the page this loud.
- **Timer cards:** the countdown, which does use a colon (`02:41`), `height` 48–56, `blinkColon={false}`. Pass `urgent` for the last 10 seconds and for "Finishing…". Pass `dim` once a timer has ended.
- Provide: `value` as text (`mm:ss`, or `h:mm:ss` from one hour); use `Moonrise.util.countdown(ms)`.
- Do not set the clock in a font, recolour it, or put other text on top of it. Red always means live time.
- No hover glitch: the only scramble is the boot.
- Reduced motion: no boot, breathing or blink; the glow stays.
