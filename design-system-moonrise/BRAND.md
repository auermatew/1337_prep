Moonrise is the look of **1337**, a live timer desk where anyone can start a named timer, and everyone watching sees it count down at the same moment. The page is a black and silver night under hard film grain. The hero holds only two things: the moon rising from the bottom edge, and above it the name `1337` as one huge red word on a seven-segment display. A bank of clouds overlaps the moon and divides the hero from the rest of the page. Below the clouds everything is frosted glass on a hard gradient that runs from the clouds' grey down to black.

Build it calm and cinematic: a film title card, not a dashboard.

## Hard rules

- **No monospace and no serif type.** Use `display` (Archivo at 125% width) and `sans` (Geist). The single exception is the transcript readout (`ms-crt`, `mono` = Space Mono): an Apollo-era console screen for reading the raw transcripts.
- **No all-caps micro labels**, eyebrows or letter-spaced tags. Every label is sentence case: "Seconds", "Time spent", "Last event #59".
- **No badges, pills or chips.** State is a coloured word ("Running", "Finished", "Cancelled").
- **No numbered menus** ("01 Timers"), **no dot pagination**, no decorative dots, square bullets or `[x]` checkboxes.
- **No hard offset shadows, retro window chrome, pinstripes or terminal cursors.**
- **One accent: `signal` red, and it only means live time.** That covers the clock, running countdowns, the live indicator, running glows and notebook ink. Nothing else is red. No purple, no second accent.

## Voice and copy

Plain, short and friendly. The site talks like a person, in the first and second person ("Start one, watch it count down, cancel it if you change your mind.").

- Buttons lead with the verb: "Start timer →", "Cancel", "Show all (24)", "Download ↓".
- The seconds hint has two easter eggs: exactly 1337 reads "= LEET", anything over 24 hours reads "= HELL NAW".
- Don't explain interactions in the UI ("click the cover to open", "Esc closes"). They should be obvious.
- States are one word or a short phrase with an ellipsis while waiting: "Running", "Finishing…", "Reconnecting…".
- Errors say what went wrong and how to fix it, in one line under the thing that failed: "Seconds must be a whole number from 1 to 86400." Never a popup.
- Empty states are short and plain: "Nothing running".
- Keep the author's own voice where it exists. The transcripts note stays lowercase and verbatim.
- No emoji.

## Colour

- Black and silver, never blue. Neutrals run `sky-0` (void black) → `sky-1` → `sky-2` (graphite) → `steel` → `cloud-floor` → `silver`.
- Gradients are hard: few stops, big steps, and they always end in `sky-0`.
  - Hero: a `steel` glow on the moon's horizon falling to black.
  - Below the clouds: `cloud-floor` → `steel` → `sky-2` → `sky-1` → `sky-0`.
  - Footer: `sky-0` → `steel` → `silver` under the wordmark.
- Use flat `sky-0` for the archive.
- Text is `ink` (primary), `ink-2` (labels, nav, metadata) and `ink-3` (ids, placeholders, cancelled). All three hold 4.5:1 from `sky-0` to `sky-2` and on glass. On the grey top of the cloud floor use only `ink` and `ink-2`, and never put text directly on `silver`.
- Red comes in four strengths:
  - `signal` for lit segments and fills
  - `signal-ink` for small red text
  - `signal-haze` only inside glows
  - `signal-ghost` for unlit segments
- Use `moon` for the finished state and the lit part of the moon phase. Use `alert` (amber) only for error text, so red keeps meaning time.
- `cloud` and `cloud-haze` belong to imagery only.

## Type

- **`display`** (Archivo, `font-stretch: 125%`, weight 700–800, tight tracking):
  - `display-l` for big statements below the hero (never in the hero itself)
  - `display-m` for section openers ("Start a timer.", "Archive")
  - `stat` for archive figures
  - `display-xl` for the cropped footer wordmark
  - `display-s` for empty states

  Use it sparingly. One display moment per screen besides the clock.
- **`sans`** (Geist) for everything else:
  - `title` for timer names and panel titles
  - `body-l` for the lead line and input values
  - `body` as the UI default
  - `label` and `label-strong` for metadata and state words

  Numbers always use `font-variant-numeric: tabular-nums` (`.ms-num`) so countdowns and tables don't jitter.
- Both families load from Google Fonts. `components/bundle.css` imports them and sets the 125% width on the display classes.

## The clock

The `SegmentClock` is the brand. In the hero it spells the word `1337` with no colon: it is a name, not a time. Colons appear only in countdowns (`02:41`). Draw it as SVG segments, never in a font:
- Lit segments are `signal` with three stacked drop-shadows in `signal` and `signal-haze`.
- Unlit segments stay visible as `signal-ghost`, like a real LED display.
- Countdown colons blink at 1 Hz.

**Hero clock motion:**
- *Boot:* on first load every digit scrambles through random numbers, then the digits lock into `1337` one after another, left to right (about `dur-boot`).
- *Idle:* the glow breathes slowly, and the display flickers now and then: a segment drops out for a frame, or the whole display dips (`flicker`).
- *Light on the moon:* the moon's red-lit top is the display's light. When the display flickers or dips it darkens with it, and it stays dim during the boot scramble, then fades up once `1337` locks in.
- *Pulse:* it flashes once on every stream event.
- The moon photograph already carries the red rim light the display casts, so the hero needs no reflection.

Timer cards reuse the same clock at 48–56px as their countdown.

## Surfaces

- **Glass** is the surface: `glass` with `blur-glass` backdrop blur, a 1px `line` border, and `radius-m`. Timer cards and the live feed use **liquid glass** (`ms-panel-liquid`): a lighter, brighter refractive sheen (`glass-liquid-hi` → `glass-liquid-lo`) with a `glass-edge` rim highlight.
- Drawers and modals use `glass-strong` and `radius-l`.
- Timer cards never glow red: red stays in the digits. Nothing gets a plain drop shadow.
- `line` is for hairlines only. Any edge that has to be seen (input underlines, glass button borders, table header rule) uses `line-strong`.
- Radii: `radius-s` for controls, `radius-m` for panels, `radius-l` for sheets. `radius-full` is only for the moon and the phase glyph.

## Imagery

- **Moon** (`frontend/public/moonrise/moon.webp`): a greyscale photograph of the moon's upper half on a black sky, with a red rim light along its limb. Use it in `Scene`, at least as wide as the viewport (`max(100%, 135vh)`), with its limb at about 68% of the hero height. It is blended with `lighten` so its black sky disappears into the gradient. Never crop the red rim, never recolour it.
- **Clouds** (`frontend/public/moonrise/clouds.webp`): a transparent layer of cumulus with a dip in the middle. Use it in `CloudFloor`, full width (at least 900px), pulled up to overlap the moon's lower part so the moon sits in the dip. Always show it in greyscale.
- **Stars:** sparse, two sizes, spread evenly across the whole width of the sky, drawn by `Scene`.
- **Grain:** hard, high-contrast monochrome noise in the backgrounds only (sky, cloud floor, page ground, footer), never over images, panels or text (`ms-noise`, `grain-opacity`).
- Pictures carry no text and no people.

## Progress and state

- **Progress** is a `MoonPhase`, waxing from new moon at start to full moon at the end. There are no progress bars.
- **Live connection** is one glowing clock segment (`LiveIndicator`), never a dot: "Live", "Connecting…", "Reconnecting…".
- **Timer states:**
  - *Running:* `signal-ink`.
  - *Finishing…:* the countdown sits at 00:00 and pulses until the server confirms.
  - *Finished:* `moon`. The card brightens, then sinks and fades, like a moon setting.
  - *Cancelled:* `ink-3`. The duration is struck through in the archive.

## Layout

- Content max width 1280px on a 12-column grid with `space-6` gutters. The phone gutter is `space-4`.
- Section padding is `space-30` on desktop and `space-18` on phones.
- **Page order:**
  1. Hero, full viewport: only the `1337` display, centred, and the moon low on the horizon (`Scene`, limb at 68% of the height). No headline, form, nav or buttons.
  2. `CloudFloor`: the clouds overlap the moon, then the hard gradient. As the hero scrolls away, the word `TIMER` (`Scene`'s `word`) rises between the moon and the clouds, with a silver-to-transparent gradient. The moon lags behind the scroll and the clouds lead it (parallax).
  3. Timers on that gradient: the `StartForm`, the running `TimerCard`s and the `LiveFeed` in a 320–360px right column. No section heading: `TIMER` above names it.
  4. Archive (Stats, then ArchiveTable) on `sky-0`
  5. `Footer`: GitHub ↗, Transcripts and Notebook as a belt of white rules sitting on the cropped wordmark. No logo, no tagline.
- There is no nav bar. GitHub, Transcripts and Notebook live in the footer belt. The live indicator sits under the `LiveFeed` (it is the page's connection, not the feed's). `Nav` stays in the system for other pages.
- Lists that grow never push the page: the timer cards and the live feed scroll inside fixed-height areas (`ms-scroll`), and history opens as a popover over the card or row, never pushing it.
- The page root carries `ms-noise`, so the grain sits in every background but never over content.
- Transcripts and Notebook open as `Sheet`s from the nav.
- On phones:
  - The clock spans the width.
  - The form stacks.
  - Cards and feed go to one column.
  - The archive rows stack.
  - The nav folds into "Menu".

## Motion

- Ease every transform and fade with `ease-drift`, using `dur-fast` for hover, `dur-base` for expanding and sliding, and `dur-slow` for cards entering and leaving. Stepped timing is only for segment blinks.
- Cards enter by rising 24px and fading in.
- Scroll-driven, with CSS view timelines: the moon lags the scroll, the clouds lead it, and `TIMER` fades and rises from behind the clouds. Where view timelines are not supported, everything sits still and the word is hidden.
- No hover glitch effects. The only scramble is the display's boot.
- With `prefers-reduced-motion`: no parallax, boot, flicker or breathing; `TIMER` is simply shown. The glow stays and exits become plain fades.

## Focus and accessibility

- Keyboard focus is a solid 2px `ink` outline with a 3px offset. Focused inputs thicken their underline to 2px `ink`.
- The clock and moon phase carry text labels ("02:41 left", "40% elapsed").
- The live feed is a polite live region. Errors use `role="alert"`.

## Components

Components live in `components/bundle.js` as `window.Moonrise` and expect React 18 on the page:

- **Time:** `SegmentClock`, `MoonPhase`, `LiveIndicator`
- **Actions and forms:** `Button`, `Field`, `StartForm`
- **Surfaces:** `Panel`, `Sheet`, `Scene`, `CloudFloor`, `Grain`, `Notebook`
- **Timers:** `TimerCard`, `HistoryTimeline`, `LiveFeed`
- **Archive:** `Stats`, `ArchiveTable`
- **Navigation:** `Nav`, `Logo`, `Wordmark`

`Moonrise.util.countdown(ms)` formats `mm:ss` (or `h:mm:ss` from one hour), and `Moonrise.util.humanize(seconds)` gives "3m" or "1h 2m 5s".

The `Hero` card shows the first screen and the cloud transition into the timers section.

## Loading it

- Load, in this order: `tokens.css` (every token as a CSS variable, plus a class per text style such as `.display-m`), then `components/bundle.css` (component styles; it imports Archivo, Geist and Space Mono from Google Fonts), then `components/bundle.js` (sets `window.Moonrise`; React 18 must already be on the page).
- `components/bundle.js` is a reference build that reads React from a global. In the frontend, port the components to TypeScript modules instead of shipping it (see `README.md`).
- The photographs live in `frontend/public/moonrise/`; pass their urls as `moonSrc`, `cloudSrc`, `coverSrc` and `paperSrc`.
