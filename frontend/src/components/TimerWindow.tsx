import { useEffect, useRef, useState } from 'react';
import type { TaskDto } from '../api/types';
import { useCancelTask } from '../logic/useCancelTask';
import {
  formatClock,
  formatCountdown,
  progressStep,
  remainingMs,
} from '../time/format';
import { problemLines } from './classicCopy';
import { History } from './History';
import { TaskId } from './TaskId';
import { Window } from './Window';
import './TimerWindow.css';

const STEPS = 19;
const CELLS = Array.from({ length: STEPS }, (_, i) => i);

function StateLine({ task, remaining }: { task: TaskDto; remaining: number }) {
  if (task.state === 'finished') {
    return (
      <span className="tw-state">
        <span className="tw-mark">[x]</span> FINISHED
      </span>
    );
  }
  if (task.state === 'cancelled') {
    return <span className="tw-state tw-off">[ ] CANCELLED</span>;
  }
  return (
    <span className="tw-state tw-live">
      <span className="tw-dot" aria-hidden="true">
        ●
      </span>{' '}
      {remaining === 0 ? 'FINISHING…' : 'RUNNING'}
    </span>
  );
}

// Easter egg: a timer named 1337, or set to 1337 seconds, glows rainbow.
// Only here on the desk; the archive row stays plain.
const isLeet = (task: TaskDto) =>
  task.name === '1337' || task.durationSeconds === 1337;

export function TimerWindow({
  task,
  now,
  onChanged,
  newestEventId,
}: {
  task: TaskDto;
  now: number;
  onChanged: (task: TaskDto) => void;
  newestEventId: number | null;
}) {
  const { cancel, cancelling, locked, problem } = useCancelTask(
    task,
    onChanged,
  );
  const error = problem ? problemLines(problem) : [];
  const [showHistory, setShowHistory] = useState(false);
  const revealRef = useRef<HTMLDivElement>(null);

  // Scroll-reveal on mount: add `.in` on the next frame. The wrapper's
  // className prop never changes, so React never clobbers the class.
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      revealRef.current?.classList.add('in'),
    );
    return () => cancelAnimationFrame(frame);
  }, []);

  const running = task.state === 'running';
  const at = running ? now : Date.parse(task.updatedAt);
  const remaining = task.state === 'finished' ? 0 : remainingMs(task, at);
  const step = task.state === 'finished' ? STEPS : progressStep(task, at);

  const footer = (
    <>
      <span>ENDS {formatClock(task.endsAt)}</span>
      <span className="tw-actions">
        <button
          type="button"
          className="link-btn"
          aria-expanded={showHistory}
          onClick={() => setShowHistory((v) => !v)}
        >
          {showHistory ? 'HISTORY ↑' : 'HISTORY ↓'}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={!running || cancelling || locked}
          onClick={() => void cancel()}
        >
          CANCEL
        </button>
      </span>
    </>
  );

  return (
    <div className={isLeet(task) ? 'rv tw-egg' : 'rv'} ref={revealRef}>
      <Window
        title={`${task.name}.tmr`}
        footer={footer}
        className={[
          'tw',
          running ? '' : 'leet-flash',
          isLeet(task) ? 'tw-1337' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="tw-head">
          <StateLine task={task} remaining={remaining} />
          <TaskId id={task.id} />
        </div>
        {showHistory ? (
          <div className="tw-history">
            <History taskId={task.id} refreshKey={newestEventId} />
          </div>
        ) : (
          <>
            <div className="tw-count">{formatCountdown(remaining)}</div>
            <div
              className="tw-ld"
              role="progressbar"
              aria-label="Elapsed"
              aria-valuemin={0}
              aria-valuemax={STEPS}
              aria-valuenow={step}
            >
              {CELLS.map((i) => (
                <i key={i} className={i < step ? 'on' : undefined} />
              ))}
            </div>
          </>
        )}
        {error.length > 0 && (
          <div className="tw-errors" role="alert">
            {error.map((m) => (
              <p key={m} className="err-line">
                {m}
              </p>
            ))}
          </div>
        )}
      </Window>
    </div>
  );
}
