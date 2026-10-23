import type { TaskDto } from '../api/types';
import { secondsEgg } from '../logic/problems';
import { useStartTask } from '../logic/useStartTask';
import { humanize, problemText } from './copy';

function secondsHint(n: number | null): string {
  const egg = secondsEgg(n);
  if (egg === 'leet') return '= LEET';
  if (egg === 'hell-naw') return '= HELL NAW';
  const text = n === null ? '' : humanize(n);
  return text ? `= ${text}` : '';
}

// Name + seconds + start on one glass bar. The rules are the shared ones;
// the words are Moonrise's: one sentence under the bar.
export function MoonStartForm({
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
  const hint = secondsHint(secondsValue);

  return (
    <form className="ms-start" onSubmit={submit} noValidate>
      <div className="ms-start-bar">
        <div className="ms-field ms-start-name">
          <label className="ms-field-label" htmlFor="ms-start-name">
            Name
          </label>
          <span className="ms-field-row">
            <input
              id="ms-start-name"
              className="ms-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              placeholder="tea"
            />
          </span>
        </div>
        <div className="ms-field ms-start-secs">
          <label className="ms-field-label" htmlFor="ms-start-seconds">
            Seconds
          </label>
          <span className="ms-field-row">
            <input
              id="ms-start-seconds"
              className="ms-input"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              aria-describedby="ms-start-seconds-hint"
            />
            <span id="ms-start-seconds-hint" className="ms-field-hint">
              {hint}
            </span>
          </span>
        </div>
        <button
          type="submit"
          className="ms-btn ms-btn-primary ms-start-go"
          disabled={submitting}
        >
          {submitting ? 'Starting…' : 'Start timer →'}
        </button>
      </div>
      {problems.length > 0 && (
        <p className="ms-error" role="alert">
          {problemText(problems[0])}
        </p>
      )}
    </form>
  );
}
