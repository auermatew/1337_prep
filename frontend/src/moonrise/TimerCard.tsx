import { useState } from 'react';
import type { TaskDto } from '../api/types';
import { useCancelTask } from '../logic/useCancelTask';
import { formatClock, formatCountdown, remainingMs } from '../time/format';
import { SegmentClock } from './clock/SegmentClock';
import { problemText } from './copy';
import { HistoryPopover } from './HistoryPopover';
import { MoonPhase } from './MoonPhase';

// One timer on liquid glass: name, moon-phase progress, the seven-segment
// countdown, its state, end time, History and Cancel. Red lives only in the
// digits and the state word. Only the server marks it finished.
export function TimerCard({
  task,
  now,
  departing,
  onChanged,
  newestEventId,
  glow,
}: {
  task: TaskDto;
  now: number;
  /** Ended and about to move to the archive: play the exit. */
  departing: boolean;
  onChanged: (task: TaskDto) => void;
  newestEventId: number | null;
  /** The countdown's bloom; off when many timers run. */
  glow: boolean;
}) {
  const { cancel, cancelling, locked, problem } = useCancelTask(
    task,
    onChanged,
  );
  const [showHistory, setShowHistory] = useState(false);

  const running = task.state === 'running';
  const at = running ? now : Date.parse(task.updatedAt);
  const remaining = task.state === 'finished' ? 0 : remainingMs(task, at);
  const duration = task.durationSeconds * 1000;
  const progress =
    task.state === 'finished' || duration <= 0
      ? 1
      : (at - Date.parse(task.startedAt)) / duration;

  const stateWord = !running
    ? task.state === 'finished'
      ? 'Finished'
      : 'Cancelled'
    : cancelling
      ? 'Cancelling…'
      : remaining === 0
        ? 'Finishing…'
        : 'Running';
  const text = formatCountdown(remaining);

  const className = [
    'ms-panel',
    'ms-panel-liquid',
    'ms-timer',
    `ms-timer-${running ? 'running' : task.state}`,
    departing && !running ? `ms-exit-${task.state}` : 'ms-enter',
  ].join(' ');

  return (
    <article className={className} aria-label={`${task.name}, ${stateWord}`}>
      <header className="ms-timer-head">
        <div className="ms-timer-title">
          <h3 className="ms-timer-name">{task.name}</h3>
          <span className="ms-id" title={task.id}>
            {task.id.slice(0, 8)}
          </span>
        </div>
        <MoonPhase progress={progress} />
      </header>
      <div className="ms-timer-time">
        <SegmentClock
          value={text}
          height={52}
          blinkColon={false}
          urgent={running && remaining <= 10000}
          dim={!running}
          glow={glow}
          label={`${text} left`}
        />
        <p
          className={`ms-timer-state ms-state-${running ? 'running' : task.state}`}
        >
          {stateWord}
        </p>
      </div>
      {problem && (
        <p className="ms-error" role="alert">
          {problemText(problem)}
        </p>
      )}
      {showHistory && (
        <HistoryPopover
          taskId={task.id}
          name={task.name}
          refreshKey={newestEventId}
          variant="card"
        />
      )}
      <footer className="ms-timer-foot">
        <span className="ms-muted">
          Ends <span className="ms-num">{formatClock(task.endsAt)}</span>
        </span>
        <span className="ms-timer-actions">
          <button
            type="button"
            className="ms-btn ms-btn-text"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? 'Hide history' : 'History'}
          </button>
          {running && (
            <button
              type="button"
              className="ms-btn ms-btn-text ms-btn-cancel"
              disabled={cancelling || locked}
              onClick={() => void cancel()}
            >
              Cancel
            </button>
          )}
        </span>
      </footer>
    </article>
  );
}
