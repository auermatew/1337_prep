import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import { preloadMoonrise } from './loadMoonrise';
import type { Look } from './look';
import type { Origin } from './useLookSwitch';

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4.25" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
    </svg>
  );
}

// The fixed corner button: a moon on the classic desk, a sun in the night.
export function LookSwitch({
  look,
  busy,
  onSwitch,
}: {
  look: Look;
  busy: boolean;
  onSwitch: (origin: Origin) => void;
}) {
  const moon = look === 'moon';
  const ref = useRef<HTMLButtonElement>(null);
  const wasBusy = useRef(busy);

  // The button is disabled during a switch, which drops its focus: give it
  // back when the switch is over, unless focus has gone somewhere else.
  useEffect(() => {
    const active = document.activeElement;
    if (wasBusy.current && !busy && (!active || active === document.body)) {
      ref.current?.focus();
    }
    wasBusy.current = busy;
  }, [busy]);

  const click = (e: MouseEvent<HTMLButtonElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    onSwitch({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
  };
  return (
    <button
      ref={ref}
      type="button"
      className={moon ? 'look-switch look-switch-moon' : 'look-switch'}
      aria-label={moon ? 'Switch to classic' : 'Switch to Moonrise'}
      disabled={busy}
      onClick={click}
      onPointerEnter={moon ? undefined : preloadMoonrise}
      onFocus={moon ? undefined : preloadMoonrise}
    >
      {moon ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
