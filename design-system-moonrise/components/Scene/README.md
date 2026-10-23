# Scene

The hero: a black sky with a hard steel glow on the horizon (`steel` → `sky-2` → `sky-0`), sparse stars, and the moon photograph rising from the bottom edge. Its only child is the 1337 display, centred in the hero.

- Provide `moonSrc` = the `moon.webp` asset (`/_blob/45d76dfa6459fdaa522050444854b6fa`). The photo has its own black sky and red rim light, and it is blended with `lighten`, so its black drops into the gradient. Without `moonSrc` a placeholder moon is drawn from the tokens.
- Size: `height` (default 100vh; give a px height when the page is not the viewport, e.g. 900 on a design canvas). Everything inside is sized from the Scene's own box (container units): the photo is `max(100cqw, 135cqh)` wide with its limb at the `horizon` value (default 68% of the height).
- Children: the `SegmentClock` with `value="1337"` and `fluid`. Nothing else.
- `horizon` (default 68): where the moon's limb lands, in % of the hero height.
- `word`: a giant word ("TIMER") between the moon and the clouds, silver fading to transparent, that rises into view as the hero scrolls away. `wordStatic` shows it risen, without the animation, for static comps.
- Parallax comes free with it: the moon layer lags the scroll (CSS view timeline on the Scene), and `CloudFloor`'s clouds lead it.
- The moon's red-lit top is lit by the display: when the `SegmentClock` inside flickers, dips or scrambles on boot, a shade over the moon's top darkens with it (`data-clock-light` on the Scene, set by the clock), then fades back.
