import { memo, useEffect, useRef } from 'react';
import type { LogLine, StreamStatus } from '../stream/useTaskStream';
import { Window } from './Window';
import './LiveLog.css';

export function StreamLabel({
  status,
  lastEventId,
}: {
  status: StreamStatus;
  lastEventId: number | null;
}) {
  if (status === 'open') {
    return (
      <span className="stream-label">
        <span className="stream-dot" aria-hidden="true">
          ●
        </span>{' '}
        CONNECTED · LAST ID {lastEventId ?? '—'}
      </span>
    );
  }
  return (
    <span className="stream-label">
      {status === 'connecting' ? 'CONNECTING…' : 'RECONNECTING…'}
    </span>
  );
}

export const LiveLog = memo(function LiveLog({
  log,
  status,
  lastEventId,
}: {
  log: LogLine[];
  status: StreamStatus;
  lastEventId: number | null;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const footer = (
    <>
      <StreamLabel status={status} lastEventId={lastEventId} />
      {status !== 'open' && <span className="ll-ld" aria-hidden="true" />}
    </>
  );

  return (
    <Window title="live.log" footer={footer} className="ll">
      <div className="ll-body" ref={bodyRef} aria-live="polite">
        {log.map((line) => (
          <div key={line.id} className="ll-line">
            <span className="ll-id">#{line.id}</span>
            <span className="ll-name">{line.name}</span>
            <span
              className={line.state === 'running' ? 'll-state on' : 'll-state'}
            >
              {line.state}
            </span>
          </div>
        ))}
        <div className="ll-line">
          <span className="cur" aria-hidden="true" />
        </div>
      </div>
    </Window>
  );
});
