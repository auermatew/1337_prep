import { useState } from 'react';
import type { DeskProps } from '../look/types';
import { SegmentClock } from './clock/SegmentClock';
import { CloudFloor } from './CloudFloor';
import { Footer } from './Footer';
import { LiveFeed } from './LiveFeed';
import { LiveIndicator } from './LiveIndicator';
import { Scene } from './Scene';
import './moonrise.generated.css';
import './moonrise.css';

type SheetName = 'transcripts' | 'notebook' | null;

// The Moonrise night: hero, timers on the cloud floor, archive, footer.
// Loaded lazily by App, so none of it downloads for the classic look.
export default function MoonriseLook({
  onDesk,
  log,
  status,
  lastEventId,
  error,
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
            <div className="ms-desk">
              {onDesk.length === 0 ? (
                <p className="display-s ms-empty">Nothing running</p>
              ) : (
                <div className="ms-cards ms-scroll ms-scroll-fade ms-desk-cards" />
              )}
              <div className="ms-desk-feed">
                <LiveFeed log={log} lastEventId={lastEventId} />
                <LiveIndicator status={status} large />
              </div>
            </div>
          </section>
        </CloudFloor>
        <Footer
          onTranscripts={() => setSheet('transcripts')}
          onNotebook={() => setSheet('notebook')}
        />
      </div>
    </div>
  );
}
