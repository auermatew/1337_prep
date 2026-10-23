import { reducedMotion } from '../moonrise/clock/motion';
import { lockInMs } from '../moonrise/clock/segments';

// Every step of a look switch, in ms. Steps run on timers, never on
// transitionend/animationend: under reduced motion classic base.css turns
// animations off with !important, so those events may never fire.
export const TIMING = {
  full: {
    /** Night grows as a soft-edged circle from the moon button. */
    moonCover: 1100,
    /** Least time the 1337 scramble runs while Moonrise loads. */
    moonHold: 1200,
    /** The same, when chunk, fonts and photos are already loaded. */
    fastHold: 500,
    /** The scramble locking into 1337, digit by digit. */
    lock: lockInMs(4),
    /** The overlay fades off the hero while the moon rises. */
    moonReveal: 1600,
    classicCover: 900,
    classicReveal: 600,
    /** Back after a failed load: the night shrinks into the button. */
    uncover: 1000,
  },
  reduced: {
    moonCover: 150,
    moonHold: 0,
    fastHold: 0,
    lock: 0,
    moonReveal: 150,
    classicCover: 150,
    classicReveal: 150,
    uncover: 150,
  },
};

/** A Moonrise download still not in after this long counts as failed. */
export const STALL_MS = 10000;

/**
 * How long the boot holds the scramble before the lock-in may start. The
 * lock-in overlaps the end of the hold, so 1337 is locked by the hold's end.
 */
export function holdMs(t: (typeof TIMING)['full'], fast: boolean): number {
  return Math.max(0, (fast ? t.fastHold : t.moonHold) - t.lock);
}

/** Under reduced motion, "Loading…" appears once loading takes this long. */
export const LOADING_NOTE_MS = 400;

export const timing = () => (reducedMotion() ? TIMING.reduced : TIMING.full);
