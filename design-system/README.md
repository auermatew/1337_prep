# 1337 Design System

Editorial serif, terminal mono, one purple. This captures the typography, motion and overall style of [1337.partners](https://1337.partners/en), measured from the live site and checked against full-page screenshots on 22 October 2026. It is a style reference for prep work. It has no component library.

## The idea in one line

A 2026 magazine printed on a 1997 desktop. Thin, tightly tracked serif headlines carry the message. The setting is retro computing: Mac-style windows with hard shadows, floppy disks, 1-bit dithered portraits, a flip clock, a visitor counter, and blinking block cursors. The site itself says "AI today is where the internet was in 1997", and in hacker slang 1337 (leet) means elite.

## Voice

- Headlines are short declarative sentences that end with a period: "Built to pass regulatory scrutiny.", "Knowledge is power.", "Build with us."
- **One or two words of a headline go purple**, in the same face and weight with no italic: "and **80% people**.", "internet was in **1997**.", "We unlock **1337** in you."
- Claims are concrete: "6 weeks", "80%", "two-week assessment".
- Labels and buttons are uppercase mono: `PLATFORM`, `LET'S TALK`, `READ ON LINKEDIN →`. Arrows (`→`, `↓`) and checkbox marks (`[x]`, `[ ]`) are plain text glyphs.
- Section tags carry a number when sections are a sequence: `01 · 1337 AI`, `02 · ROLLOUT`, or a range: `1997 → 2026`.

## Typography

Four families, each with one job:

| Role | Family (fallback) | Rules |
|---|---|---|
| Display | PP Editorial Old (Playfair Display, Georgia) | Weight **200** only. Negative tracking from −0.01em (quotes) to −0.03em (72px+). Line height 0.9 to 1.1. |
| Text | General Sans (Inter) | 15px / 1.7 body in `ink-soft`. 600 weight for bold leads in lists ("**Zero retention** DPA, no model training…"). |
| Mono | DM Mono | Uppercase labels at 11.5–12px, weight 500, tracking 0.07–0.08em. Lowercase 11–14.5px for names, window titles, file names and meta tables. |
| Product UI | Inter | 700 headings and 400 body, used **only** inside the product mock screen. |

- Every heading is serif. Sans is for reading, mono is for labels and the machine's voice.
- **Section opener**: a tag (`mono-label` in ink, with a 9px purple square and a 10px gap before it), then the serif headline, then one `text-lead` paragraph in `ink-soft` at most about 620px wide.
- Display sizes are fluid. On a 390px phone the h1 is 40px, the section h2 is 36px and the small h2 is 24px. The lead drops to 16px.
- Quotes are serif with real curly quotes, under a 2px ink top rule. The attribution is the name in sans 600 plus the role in lowercase mono, muted.
- Meta tables use mono throughout: muted keys and ink values (From / Date / Subject / Lang).
- **Font licensing:** PP Editorial Old (Pangram Pangram) is a commercial font and General Sans comes from Fontshare. Neither is on Google Fonts. Where you cannot license or host them, use the fallbacks in the stacks. Playfair Display only goes down to 400, so a fallback headline looks heavier than the original.

## Color

- The page is warm paper (`paper`) with near-black ink (`ink`). The neutrals are warm stone greys, never blue-grey.
- `purple` is the **only** accent. It marks tag squares, highlighted headline words, links, the selected pill, step numbers (`01`) and `[x]` marks. On `band` it lightens to `purple-on-band`.
- `orange` is a signal colour, never text on paper: the blinking cursor, the visitor-counter digits (on ink tiles), and the third floppy disk.
- **Bands**: `band` is warm stone (#1C1917), not black, and always carries a grain overlay. Headlines on it are `on-band`, body text is `on-band-mute` and tags are `on-band-tag`. The first band is followed by a light section, and the page ends on a band before the footer.
- The three floppy disks show the identity trio at full strength: `disk-ink`, `purple` and `orange`.
- The dark theme comes from the site's own `:root` variables, which the live page doesn't use. Treat it as an option.

### Grain recipe (bands)

```css
.band { position: relative; background: #1c1917; color: #fff; }
.band::before { content: ""; position: absolute; inset: 0; opacity: .42; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1  0 0 0 0 .98  0 0 0 0 .95  0 0 0 .75 -.32'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
.band::after { content: ""; position: absolute; inset: 0; pointer-events: none;   /* faint scanlines */
  background: repeating-linear-gradient(0deg, transparent 0 2px, rgba(255,255,255,.01) 2px 4px); }
```

The noise filter is copied from the site. The closing `rect` element was cut off in the extract and has been added back.

## Shape and depth

- **Square by default.** Buttons, windows, cards, tables and sections have `radius-none`. Pills (`radius-pill`) appear only as tabs in the product mock. Rounded corners (`radius-card`) appear only on that mock screen. Floppy disks have 5px corners and a 22px chamfer at the top right.
- **Hard shadows, not soft ones.** A window is a 1px ink frame with `shadow-hard` (5px 5px 0 ink) or `shadow-hard-lg` (8px). The only soft shadow is `shadow-glow`, the purple haze under the product mock.
- **Buttons**: solid is an ink fill with paper text, `mono-button`, 15px × 20px padding and no border. Ghost uses `shadow-ring`, an inset 1.5px ring, instead of a border. On a band, the solid button flips to paper with ink text and the ghost uses `shadow-ring-band`.
- **Rules**: 1px `line` hairlines between rows and stat columns, a 2px ink top rule over quotes and trust grids, and a 1px ink top rule over job and step columns.
- **Nav**: sticky, 64px tall, paper at 90% opacity with `backdrop-filter: blur(10px)` and a 1px rgba(17,17,17,0.05) bottom line. Links are `mono-label`, the CTA is a solid button, and the EN/HU switch is a two-cell segmented control (ink fill on the active cell).

## Retro motifs

These are the details that make it 1337 rather than any editorial site. Use one or two per screen, not all of them.

- **Window**: a 28px title bar with a 1px ink bottom border. A close box and a menu glyph sit on the left, and the file name (`use-cases.txt`, `live.log`, `builder.pict`) is centred in `mono-window`, flanked by horizontal pinstripes. A footer strip holds two mono meta labels (`MACINTOSH, 1980S` · `THE BUILDER AND THE CAT`). See the Window preview.
- **Floppy disk card**: a solid disk-coloured body with a grey metal shutter (gradient #DAD7CE → #BDB9AF) and a paper label holding a mono kicker, a serif title and mono details. The footer reads `HD · 1.44 MB`.
- **1-bit portraits**: photos dithered to black-and-white dots and shown with `image-rendering: pixelated`, on paper with no frame.
- **Checkbox lists**: `[x]` in purple mono before a bold sans lead.
- **Counters and clocks**: a visitor counter of orange DM Mono digits on ink tiles (`0 0 1 3 3 7`) and a flip clock reading 13:37.
- **Timeline**: a 1px ink line with 6px square nodes. The current node is purple and its year is set in purple serif.
- **Split bar**: a full-width two-cell bar sized by percentage (`TECHNOLOGY · 20%` on paper, `PEOPLE · 80%` on purple) with mono labels.
- **Open slot**: a 1px dashed purple outline marking a space waiting for someone (`+ YOUR COMPANY` in the logo strip).

## Motion

Two kinds of motion live together. Use **smooth** motion (one easing curve, `ease-1337`) for layout and **stepped** motion (`steps()`) for anything that should feel like a machine. See the Motion section for copy-paste CSS and the live previews.

- Scroll reveal: opacity 0 → 1 and translateY 18px → 0 over `dur-reveal`.
- Hover: the nav underline grows (background-size, 0.3s, `ease-1337`), buttons lift (transform + box-shadow, `dur-base`), and colours change in `dur-fast`.
- Signature stepped moments: the blinking block cursor in `orange`, the typing effect (24ms per character), loaders filling in 19 steps, split-flap flips and a rotated stamp landing.
- Respect `prefers-reduced-motion`. The site also supports `html[data-motion="off"]`, which shows every end state without animation.
