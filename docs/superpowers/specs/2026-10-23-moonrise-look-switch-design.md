# Moonrise look and the moon switch — design

Project on `dev`. Nothing goes to `main`.

## Intent

The frontend gets a second look, Moonrise (`design-system-moonrise/`), behind
a moon button. Clicking the moon turns the whole page into the Moonrise night;
clicking again brings the classic 1337 desk back. The switch should feel like
part of the design: smooth, with a loading moment in the Moonrise style when
its code, fonts and photos are still downloading.

**The rule (decided with the user):** our app owns the data and the rules;
Moonrise owns how things look and how you interact with them. The backend and
everything we do with it (stream, API calls, validation, cancel and its 409,
history refresh, departing delay, archive stats and paging) stays exactly as
it is today and is shared by both looks. `design-system-moonrise/README.md`'s
build plan is a reference, not the plan; `components/bundle.js` is a visual
reference, not code to port verbatim.

## Goals

- A moon button on the classic look switches to Moonrise; a button in the
  same spot on Moonrise switches back.
- One stream connection for the page's lifetime: switching never reconnects,
  never empties the live feed, never loses tasks.
- Moonrise code, styles, fonts and photos download only when someone picks it.
- The choice is remembered across visits and can be forced with a URL param.
- The classic look is visually and behaviourally unchanged apart from the
  moon button.
- Existing tests keep passing untouched; new tests cover the switch, the
  shared logic hooks and the Moonrise look on a mocked stream.

## Non-goals

- No backend change.
- No new features in either look (no sorting, filters, settings…).
- No light/dark change to the classic look (it keeps following
  `prefers-color-scheme`).
- Moonrise's `Nav`, `Logo`, `Panel`, `Grain` (legacy overlay) and the hero
  reflection are not needed on this page.

## Anti-goals

- Moonrise styles leaking into the classic look (or the reverse) after a
  switch. Both stylesheets stay loaded once Moonrise has been opened, so every
  Moonrise rule must be scoped.
- A flash of the wrong look on load (paper flashing before the night).
- Business logic copied into the Moonrise views: if a rule exists twice, the
  two looks will drift.
- A switch that feels like a page reload: white flash, scroll jump mid-fade,
  stream reconnecting.

## Approaches

1. **Shared logic hooks, two looks (chosen by the user).** The logic inside
   each classic component moves into a hook; the classic component becomes a
   view on it with identical DOM; Moonrise views use the same hooks. The
   stream stays in `App`, above both looks.
2. One set of components rendering both markups. Fewer files, but every
   component mixes two designs and both stylesheets always load, so no lazy
   loading.
3. Moonrise views with their own copy of the logic. Fastest, but duplicates
   the rules, which is what the user ruled out.
4. CSS-only reskin: rejected, the Moonrise clock, scene and clouds need
   different markup.

## Architecture

### App stays the root

`App.tsx` keeps calling `useTaskStream()`, `useNow()` and `useDeparting()` and
keeps deriving `newestEventIds`, `onDesk` and `ended`. It reads the look from
`useLook()` and renders either:

- `ClassicLook` (today's `App` JSX moved into its own file, unchanged), or
- `MoonriseLook` via `React.lazy(() => import('./moonrise/MoonriseLook'))`,

both receiving the same derived data as props (`tasks`, `onDesk`, `ended`,
`departing`, `log`, `status`, `lastEventId`, `error`, `upsert`,
`newestEventIds`, `now`). Plus, always: the `LookSwitch` button and the
`LookTransition` overlay.

Because `App` still owns the stream and still renders the classic look by
default, `App.test.tsx` (which mocks `useTaskStream` and renders `<App />`)
keeps passing without edits.

### Shared logic hooks (`src/logic/`)

Each hook holds what the classic component does today; the classic component
keeps its exact markup, copy and classes on top of it. Hooks return
look-neutral values (kinds, not strings), so each look writes its own copy.

| Hook | From | Returns |
|---|---|---|
| `useStartTask(onCreated)` | `StartForm` | `name`, `setName`, `seconds`, `setSeconds`, `submitting`, `problems`, `submit`, `secondsValue` (parsed int or null) |
| `useCancelTask(task, onChanged)` | `TimerWindow` | `cancel`, `cancelling`, `locked`, `problem` |
| `useTaskHistory(taskId, refreshKey, enabled)` | `History` | `{ status: 'loading' } \| { status: 'failed' } \| { status: 'ready', events }` |
| `useArchive(ended)` | `Archive` | `sorted`, `rows` (20 or all), `total`, `showAll`, `toggleShowAll`, `stats` |
| `useTranscript(selected)` | `Transcripts` | same loading / failed / text union; the `TRANSCRIPTS` list moves to `src/logic/transcripts.ts` |

Problem kinds: `name-required`, `name-too-long`, `seconds-invalid`,
`server` (with the server's messages), `unreachable`, `not-running` (409).
The seconds easter eggs live in one helper, `secondsEgg(n)` →
`'leet' | 'hell-naw' | null` (1337 → leet, above 86400 → hell-naw); each look
formats the rest of its hint itself.

`DrawLayer` gets an `ink` prop (default today's `#7941f2`), nothing else.

### The look value (`src/look/useLook.ts`)

- Values: `classic` | `moon`. Called "look", not "theme", because
  `data-theme` already means light/dark in the classic tokens.
- Initial value: `?look=moon` or `?look=classic` in the URL wins, then
  `localStorage['1337.look']`, then `classic`. Storage reads and writes are
  wrapped in try/catch (private mode, blocked storage).
- Only an actual switch writes storage. A `?look=` param counts for that
  visit and is not stored on its own. Switching also replaces the `look`
  param if the URL has one (`history.replaceState`), so a reload shows what
  you picked. Pressing Back after a failed Moonrise load counts as a switch
  to classic and stores `classic`, so a returning visitor isn't sent into
  the failing night again.
- Sets `document.documentElement.dataset.look` so page-level CSS (body
  background, classic body grain) can follow.
- `index.html` gets a tiny inline script that sets `data-look` from the URL or
  storage before the bundle runs, plus one inline rule
  `html[data-look='moon'] { background: #050505 }`, so a returning Moonrise
  visitor never sees paper flash.

### The switch and the transition (`src/look/`)

**LookSwitch.** A fixed 44×44 button in the bottom-right corner (24px from
the edges, 16px on phones), above page content, below dialogs (dialogs are in
the top layer anyway).

- Classic: ink square, paper crescent moon icon, the classic hard offset
  shadow and the same hover lift as the side tabs. `aria-label="Switch to
  Moonrise"`.
- Moonrise: glass button (`ms-btn-glass` look, `radius-s`), a silver sun
  outline icon. `aria-label="Switch to classic"`.
- Hovering or focusing it on the classic look starts the Moonrise chunk import
  early, so the switch is often instant.

**To Moonrise (the moonrise):**

1. Click. An overlay in `sky-0` black grows as a circle from the button's
   centre to cover the screen (`clip-path: circle()`, `dur-slow` 800ms,
   `ease-drift`). Stars from the Moonrise scene fade in on it.
2. As soon as it covers the screen, the red seven-segment `1337` appears,
   centred where the hero clock will sit, and runs its boot scramble (digits
   scramble, then lock in left to right). In parallel the app loads: the
   Moonrise chunk (JS + CSS), the fonts (`document.fonts.load` for Archivo and
   Geist, skipped where `document.fonts` is missing), and `moon.webp` and
   `clouds.webp` (`img.decode()`).
3. The scramble keeps running until everything is ready; it locks into `1337`
   once loading is done and at least `dur-boot` (1200ms) has passed. A hard
   cap of 8s proceeds anyway (photos may still pop in).
   **Fast path:** when the chunk, fonts and both photos are already loaded
   (a later switch, or the hover preload finished), the minimum hold drops to
   about 500ms: a short scramble that locks in, so the moment still plays but
   the whole switch stays near 2s instead of ~2.8s.
4. Under the overlay, the Moonrise look renders and the page scrolls to the
   top. The overlay fades out (`dur-slow`), and the moon rises the last part
   into place behind it (a one-off `translate` on the moon layer, so it does
   not fight the scroll-driven `transform` parallax). The overlay clock and the
   hero clock line up, so the hand-off is seamless; the hero clock itself
   never boots (the overlay did that), it only flickers and pulses.
5. If the chunk fails to load, the clock stops, one line under it says
   "Couldn't load the night. Try again." with a Try again button and a Back
   button; Back rolls the overlay back down into the moon button and stays
   classic.

**Back to classic:** a paper-coloured (`--paper`) circle grows from the
button over the night (600ms), the classic look renders under it and the page
scrolls to the top, then the overlay fades (300ms). No loading: classic is in
the main bundle.

**Direct load in Moonrise** (stored choice or `?look=moon`): the page starts
at step 2 (black overlay already covering, scramble running) and continues
from there.

**Reduced motion:** no circle growth, no scramble, no moon rise. A plain
black (or paper) overlay fades in (150ms), waits for loading, swaps, fades
out. The overlay shows "Loading…" in `ink-2` if loading takes over 400ms.

**Watch out:** classic `base.css` has a global reduced-motion rule
(`*, *::before, *::after { animation: none !important; transition: none
!important }`) that stays loaded alongside Moonrise. The overlay's and
Moonrise's own reduced-motion fades need `!important` overrides scoped to
them, and the transition code drives its steps with timers, never by waiting
for `transitionend` / `animationend` (which may never fire).

**What survives a switch:** tasks, the log, the connection and the look's
shared data (all in `App`). Everything local to a look resets: a typed but
unsent form, an open history popover, Show all, a 409 lock on a card, scroll
inside the card area. Requests in flight still land through the stream.

The overlay is `aria-hidden`; while it is up, a polite live region says
"Switching to Moonrise…" / "Switching to classic…" and the button is
disabled. Clicks during a transition are ignored.

**Shared piece:** `SegmentClock` (SVG, small) and its CSS live in the main
bundle under `src/moonrise/clock/`, because the overlay needs it before the
Moonrise chunk arrives. The Moonrise look imports the same module.

## The Moonrise look (`src/moonrise/`)

Moonrise components as TypeScript views, keeping the `ms-*` class names from
`bundle.css`. Props are shaped around our data (`TaskDto`, `LogLine`, the
logic hooks), not the reference build's sample-data props.

### Styles

- One stylesheet, `moonrise.css`, built from `tokens.css` and
  `components/bundle.css`, imported by `MoonriseLook` (so it lands in the lazy
  chunk). The Google Fonts `@import` (Archivo, Geist, Space Mono) moves with
  it, so fonts load only for Moonrise.
- Every token and rule is scoped under `.moonrise` (the look's root element,
  which also carries `ms-noise`). That includes the `:root` token blocks, the
  `--ms-noise` image, the text-style classes (`.display-m`…) and the
  `html, body` ground rules.
- Page-level rules key off `html[data-look='moon']`: body background
  `sky-0`, the classic `body::before` / `body::after` glow and grain hidden.
  Classic rules stay untouched; nothing in classic CSS needs to know about
  Moonrise.
- The shared clock CSS uses the same scoping, with the few tokens it needs
  defined on its own root class so it also works on the overlay.

### Page

Following `BRAND.md`'s page order:

1. **Hero** (`Scene`, full viewport): stars, the moon photo with its limb at
   68%, the `1337` clock (`fluid`, `opticalCenter`, `flicker`,
   `pulseKey={lastEventId}`), and the word `TIMER` rising between moon and
   clouds on scroll. Nothing else.
2. **Cloud floor** (`CloudFloor`): the clouds overlap the moon, then the hard
   gradient. On it: the stream error line (if any, `alert`, `role="alert"`),
   the start form, then the desk: timer cards (2 columns, fixed-height
   `ms-scroll ms-scroll-fade` area, about 724px, 584px on phones) beside a
   340px column with the `LiveFeed` and the large `LiveIndicator` under it.
   Empty desk: "Nothing running" (`display-s`).
3. **Archive** on `sky-0`, only when something has ended (our rule):
   "Archive" (`display-m`), `Stats` (Finished, Cancelled, Time spent as
   "1h 4m 5s"), the table with 20 rows, then "Show all (n)" / "Show less".
4. **Footer**: the belt with GitHub ↗ (new tab), Transcripts, Notebook, over
   the cropped `1337` wordmark.

No header, no side tabs. On phones: clock spans the width, form stacks, one
column of cards then the feed, archive rows stack (all from `bundle.css`).

### Pieces, and where Moonrise's own behaviour applies

- **Start form:** one glass bar (Name, Seconds, "Start timer →", "Starting…"
  while submitting), on `useStartTask`. Problems as one sentence-case line
  under the bar (the first problem): "Give the timer a name of 1 to 100
  characters.", "Seconds must be a whole number from 1 to 86400.", server
  messages with the first letter capitalised, "Couldn't reach the server.
  Check your connection and try again." The seconds hint is always shown:
  "= 3m", "= 1h 2m 5s", "= LEET", "= HELL NAW".
- **Timer card:** name, short id (full id on hover), `MoonPhase` for progress
  (replaces the progress bar), the countdown on the segment clock (48–56px,
  urgent pulse in the last 10s), state word, "Ends 13:39:12", History and
  Cancel. On `useCancelTask`. State: Running; Finishing… at 00:00 until the
  server confirms; Cancelling… while in flight; a 409 shows "This timer
  already ended." under the card and disables Cancel. Departing tasks play
  the Moonrise exit (finished: brighten, sink and fade; cancelled: fade),
  timed inside our `DEPART_MS`. Cards enter by rising 24px and fading in. No
  1337 rainbow. Above 20 running timers the card clocks drop their SVG glow
  (the hero keeps it).
- **History:** a popover over the lower part of the card, or under the
  archive row, never pushing anything. One open at a time in the archive
  (Moonrise), its events from `useTaskHistory` refreshed on new events (ours).
  "Loading…", "Couldn't load the history."
- **Live feed:** liquid glass panel, the last 50 log lines oldest first,
  auto-scrolled to the newest (ours), the newest line flashing once, "Last
  event #n" / "No events yet", "Waiting for the first event." when empty.
  Polite live region.
- **Live indicator:** one glowing segment with "Live" (our `open`),
  "Connecting…", "Reconnecting…".
- **Transcripts:** our two-step flow (list, then preview) in Moonrise sheets
  (native `<dialog>`, `glass-strong`, `radius-l`, Esc closes). The list
  sheet keeps the lowercase note verbatim and each row's title, size,
  Preview and Download ↓. The preview sheet shows the text in the `ms-crt`
  console readout with a head line "backend-planning.md · 15 KB · 186 lines",
  then Download ↓ and Close. "Loading…" / "Couldn't load this transcript."
- **Notebook (Moonrise behaviour):** a sheet titled "Notebook" with the
  cover-and-spread `Notebook`: closed on the cover (`cover.webp`), held 1.8s,
  then it swings open by itself (or on a click on the cover) into the spread
  (`paper.webp` with `notes-1.webp` left and `notes-2.png` right, ink turned
  red). Once open it stays open: Esc does nothing, only Close closes it, which
  swings the cover shut, rests about a second, then the dialog goes (~2.3s).
  Footer: "Handwritten · 22 Oct 2026", Clear, Close. Page width fits the
  viewport (`nbWidth()` from the preview), so there is no pen/scroll toggle.
- **Drawing (decided with the user: both pages):** `DrawLayer` with
  `ink = signal` sits over the whole open spread, not just the right page, and
  only takes pointer input once the spread is fully open (after the 1.1s
  turn). Opening the notebook wipes it, as today; Clear wipes it.
- **Scroll lock:** while any sheet is open the page does not scroll (today's
  `html:has(dialog[open])` rule already does this; the Moonrise sheets are
  `<dialog>`s too).
- **Scroll effects:** `TIMER` rise, moon lag and cloud lead via CSS
  scroll-driven animations, as in `bundle.css`; without support the page is
  still. Reduced motion follows `bundle.css`.

## Testing

- Existing suites pass unchanged (`npm test`), plus `npm run lint` and
  `npm run build`.
- **Logic hooks:** each hook gets tests for what the classic component
  tests cover today (validation kinds, submit success and failure, 409 lock,
  history reload on `refreshKey`, paging and stats).
- **useLook:** default, storage, URL param precedence, URL param replaced on
  switch, storage that throws, `data-look` on `<html>`.
- **Switch (App level, mocked stream):** the moon button is on the classic
  look; clicking it ends on the Moonrise look (lazy chunk resolved, fake
  timers or reduced motion); the button there switches back; the stream hook
  is called once across switches (no remount of the stream); a failed chunk
  import shows the error line and Back restores classic.
- **Moonrise look (mocked stream):** running tasks become cards, ended tasks
  archive rows (hidden when none), log lines the feed, status the indicator
  words; form copy and problems in sentence case; cancel 409 copy; one
  archive history popover at a time; Show all / Show less; transcripts open
  the list then the CRT preview; notebook ignores Esc, closes from Close after
  the swing, renders the draw layer over the spread with red ink.
- **In the browser:** run the frontend against the backend, check both
  switches, direct load with `?look=moon`, a reload in Moonrise (no paper
  flash), a narrow phone width, reduced motion, and that the classic look is
  unchanged after a round trip (no leaked styles).

## My calls (not discussed with the user)

- Bottom-right placement of the button; a sun icon on the Moonrise side for
  "back to classic".
- `?look=` and `localStorage['1337.look']` instead of the README's
  `?theme=` (clash with the classic `data-theme`).
- The transition details above (circle from the button, scramble while
  loading, 8s cap, ~500ms fast path when cached, moon rise on arrival, paper
  circle back, scroll to top on every switch).
- Look-local state (form drafts, popovers, 409 locks) resets on a switch.
- Storage is written only by a switch; a `?look=` link alone isn't
  remembered; Back after a failed load stores classic.
- Moonrise copy for our error cases ("This timer already ended.", "Couldn't
  reach the server…", "Couldn't load the night. Try again.").
- File layout: `src/logic/`, `src/look/`, `src/moonrise/`, `ClassicLook.tsx`
  next to `App.tsx`; classic components stay in `src/components/`.

## Left to the builder

- Exact component split inside `src/moonrise/` and prop shapes.
- How the overlay clock is positioned to match the hero clock (shared size
  rule or measured).
- Test mechanics for timing (fake timers vs. reduced-motion path).
