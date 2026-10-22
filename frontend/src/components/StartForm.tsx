import { useState, type FormEvent } from 'react';
import { ApiError, createTask } from '../api/client';
import type { TaskDto } from '../api/types';
import { formatDuration } from '../time/format';
import './StartForm.css';

const NAME_MAX = 100;
const SECONDS_MAX = 86400;

// Only worth a hint once there is at least a minute in it; past the
// 24-hour limit it just says no.
function secondsHint(seconds: string): string | null {
  const trimmed = seconds.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (n > SECONDS_MAX) return 'HELL NAW';
  if (n === 1337) return '= LEET';
  if (n < 60) return null;
  return `= ${formatDuration(n)}`;
}

function validate(name: string, seconds: string): string[] {
  const errors: string[] = [];
  if (name.length === 0) errors.push('NAME IS REQUIRED');
  else if (name.length > NAME_MAX)
    errors.push('NAME IS 100 CHARACTERS AT MOST');
  const n = Number(seconds);
  if (!/^\d+$/.test(seconds.trim()) || n < 1 || n > SECONDS_MAX) {
    errors.push('SECONDS MUST BE A WHOLE NUMBER FROM 1 TO 86400');
  }
  return errors;
}

export function StartForm({
  onCreated,
}: {
  onCreated: (task: TaskDto) => void;
}) {
  const [name, setName] = useState('');
  const [seconds, setSeconds] = useState('180');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [secondsFocused, setSecondsFocused] = useState(false);
  const hint = secondsHint(seconds);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const trimmed = name.trim();
    const problems = validate(trimmed, seconds);
    setErrors(problems);
    if (problems.length > 0) return;
    setSubmitting(true);
    try {
      const task = await createTask({
        name: trimmed,
        durationSeconds: Number(seconds),
      });
      setName('');
      onCreated(task);
    } catch (err) {
      setErrors(
        err instanceof ApiError
          ? err.messages.map((m) => m.toUpperCase())
          : ['COULD NOT REACH THE SERVER'],
      );
    } finally {
      setSubmitting(false);
    }
  };

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
