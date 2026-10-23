import { useTaskHistory } from '../logic/useTaskHistory';
import { formatClock } from '../time/format';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// A task's history floating over its card or row, so nothing moves.
export function HistoryPopover({
  taskId,
  name,
  refreshKey,
  variant,
}: {
  taskId: string;
  name: string;
  refreshKey: number | null;
  variant: 'card' | 'row';
}) {
  const result = useTaskHistory(taskId, refreshKey);
  return (
    <div
      className={`ms-history-pop ms-history-pop-${variant}`}
      role="region"
      aria-label={`History of ${name}`}
    >
      {result.status === 'loading' && <p className="ms-muted">Loading…</p>}
      {result.status === 'failed' && (
        <p className="ms-error">Couldn&apos;t load the history.</p>
      )}
      {result.status === 'ready' && (
        <ol className="ms-history">
          {result.value.map((e) => (
            <li key={e.id} className="ms-history-item">
              <span className="ms-history-id">#{e.id}</span>
              <span className={`ms-state-${e.state}`}>{cap(e.state)}</span>
              <span className="ms-num ms-muted">{formatClock(e.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
