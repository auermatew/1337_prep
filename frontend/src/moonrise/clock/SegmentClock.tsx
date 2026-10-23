import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import {
  ALL,
  DH,
  DIGITS,
  FRAME_MS,
  LOCK_FIRST,
  LOCK_STEP,
  R,
  SEGS,
  T_HALF,
  COLON_W,
  layout,
  points,
} from './segments';
import { reducedMotion } from './motion';
import './clock.css';

export interface SegmentClockProps {
  /** Digits, plus colons for countdowns. Default "1337" (a word: no colon). */
  value?: string;
  /** Rendered height in px; width follows. Default 120. */
  height?: number;
  /** Fill the container's width instead; height follows. */
  fluid?: boolean;
  /** Shift left when the value starts with "1", so the word looks centred. */
  opticalCenter?: boolean;
  /** Now and then drop a segment or dip the display, like a tired LED. */
  flicker?: boolean;
  /**
   * 'once': scramble, then lock in left to right. 'hold': keep scrambling
   * until boot turns false, then lock in.
   */
  boot?: 'once' | 'hold' | false;
  /** Change it to flash the clock once (one flash per stream event). */
  pulseKey?: string | number | null;
  /** Fast stepped pulse for the last 10 seconds and "Finishing…". */
  urgent?: boolean;
  /** Unlit look for ended timers: grey segments, no glow. */
  dim?: boolean;
  /** The SVG bloom. Default true; turned off on cards when many run. */
  glow?: boolean;
  /** Blink the colon at 1 Hz. Default true. */
  blinkColon?: boolean;
  label?: string;
  className?: string;
}

const random = () => String(Math.floor(Math.random() * 10));

// The 1337 display. Lit segments glow in `signal`, unlit ones stay as ghosts.
export function SegmentClock({
  value = '1337',
  height = 120,
  fluid,
  opticalCenter,
  flicker,
  boot = false,
  pulseKey,
  urgent,
  dim,
  glow = true,
  blinkColon = true,
  label,
  className,
}: SegmentClockProps): ReactElement {
  const lay = useMemo(() => layout(value), [value]);
  const digitIdx = useMemo(() => {
    const m = new Map<number, number>();
    let k = 0;
    lay.items.forEach((it, i) => {
      if (it.kind === 'digit') m.set(i, k++);
    });
    return m;
  }, [lay]);
  const lastFrame = LOCK_FIRST + LOCK_STEP * Math.max(0, digitIdx.size - 1) + 1;

  const [bootStep, setBootStep] = useState(() =>
    boot && !reducedMotion() ? 0 : -1,
  );
  const [, setTick] = useState(0);
  const holding = boot === 'hold' && bootStep >= 0;

  // Released from a hold: start locking in at once (the scramble has run).
  const [prevBoot, setPrevBoot] = useState(boot);
  if (prevBoot !== boot) {
    setPrevBoot(boot);
    if (prevBoot === 'hold' && bootStep >= 0) {
      setBootStep(Math.max(bootStep, LOCK_FIRST));
    }
  }

  const [flash, setFlash] = useState(false);
  const [dark, setDark] = useState<Set<string> | null>(null);
  const [dip, setDip] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const firstPulse = useRef(true);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');

  // The display lights the moon: tell the Scene around it when the light
  // drops, so the moon's red-lit top darkens with it.
  const setLight = (v: 'boot' | 'dip' | 'drop' | null) => {
    const scene = rootRef.current?.closest('.ms-scene');
    if (!scene) return;
    if (v) scene.setAttribute('data-clock-light', v);
    else scene.removeAttribute('data-clock-light');
  };

  useEffect(() => {
    if (bootStep < 0) return;
    const t = setTimeout(() => {
      if (holding) setTick((n) => n + 1);
      else setBootStep(bootStep >= lastFrame ? -1 : bootStep + 1);
    }, FRAME_MS);
    return () => clearTimeout(t);
  });

  const booting = bootStep >= 0;
  useEffect(() => {
    setLight(booting ? 'boot' : null);
  }, [booting]);

  useEffect(() => {
    if (firstPulse.current) {
      firstPulse.current = false;
      return;
    }
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 320);
    return () => clearTimeout(t);
  }, [pulseKey]);

  useEffect(() => {
    if (!flicker || reducedMotion()) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = () => {
      timers.push(
        setTimeout(
          () => {
            const keys: string[] = [];
            lay.items.forEach((it, i) => {
              if (it.kind !== 'digit') return;
              for (const s of DIGITS[it.ch] ?? '') keys.push(`${i}${s}`);
            });
            if (keys.length === 0) return;
            const pick = () => keys[Math.floor(Math.random() * keys.length)];
            const picked = new Set([pick()]);
            if (Math.random() < 0.35) picked.add(pick());
            const dipping = Math.random() < 0.3;
            setDark(picked);
            if (dipping) setDip(true);
            setLight(dipping ? 'dip' : 'drop');
            timers.push(
              setTimeout(
                () => {
                  setDark(null);
                  setDip(false);
                  setLight(null);
                  schedule();
                },
                70 + Math.random() * 90,
              ),
            );
          },
          700 + Math.random() * 2600,
        ),
      );
    };
    schedule();
    return () => {
      timers.forEach(clearTimeout);
      setLight(null);
    };
  }, [flicker, lay]);

  const charAt = (ch: string, i: number) =>
    !booting || bootStep >= LOCK_FIRST + LOCK_STEP * (digitIdx.get(i) ?? 0)
      ? ch
      : random();

  const off: ReactElement[] = [];
  const on: ReactElement[] = [];
  lay.items.forEach((it, i) => {
    if (it.kind === 'colon') {
      const mx = it.x + COLON_W / 2 - T_HALF;
      [DH * 0.32 - T_HALF, DH * 0.68 - T_HALF].forEach((y, j) => {
        on.push(
          <rect
            key={`${i}c${j}`}
            x={mx}
            y={y}
            width={11}
            height={11}
            rx={1.5}
            className="ms-seg-on"
          />,
        );
      });
      return;
    }
    const lit = DIGITS[charAt(it.ch, i)] ?? '';
    for (const s of ALL) {
      const isOn = lit.includes(s) && !dark?.has(`${i}${s}`);
      (isOn ? on : off).push(
        <polygon
          key={`${i}${s}`}
          points={points(SEGS[s], it.x)}
          className={isOn ? 'ms-seg-on' : 'ms-seg-off'}
        />,
      );
    }
  });

  // The bloom is an SVG filter with a generous region: CSS drop-shadow on
  // SVG content is cut to a tight box and shows a visible rectangle.
  const fid = `msclock${uid}`;
  const glowing = glow && !dim;
  const size = fluid
    ? { style: { width: '100%', height: 'auto' } }
    : { width: (height * lay.width) / DH, height };
  const style: CSSProperties & Record<string, string> = {
    '--k': String(height / 120),
  };
  if (opticalCenter && value.startsWith('1')) {
    style.transform = `translateX(-${((((R - T_HALF) / 2) * 100) / lay.width).toFixed(2)}%)`;
  }

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={label ?? value}
      className={[
        'ms-clock',
        fluid && 'ms-clock-fluid',
        flash && 'ms-clock-flash',
        dip && 'ms-clock-dip',
        flicker && 'ms-clock-flicker',
        urgent && 'ms-clock-urgent',
        dim && 'ms-clock-dim',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      <svg viewBox={`0 0 ${lay.width} ${DH}`} aria-hidden="true" {...size}>
        {glowing && (
          <defs>
            <filter
              id={fid}
              x="-40%"
              y="-120%"
              width="180%"
              height="340%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation={2} result="b1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation={9} result="b2" />
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation={30}
                result="b3"
              />
              <feColorMatrix
                in="b3"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.7 0"
                result="b3a"
              />
              <feMerge>
                <feMergeNode in="b3a" />
                <feMergeNode in="b2" />
                <feMergeNode in="b1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}
        <g>{off}</g>
        <g
          className={
            blinkColon && !booting
              ? 'ms-clock-lit ms-clock-blinkcolon'
              : 'ms-clock-lit'
          }
          filter={glowing ? `url(#${fid})` : undefined}
        >
          {on}
        </g>
      </svg>
    </div>
  );
}
