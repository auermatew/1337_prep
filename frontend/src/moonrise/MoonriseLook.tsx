import { useState } from 'react';
import type { DeskProps } from '../look/types';
import { SegmentClock } from './clock/SegmentClock';
import { MoonArchive } from './Archive';
import { CloudFloor } from './CloudFloor';
import { Footer } from './Footer';
import { LiveFeed } from './LiveFeed';
import { LiveIndicator } from './LiveIndicator';
import { Scene } from './Scene';
import { MoonStartForm } from './StartForm';
import { TimerCard } from './TimerCard';
import './moonrise.generated.css';
import './moonrise.css';

type SheetName = 'transcripts' | 'notebook' | null;

// The Moonrise night: hero, timers on the cloud floor, archive, footer.
// Loaded lazily by App, so none of it downloads for the classic look.
// Above this many timers the card countdowns drop their SVG bloom.
const GLOW_LIMIT = 20;

export default function MoonriseLook({
  onDesk,
  ended,
  departing,
  log,
  status,
  lastEventId,
  error,
  upsert,
  newestEventIds,
  now,
}: DeskProps) {
  const [, setSheet] = useState<SheetName>(null);

  return (
    <div className="moonrise">
      <div className="ms-page ms-noise">
        <Scene word="TIMER">
          <SegmentClock
            value="1337"
            fluid
            opticalCenter
            flicker
            pulseKey={lastEventId}
          />
        </Scene>
        <CloudFloor>
          <section className="ms-wrap ms-sec-desk" aria-label="Timers">
            {error && (
              <p className="ms-page-error" role="alert">
                {error}
              </p>
            )}
            <MoonStartForm onCreated={upsert} />
            <div className="ms-desk">
              {onDesk.length === 0 ? (
                <p className="display-s ms-empty">Nothing running</p>
              ) : (
                <div className="ms-cards ms-scroll ms-scroll-fade ms-desk-cards">
                  {onDesk.map((t) => (
                    <TimerCard
                      key={t.id}
                      task={t}
                      now={now}
                      departing={departing.has(t.id)}
                      onChanged={upsert}
                      newestEventId={newestEventIds.get(t.id) ?? null}
                      glow={onDesk.length <= GLOW_LIMIT}
                    />
                  ))}
                </div>
              )}
              <div className="ms-desk-feed">
                <LiveFeed log={log} lastEventId={lastEventId} />
                <LiveIndicator status={status} large />
              </div>
            </div>
          </section>
        </CloudFloor>
        <MoonArchive ended={ended} newestEventIds={newestEventIds} />
        <Footer
          onTranscripts={() => setSheet('transcripts')}
          onNotebook={() => setSheet('notebook')}
        />
      </div>
    </div>
  );
}
