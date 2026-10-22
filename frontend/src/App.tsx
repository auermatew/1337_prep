import { useMemo } from 'react';
import { Archive } from './components/Archive';
import { LeetWord } from './components/LeetWord';
import { LiveLog, StreamLabel } from './components/LiveLog';
import { Notebook } from './components/Notebook';
import { StartForm } from './components/StartForm';
import { TimerWindow } from './components/TimerWindow';
import { Transcripts } from './components/Transcripts';
import { useDeparting } from './stream/useDeparting';
import { useTaskStream } from './stream/useTaskStream';
import { useNow } from './time/useNow';
import './App.css';

export default function App() {
  const { tasks, status, lastEventId, log, upsert, error } = useTaskStream();
  const now = useNow();
  const departing = useDeparting(tasks);

  const newestEventIds = useMemo(() => {
    const ids = new Map<string, number>();
    for (const line of log) {
      ids.set(line.taskId, Math.max(ids.get(line.taskId) ?? 0, line.id));
    }
    return ids;
  }, [log]);

  const onDesk = useMemo(
    () => tasks.filter((t) => t.state === 'running' || departing.has(t.id)),
    [tasks, departing],
  );
  const ended = useMemo(
    () => tasks.filter((t) => t.state !== 'running' && !departing.has(t.id)),
    [tasks, departing],
  );

  return (
    <div className="wrap">
      <header className="top">
        <span className="wordmark">1337 · TIMERS</span>
        <div className="top-end">
          <a
            className="link-btn top-gh"
            href="https://github.com/auermatew/1337_prep"
            target="_blank"
            rel="noopener noreferrer"
          >
            GITHUB ↗
          </a>
          <StreamLabel status={status} />
        </div>
      </header>
      {error && (
        <p className="err-line top-error" role="alert">
          {error.toUpperCase()}
        </p>
      )}

      <main>
        <section className="opener">
          <p className="tag">TIMERS</p>
          <h1 className="headline">
            Start a <LeetWord />
            <em>.</em>
          </h1>
          <p className="lead">
            Every timer is shared with everyone watching. Start one, watch it
            count down, cancel it if you change your mind.
          </p>
        </section>

        <StartForm onCreated={upsert} />

        <div className="desk">
          <div className="desk-grid">
            {onDesk.length === 0 ? (
              <div className="slot">NO TIMERS RUNNING</div>
            ) : (
              onDesk.map((t) => (
                <TimerWindow
                  key={t.id}
                  task={t}
                  now={now}
                  onChanged={upsert}
                  newestEventId={newestEventIds.get(t.id) ?? null}
                />
              ))
            )}
          </div>
          <aside className="desk-log">
            <LiveLog log={log} status={status} lastEventId={lastEventId} />
          </aside>
        </div>

        <Archive tasks={ended} newestEventIds={newestEventIds} />
      </main>

      <div className="side-tabs">
        <Transcripts />
        <Notebook />
      </div>
    </div>
  );
}
