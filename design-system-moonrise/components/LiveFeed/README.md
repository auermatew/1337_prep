# LiveFeed

Every change on the stream as it arrives, oldest at the top, at most 50 lines. Replaces the old terminal log: no cursor, no monospace.

- Provide `lines: [{ id, name, state, at }]` and `lastId`. Put the `LiveIndicator` under the feed, right-aligned: it shows the page's connection, not the feed's. Set `highlightLast` when a line arrives so it flashes `signal-ghost` once.
- Each line: `#id` in `ink-3`, name, state word in its colour, time. The footer reads "Last event #59".
- Desktop: a 340px column beside the timer grid, the same height as the cards area; with `ms-feed-fill` its list scrolls inside. Phones: below the cards, about 420px tall.
