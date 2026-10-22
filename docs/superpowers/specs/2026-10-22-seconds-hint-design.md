# Seconds hint — design

Small change to `StartForm` on `feature/frontend`.

## Intent

Keep typing raw seconds (`1500`), but show what that is in minutes/hours
while typing, so nobody has to do the arithmetic.

## Decided (with the user)

- The `SECONDS` field stays as it is. No unit switcher.
- While the field has focus and holds a valid whole number from 60 to 86400,
  a hint fades in above the field, right-aligned, at half opacity.
- Zero parts are left out: `1500` → `= 25M`, `3725` → `= 1H 02M 05S`,
  `7200` → `= 2H`, `3605` → `= 1H 05S`. Under 60 s: no hint. Over 86400:
  `HELL NAW`; exactly 1337: `= LEET` (both added on request).
- It fades out on blur or when the value is invalid. Motion: 0.25 s fade
  plus a 4px rise with `--ease-1337`; reduced motion: fade only.
- The input's `aria-describedby` points at the hint (read on focus, not on
  every keystroke).

## Approaches

One sensible way: a client-side formatter plus an absolutely positioned hint
inside the existing field. A floating tooltip library or a second read-only
input were rejected (new dependency / clutter) for a one-line label.

## My calls

- `=` prefix, and units padded to two digits after a larger unit, matching
  `TIME SPENT` in the archive.
