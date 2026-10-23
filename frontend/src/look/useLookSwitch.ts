import { useCallback, useEffect, useState } from 'react';
import { isMoonriseReady, loadMoonrise } from './loadMoonrise';
import { applyLookAttr, readInitialLook, saveLook, type Look } from './look';
import { reloadInto } from './reload';
import { STALL_MS, holdMs, timing } from './timing';

export type Phase =
  | 'idle'
  /** The overlay grows from the button over the old look. */
  | 'cover'
  /** Covered; the 1337 scramble runs while Moonrise loads. */
  | 'boot'
  /** Loaded: the scramble locks into 1337. */
  | 'lock'
  /** The chunk failed or stalled: Try again (reload) or Back. */
  | 'failed'
  /** Back from a failure: the night shrinks into the button. */
  | 'uncover'
  /** The new look is under the overlay, which fades away. */
  | 'reveal';

export interface Origin {
  x: number;
  y: number;
}

interface State {
  /** The look on the page; null while a first Moonrise load runs. */
  shown: Look | null;
  target: Look;
  phase: Phase;
  origin: Origin;
  /** Everything was cached at the click: a short boot. */
  fast: boolean;
  /** Bumped per load attempt; a stale attempt's result is ignored. */
  attempt: number;
  loaded: boolean;
  loadFailed: boolean;
  holdDone: boolean;
  /** Arriving through a switch stores the look; a direct load does not. */
  save: boolean;
}

const centre = (): Origin => ({
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
});

function initialState(): State {
  const look = readInitialLook();
  applyLookAttr(look);
  const base = {
    origin: centre(),
    fast: false,
    loaded: false,
    loadFailed: false,
    holdDone: false,
    save: false,
  };
  return look === 'moon'
    ? { ...base, shown: null, target: 'moon', phase: 'boot', attempt: 1 }
    : {
        ...base,
        shown: 'classic',
        target: 'classic',
        phase: 'idle',
        attempt: 0,
      };
}

const toTop = () => {
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
};

// The look switch as a small state machine:
// moon:    cover → boot (load + hold) → lock → reveal → idle, or boot → failed
// classic: cover → reveal → idle
export function useLookSwitch() {
  const [state, setState] = useState(initialState);
  const { phase, target, attempt, holdDone, loaded, loadFailed, fast, save } =
    state;

  // The boot ends when the load is in and the hold has passed: settled during
  // render, so the lock-in starts in the same frame.
  if (phase === 'boot' && loadFailed) {
    setState({ ...state, phase: 'failed' });
  } else if (phase === 'boot' && loaded && holdDone) {
    setState({ ...state, phase: 'lock' });
  }

  // One load per attempt.
  useEffect(() => {
    if (attempt === 0) return;
    let alive = true;
    loadMoonrise().then(
      () => alive && setState((s) => ({ ...s, loaded: true })),
      () => alive && setState((s) => ({ ...s, loadFailed: true })),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  // Timed steps.
  useEffect(() => {
    const t = timing();
    const after = (ms: number, fn: () => void) => {
      const id = setTimeout(fn, ms);
      return () => clearTimeout(id);
    };
    switch (phase) {
      case 'cover':
        if (target === 'moon') {
          return after(t.moonCover, () =>
            setState((s) => ({ ...s, phase: 'boot' })),
          );
        }
        return after(t.classicCover, () => {
          saveLook('classic');
          toTop();
          setState((s) => ({ ...s, shown: 'classic', phase: 'reveal' }));
        });
      case 'boot':
        if (holdDone) return;
        return after(holdMs(t, fast), () =>
          setState((s) => ({ ...s, holdDone: true })),
        );
      case 'lock':
        return after(t.lock, () => {
          if (save) saveLook('moon');
          else applyLookAttr('moon');
          document.documentElement.setAttribute('data-arriving', '');
          toTop();
          setState((s) => ({ ...s, shown: 'moon', phase: 'reveal' }));
        });
      case 'reveal':
        return after(target === 'moon' ? t.moonReveal : t.classicReveal, () => {
          document.documentElement.removeAttribute('data-arriving');
          setState((s) => ({ ...s, phase: 'idle' }));
        });
      case 'uncover':
        return after(t.uncover, () =>
          setState((s) => ({ ...s, phase: 'idle' })),
        );
    }
    // holdDone and fast only matter inside the boot; attempt restarts it.
  }, [phase, target, attempt, holdDone, fast, save]);

  // A download that never arrives (captive portal, a dead connection) must
  // not leave the page stuck under the night: it fails, with Back.
  useEffect(() => {
    if (phase !== 'boot') return;
    const id = setTimeout(
      () =>
        setState((s) =>
          s.phase === 'boot' && !s.loaded ? { ...s, loadFailed: true } : s,
        ),
      STALL_MS,
    );
    return () => clearTimeout(id);
  }, [phase, attempt]);

  const switchTo = useCallback((next: Look, origin: Origin) => {
    setState((s) => {
      if (s.phase !== 'idle' || s.shown === next) return s;
      if (next === 'classic') {
        return { ...s, phase: 'cover', target: 'classic', origin };
      }
      return {
        ...s,
        phase: 'cover',
        target: 'moon',
        origin,
        fast: isMoonriseReady(),
        attempt: s.attempt + 1,
        loaded: false,
        loadFailed: false,
        holdDone: false,
        save: true,
      };
    });
  }, []);

  // A failed chunk stays failed for the page's life: try again by reloading
  // straight into the night.
  const retry = useCallback(() => reloadInto('moon'), []);

  const back = () => {
    if (phase !== 'failed') return;
    // A switch to classic: a returning visitor is not sent into the failing
    // night again.
    saveLook('classic');
    setState((s) => ({ ...s, phase: 'uncover', shown: 'classic' }));
  };

  return {
    shown: state.shown,
    target,
    phase,
    origin: state.origin,
    switchTo,
    retry,
    back,
  };
}
