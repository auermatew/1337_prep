# 1337 Partners design system — short design

**Size:** small change (extract and package; no app code).

## Intent
Capture the visual language of https://1337.partners/en as a reusable design
system so future pages, mock-ups and decks built with Claude look like 1337.

## Goals
For the user's prep project: typography, animations and overall style only.
- Tokens measured from the live site: colours, type scale, fonts, radius, layout widths.
- Motion: the easing curve, durations, scroll reveal, stepped terminal-style
  animations (blink cursor, typing, `steps()` loaders), marquee, and the
  reduced-motion switch, each with a live preview.
- A README with the overall style rules (serif vs mono, accent restraint, square corners, hairlines).

## Non-goals (updated)
- No component library (nav, cards, tabs etc. were dropped at the user's request).

## Non-goals / anti-goals
- Not a copy of the site or its content; no impersonation of 1337 as a published page.
- Don't invent a palette: values must come from the site's computed styles.

## Constraints
- Artifact CSP: only Google Fonts load. PP Editorial Old and General Sans are
  commercial / Fontshare faces, so previews use the site's own fallbacks
  (Playfair Display, Inter); tokens still name the real faces first.

## Approaches
1. Files in this repo (CSS + JSON + reference page) — portable to any code.
2. **Claude "Design System" artifact (picked by you)** — one browsable reference
   that Claude reads when making decks and designs later.
3. Tailwind preset — only useful for a Tailwind project.

## Decided
- Light theme = what the site renders (`#FBFAF4` paper, `#111` ink, purple `#783FF3`, rare orange `#FA7E00`).
- Dark theme = the unused `:root` dark palette in the site's CSS (`#12100E` / `#F2EFE7`).
- Type: PP Editorial Old 200 for display (80/64/32/28px, tight tracking);
  General Sans 15/25.5 body; DM Mono 11.5px uppercase, +0.07em labels.
- Mostly square corners; 999px pills; 10–14px cards. Wrap 1240px, wide 1360px.

## Left to the builder
Component selection details and preview layout, following the Design System type's instructions.
