# HistoryTimeline

The state changes of one timer, oldest first: event number, state and time, on a `line-strong` spine with short ticks (no dots).

- Provide `events: [{ id, state, at }]`. Opens inside a TimerCard or under an archive row, expanding over `dur-base` with `ease-drift`.
- States are coloured: running `signal-ink`, finished `moon`, cancelled `ink-3`.
