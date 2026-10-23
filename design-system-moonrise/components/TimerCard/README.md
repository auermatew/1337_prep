# TimerCard

One running timer: name and short id, the moon-phase progress, the seven-segment countdown, its state, end time, History and Cancel.

- Provide `name`, `id` (full UUID; the card shows 8 characters), `remainingMs` computed locally from `endsAt`, `durationMs`, `endsAt` as local time, and `state`.
- States: `running` · `finishing` (the countdown reached 00:00 before the server confirmed: shows "Finishing…") · `cancelling` (Cancel disabled) · `error` for a failed cancel (409) · `historyOpen` with `history`.
- Set `exit` to `finished` (brightens, then sinks and fades, like a moon setting) or `cancelled` (fades) before the app moves the timer to the archive.
- Liquid glass (`ms-panel-liquid`) with no red glow around the card: the red lives only in the countdown digits and the state word. History opens as a popover over the lower card, so the card never changes height. The card never marks itself finished: only the server does.
- Grid: 2 columns beside the feed on desktop, 1 on phones, inside a fixed-height `ms-scroll` area (about 700px, 560px on phones) that fades out at both the top and the bottom (`ms-scroll-fade`; the fades sit in the area's own padding, so cards at rest are never dimmed), so many timers never push the archive down.
