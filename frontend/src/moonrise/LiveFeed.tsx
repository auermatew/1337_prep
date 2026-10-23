import { memo, useEffect, useRef } from 'react';
import type { LogLine } from '../stream/useTaskStream';
import { formatClock } from '../time/format';

// The stream's log on liquid glass, oldest first, kept scrolled to the
// newest line, which flashes once as it arrives.
export const LiveFeed = memo(function LiveFeed({
  log,
  lastEventId,
}: {
  log: LogLine[];
  lastEventId: number | null;
}) {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  return (
    <section
      className="ms-panel ms-panel-liquid ms-feed ms-feed-fill"
      aria-label="Live feed"
    >
      <header className="ms-feed-head">
        <h3 className="ms-title">Live feed</h3>
      </header>
      {log.length > 0 ? (
        <ol className="ms-feed-list" aria-live="polite" ref={listRef}>
          {log.map((line, i) => (
            <li
              key={line.seq}
              className={
                i === log.length - 1
                  ? 'ms-feed-line ms-feed-new'
                  : 'ms-feed-line'
              }
            >
              <span className="ms-feed-id">#{line.id}</span>
              <span className="ms-feed-name">{line.name}</span>
              <span className={`ms-state-${line.state}`}>{line.state}</span>
              <span className="ms-num ms-muted">{formatClock(line.at)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="ms-muted ms-feed-empty">Waiting for the first event.</p>
      )}
      <footer className="ms-feed-foot">
        {lastEventId !== null ? `Last event #${lastEventId}` : 'No events yet'}
      </footer>
    </section>
  );
});
