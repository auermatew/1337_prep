import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { SegmentClock } from '../moonrise/clock/SegmentClock';
import { reducedMotion } from '../moonrise/clock/motion';
import { starField } from '../moonrise/clock/stars';
import type { Look } from './look';
import { LOADING_NOTE_MS, timing } from './timing';
import type { Origin, Phase } from './useLookSwitch';

// The curtain between the looks. To Moonrise: night grows from the button,
// the red 1337 scrambles while Moonrise loads, locks in, and the curtain
// fades off the hero, whose clock sits exactly where this one does. To
// classic: a paper circle, then a short fade.
export function LookTransition({
  phase,
  target,
  origin,
  onRetry,
  onBack,
}: {
  phase: Phase;
  target: Look;
  origin: Origin;
  onRetry: () => void;
  onBack: () => void;
}) {
  const reduced = reducedMotion();
  const stars = useMemo(() => starField(), []);
  const [slow, setSlow] = useState(false);

  // Reduced motion has no scramble: say "Loading…" once it takes a while.
  useEffect(() => {
    if (!reduced || phase !== 'boot') return;
    const id = setTimeout(() => setSlow(true), LOADING_NOTE_MS);
    return () => {
      clearTimeout(id);
      setSlow(false);
    };
  }, [reduced, phase]);

  if (phase === 'idle') return null;

  const t = timing();
  const moon = target === 'moon';
  const ms =
    phase === 'cover'
      ? moon
        ? t.moonCover
        : t.classicCover
      : phase === 'reveal'
        ? moon
          ? t.moonReveal
          : t.classicReveal
        : phase === 'uncover'
          ? t.uncover
          : 0;
  const style = {
    '--lt-x': `${origin.x}px`,
    '--lt-y': `${origin.y}px`,
    '--lt-ms': `${ms}ms`,
  } as CSSProperties;
  const covered = phase === 'boot' || phase === 'lock' || phase === 'failed';

  return (
    <>
      <div
        className={[
          'look-curtain',
          moon ? 'look-curtain-moon' : 'look-curtain-classic',
          `look-phase-${phase}`,
          reduced && 'look-reduced',
        ]
          .filter(Boolean)
          .join(' ')}
        style={style}
        aria-hidden="true"
      >
        {moon && (
          <div className="look-stars">
            {stars.map((st, i) => (
              <i key={i} style={st} />
            ))}
          </div>
        )}
        {moon && !reduced && (covered || phase === 'reveal') && (
          <div className="look-clock">
            <SegmentClock
              value={phase === 'failed' ? '----' : '1337'}
              fluid
              opticalCenter={phase !== 'failed'}
              dim={phase === 'failed'}
              boot={phase === 'boot' ? 'hold' : false}
            />
          </div>
        )}
        {moon && reduced && slow && phase === 'boot' && (
          <p className="look-note">Loading…</p>
        )}
      </div>
      {phase === 'failed' && (
        <div className="look-failed" role="alert">
          <p>Couldn&apos;t load the night. Try again.</p>
          <span className="look-failed-actions">
            <button type="button" className="look-failed-btn" onClick={onRetry}>
              Try again
            </button>
            <button type="button" className="look-failed-btn" onClick={onBack}>
              Back
            </button>
          </span>
        </div>
      )}
    </>
  );
}
