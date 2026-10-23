import { lazy, Suspense, useMemo } from 'react';
import { ClassicLook } from './ClassicLook';
import { loadMoonrise } from './look/loadMoonrise';
import { LookSwitch } from './look/LookSwitch';
import { LookTransition } from './look/LookTransition';
import { useLookSwitch } from './look/useLookSwitch';
import './look/look.css';
import { useDeparting } from './stream/useDeparting';
import { useTaskStream } from './stream/useTaskStream';
import { useNow } from './time/useNow';

// The Moonrise look downloads only when someone picks it.
const MoonriseLook = lazy(loadMoonrise);

// Owns the stream for the page's whole life and hands its data to the look,
// so switching looks never reconnects or empties the feed.
export default function App() {
  const sw = useLookSwitch();
  const { tasks, status, lastEventId, log, upsert, error } = useTaskStream();
  const now = useNow();
  const departing = useDeparting(tasks);

  const newestEventIds = useMemo(() => {
    const ids = new Map<string, number>();
    for (const line of log) {
      ids.set(line.taskId, Math.max(ids.get(line.taskId) ?? 0, line.id));
    }
    return ids;
  }, [log]);

  const onDesk = useMemo(
    () => tasks.filter((t) => t.state === 'running' || departing.has(t.id)),
    [tasks, departing],
  );
  const ended = useMemo(
    () => tasks.filter((t) => t.state !== 'running' && !departing.has(t.id)),
    [tasks, departing],
  );

  const desk = {
    onDesk,
    ended,
    departing,
    log,
    status,
    lastEventId,
    error,
    upsert,
    newestEventIds,
    now,
  };

  const busy = sw.phase !== 'idle';

  return (
    <>
      {/* Out of reach (keyboard, screen readers) while the curtain is up. */}
      <div inert={busy}>
        {sw.shown === 'classic' && <ClassicLook {...desk} />}
        {sw.shown === 'moon' && (
          <Suspense fallback={null}>
            <MoonriseLook {...desk} />
          </Suspense>
        )}
      </div>
      <LookSwitch
        look={sw.shown ?? sw.target}
        busy={busy}
        onSwitch={(origin) =>
          sw.switchTo(sw.shown === 'moon' ? 'classic' : 'moon', origin)
        }
      />
      <LookTransition
        phase={sw.phase}
        target={sw.target}
        origin={sw.origin}
        onRetry={sw.retry}
        onBack={sw.back}
      />
      {/* A div, not a p: a p's default margins would add a strip under the
          page even while it is visually hidden. */}
      <div className="visually-hidden" aria-live="polite">
        {busy &&
          (sw.target === 'moon'
            ? 'Switching to Moonrise…'
            : 'Switching to classic…')}
      </div>
    </>
  );
}
