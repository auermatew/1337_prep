import { useState } from 'react';
import {
  TRANSCRIPTS,
  transcriptHref as href,
  type Transcript,
} from '../logic/transcripts';
import { useTranscript } from '../logic/useTranscript';
import { Dialog } from './Dialog';
import './SideTabs.css';
import './Transcripts.css';

function Download({ t }: { t: Transcript }) {
  return (
    <a className="link-btn" href={href(t)} download={t.file}>
      DOWNLOAD ↓
    </a>
  );
}

export function Transcripts() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Transcript | null>(null);
  const current = useTranscript(selected);
  const closePreview = () => setSelected(null);
  const closeDrawer = () => {
    setSelected(null);
    setDrawerOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="side-tab"
        onClick={() => setDrawerOpen(true)}
      >
        TRANSCRIPTS
      </button>
      <Dialog
        title="transcripts/"
        className="dlg-drawer"
        open={drawerOpen}
        onClose={closeDrawer}
        footer={
          <>
            <span>{TRANSCRIPTS.length} FILES</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={closeDrawer}
            >
              CLOSE
            </button>
          </>
        }
      >
        <p className="tr-note">
          heads up: these aren&apos;t all my sessions, and not every prompt I
          sent is in here either. exporting everything got a bit much lol. happy
          to show you the rest in person though :)
        </p>
        <ul className="tr-list">
          {TRANSCRIPTS.map((t) => (
            <li key={t.file} className="tr-row">
              <span className="tr-title">{t.title}</span>
              <span className="tr-size">{Math.round(t.bytes / 1024)} KB</span>
              <button
                type="button"
                className="link-btn"
                onClick={() => setSelected(t)}
              >
                PREVIEW
              </button>
              <Download t={t} />
            </li>
          ))}
        </ul>
      </Dialog>
      <Dialog
        title={selected?.file ?? ''}
        open={selected !== null}
        onClose={closePreview}
        footer={
          selected && (
            <>
              <Download t={selected} />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closePreview}
              >
                CLOSE
              </button>
            </>
          )
        }
      >
        {current === null || current.status === 'loading' ? (
          <p className="hist-note">LOADING…</p>
        ) : current.status === 'failed' ? (
          <p className="err-line">COULD NOT LOAD TRANSCRIPT</p>
        ) : (
          <pre className="tr-text">{current.value}</pre>
        )}
      </Dialog>
    </>
  );
}
