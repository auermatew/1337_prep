import { useState } from 'react';
import type { TaskDto } from '../api/types';
import { secondsEgg } from '../logic/problems';
import { useStartTask } from '../logic/useStartTask';
import { formatDuration } from '../time/format';
import { problemLines } from './classicCopy';
import './StartForm.css';

// Only worth a hint once there is at least a minute in it; past the
// 24-hour limit it just says no.
function secondsHint(n: number | null): string | null {
  const egg = secondsEgg(n);
  if (egg === 'hell-naw') return 'HELL NAW';
  if (egg === 'leet') return '= LEET';
  if (n === null || n < 60) return null;
  return `= ${formatDuration(n)}`;
}

export function StartForm({
  onCreated,
}: {
  onCreated: (task: TaskDto) => void;
}) {
  const {
    name,
    setName,
    seconds,
    setSeconds,
    secondsValue,
    submitting,
    problems,
    submit,
  } = useStartTask(onCreated);
  const [secondsFocused, setSecondsFocused] = useState(false);
  const hint = secondsHint(secondsValue);
  const errors = problems.flatMap(problemLines);

  return (
    <form className="start" onSubmit={submit} noValidate>
      <div className="start-row">
        <div className="start-field start-name">
          <label className="start-label" htmlFor="start-name">
            NAME
          </label>
          <input
            id="start-name"
            className="start-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            placeholder="tea"
          />
        </div>
        <div className="start-field start-seconds">
          <label className="start-label" htmlFor="start-seconds">
            SECONDS
          </label>
          <input
            id="start-seconds"
            className="start-input"
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
            onFocus={() => setSecondsFocused(true)}
            onBlur={() => setSecondsFocused(false)}
            inputMode="numeric"
            autoComplete="off"
            aria-describedby="start-seconds-hint"
          />
          <span
            id="start-seconds-hint"
            className={secondsFocused && hint ? 'start-hint on' : 'start-hint'}
          >
            {hint}
          </span>
        </div>
        <button type="submit" className="btn" disabled={submitting}>
          START TIMER →
        </button>
      </div>
      {errors.length > 0 && (
        <div className="start-errors" role="alert">
          {errors.map((m) => (
            <p key={m} className="err-line">
              {m}
            </p>
          ))}
        </div>
      )}
    </form>
  );
}
