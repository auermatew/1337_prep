# Motion

The exact transitions and keyframes from 1337.partners, ready to paste. Token names refer to the `duration` and `easing` families in `tokens.json`.

## The curve

```css
:root { --ease: cubic-bezier(.2,.7,.2,1); }
```

Every transform (lifts, slides, bars, line draws, stamps) uses `--ease`. Colour and opacity changes use plain `ease`.

## Transition inventory

| What | Properties | Duration | Easing |
|---|---|---|---|
| Scroll reveal | opacity, transform | 0.7s | ease |
| Photo / meta fade | opacity | 0.2s | ease |
| Button and link colours | background, color, border-color | 0.15s | ease |
| Table row hover | background-color, color | 0.12s | ease |
| Button / card lift | transform, box-shadow | 0.25s | --ease |
| Nav underline grow | background-size | 0.3s | --ease |
| Tab panel / quote swap | opacity, transform (8px) | 0.35s | --ease |
| Bar chart grow | transform: scaleX | 0.9s, +0.1s stagger | --ease |
| Line draw | stroke-dashoffset | 1.1s (sparkline 1.4s) | --ease |
| Theme switch | background-color, color on body | 0.35s | ease |

## Scroll reveal

```css
.rv { opacity: 0; transform: translateY(18px); transition: opacity .7s, transform .7s; }
.rv.in, .no-js .rv, html[data-motion="off"] .rv { opacity: 1; transform: none; }
```

Add `.in` with an IntersectionObserver. The `.no-js` fallback keeps content visible.

## Nav underline

```css
.nav a { padding: 7px 0;
  background: linear-gradient(var(--purple), var(--purple)) 0 100% / 0 2px no-repeat;
  transition: background-size .3s var(--ease); }
.nav a:hover { background-size: 100% 2px; }
```

## Stepped keyframes

```css
@keyframes blink { 50% { opacity: 0; } }
/* block cursor: */ .cur { display: inline-block; width: .4em; height: .72em; background: var(--orange);
  margin-left: .12em; vertical-align: -.05em; animation: blink 1.05s steps(1) infinite; }
/* live dot: */ .live::before { content: ""; width: 8px; height: 8px; background: var(--purple);
  animation: blink 1.6s steps(1) infinite; }

@keyframes type { from { width: 0; } to { width: calc(var(--n) * 1ch); } }
/* --n = character count; 24ms per character */
.type { overflow: hidden; white-space: nowrap; animation: type calc(var(--n) * 24ms) steps(var(--n), end) forwards; }

@keyframes ld { to { transform: scaleX(1); } }
.ld::after { content: ""; position: absolute; inset: 0; background: var(--ink);
  transform: scaleX(0); transform-origin: left; animation: ld 1.9s steps(19) forwards; }

@keyframes dial { to { clip-path: inset(0); } }
.dial.in { animation: dial 1.9s steps(19) forwards; }

@keyframes flip { 50% { transform: scaleY(.08); } }   /* split-flap character, 0.06s linear */
.flap .c { animation: flip .06s linear; }
```

## Landing and entering

```css
@keyframes stamp {
  0%   { opacity: 0;   transform: rotate(-13deg) scale(1.4); }
  55%  { opacity: .95; transform: rotate(-13deg) scale(.95); }
  100% { opacity: .92; transform: rotate(-13deg) scale(1); }
}
.stamp.in { animation: stamp .55s var(--ease) forwards; }

@keyframes tcin { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } } /* disclosure body, .35s */
@keyframes pmIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } } /* tab panel, .32s */

@keyframes leetflash { 0%,100% { background-color: var(--paper); } 12%,80% { background-color: var(--purple-soft); } }
.leet-flash { animation: leetflash 2.6s ease; }
```

## Marquee

```css
@keyframes mq { to { transform: translateX(-50%); } }
.mq-track { display: flex; width: max-content; animation: mq 42s linear infinite; }
.mq:hover .mq-track { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .mq-track { animation: none; } }
```

Duplicate the item list once inside the track so −50% loops seamlessly.

## Reduced motion

Apply this to every animation above, not only the marquee as the live site does:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
  .rv { opacity: 1; transform: none; }
}
```
