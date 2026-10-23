import { useTaskHistory } from '../logic/useTaskHistory';
import { formatClock } from '../time/format';
import './History.css';

export function History({
  taskId,
  refreshKey,
}: {
  taskId: string;
  refreshKey: number | null;
}) {
  const result = useTaskHistory(taskId, refreshKey);

  if (result.status === 'loading') {
    return <p className="hist-note">LOADING…</p>;
  }
  if (result.status === 'failed') {
    return <p className="hist-note err-line">COULD NOT LOAD HISTORY</p>;
  }
  return (
    <ol className="hist">
      {result.value.map((e) => (
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
