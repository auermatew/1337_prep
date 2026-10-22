import { useEffect, useState } from 'react';
import { taskEvents } from '../api/client';
import type { TaskEventDto } from '../api/types';
import { formatClock } from '../time/format';
import './History.css';

type Result = { events: TaskEventDto[] } | { failed: true };

export function History({
  taskId,
  refreshKey,
}: {
  taskId: string;
  refreshKey: number | null;
}) {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let alive = true;
    taskEvents(taskId).then(
      (events) => {
        if (alive) setResult({ events });
      },
      () => {
        if (alive) setResult({ failed: true });
      },
    );
    return () => {
      alive = false;
    };
  }, [taskId, refreshKey]);

  if (result === null) return <p className="hist-note">LOADING…</p>;
  if ('failed' in result) {
    return <p className="hist-note err-line">COULD NOT LOAD HISTORY</p>;
  }
  return (
    <ol className="hist">
      {result.events.map((e) => (
        <li key={e.id} className="hist-row">
          <span className="hist-id">#{e.id}</span>
          <span
            className={e.state === 'running' ? 'hist-state on' : 'hist-state'}
          >
            {e.state.toUpperCase()}
          </span>
          <span className="hist-at">{formatClock(e.at)}</span>
        </li>
      ))}
    </ol>
  );
}
