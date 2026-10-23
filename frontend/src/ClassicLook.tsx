import { Archive } from './components/Archive';
import { LeetWord } from './components/LeetWord';
import { LiveLog, StreamLabel } from './components/LiveLog';
import { Notebook } from './components/Notebook';
import { StartForm } from './components/StartForm';
import { TimerWindow } from './components/TimerWindow';
import { Transcripts } from './components/Transcripts';
import type { DeskProps } from './look/types';
import './App.css';

// The classic 1337 desk.
export function ClassicLook({
  onDesk,
  ended,
  log,
  status,
  lastEventId,
  error,
  upsert,
  newestEventIds,
  now,
}: DeskProps) {
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
