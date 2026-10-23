# Button

Four variants. Verb first, sentence case: "Start timer →", "Cancel", "Show all (24)".

- **primary:** brushed silver, a metal gradient (`silver-hi` → `silver-mid` → `silver-lo`) with a bright top edge and `on-ink` text; on hover it brightens slightly and pressing dims it. Everything stays inside the button: inset highlights only, never an outer shadow. Once per view: Start timer.
- **glass:** `glass` fill, `line-strong` border, for secondary actions on imagery (Preview, Download ↓).
- **text:** `ink-2`, an `ink` underline grows from the left on hover. History, Close, Show all, nav links.
- **cancel:** a text button that turns `signal-ink` on hover. Only for cancelling a running timer; disabled while the cancel is in flight.
- Never a red filled button, a pill or an all-caps label. Focus: 2px `ink` outline, 3px offset.
