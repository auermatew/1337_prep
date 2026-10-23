# MoonPhase

Progress as a moon phase: a new moon when a timer starts, waxing to full when it ends. Replaces the progress bar everywhere.

- Provide `progress` from 0 to 1 (elapsed ÷ duration). Default size 28px; 24–32px in cards.
- Lit part in `moon`, unlit in `moon-shadow`, ring in `line-strong`. Never red: the countdown already carries the signal.
- It has an accessible label ("40% elapsed"); do not add a percentage next to it.
