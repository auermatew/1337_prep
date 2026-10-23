import { useState } from 'react';
import {
  TRANSCRIPTS,
  transcriptHref,
  type Transcript,
} from '../logic/transcripts';
import { useTranscript } from '../logic/useTranscript';
import { Sheet } from './Sheet';

const kb = (t: Transcript) => `${Math.round(t.bytes / 1024)} KB`;

function Download({ t }: { t: Transcript }) {
  return (
    <a className="ms-link" href={transcriptHref(t)} download={t.file}>
      Download ↓
    </a>
  );
}

// The transcripts list, then a preview of one on the console screen (the
// one place monospace is allowed). Closing the preview keeps the list.
export function MoonTranscripts({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Transcript | null>(null);
  const current = useTranscript(selected);
  const closeAll = () => {
    setSelected(null);
    onClose();
  };
  const closePreview = () => setSelected(null);

  return (
    <>
      <Sheet
        title="Transcripts"
        open={open}
        onClose={closeAll}
        className="ms-sheet-transcripts"
        footer={
          <>
            <span>{TRANSCRIPTS.length} files</span>
            <button
              type="button"
              className="ms-btn ms-btn-text"
              onClick={closeAll}
            >
              Close
            </button>
          </>
        }
      >
        <p className="ms-note">
          heads up: these aren&apos;t all my sessions, and not every prompt I
          sent is in here either. exporting everything got a bit much lol. happy
          to show you the rest in person though :)
        </p>
        <ul className="ms-files">
          {TRANSCRIPTS.map((t) => (
            <li key={t.file}>
              <span>{t.title}</span>
              <span className="ms-num ms-muted">{kb(t)}</span>
              <button
                type="button"
                className="ms-btn ms-btn-text"
                onClick={() => setSelected(t)}
              >
                Preview
              </button>
              <Download t={t} />
            </li>
          ))}
        </ul>
      </Sheet>
      <Sheet
        title={selected?.title ?? ''}
        open={open && selected !== null}
        onClose={closePreview}
        className="ms-sheet-preview"
        footer={
          selected && (
            <>
              <span className="ms-num">{kb(selected)}</span>
              <span className="ms-sheet-actions">
                <Download t={selected} />
                <button
                  type="button"
                  className="ms-btn ms-btn-text"
                  onClick={closePreview}
                >
                  Close
                </button>
              </span>
            </>
          )
        }
      >
        {selected && (
          <div className="ms-crt">
            <div className="ms-crt-head">
              <span>
                {current?.status === 'ready'
                  ? `${selected.file} · ${kb(selected)} · ${current.value.split('\n').length} lines`
                  : selected.file}
              </span>
            </div>
            {current?.status === 'ready' ? (
              <pre className="ms-crt-text">
                {current.value}
                <span className="ms-crt-cursor" aria-hidden="true" />
              </pre>
            ) : current?.status === 'failed' ? (
              <p className="ms-crt-text ms-crt-error" role="alert">
                Couldn&apos;t load this transcript.
              </p>
            ) : (
              <p className="ms-crt-text">Loading…</p>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
