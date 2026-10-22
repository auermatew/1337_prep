import { useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import './SideTabs.css';
import './Transcripts.css';

const TRANSCRIPTS = [
  { title: '1337 design system', file: '1337-design-system.md', bytes: 14250 },
  { title: 'Backend planning', file: 'backend-planning.md', bytes: 15191 },
  { title: 'Backend build session', file: 'backend-build.md', bytes: 84326 },
];

type Transcript = (typeof TRANSCRIPTS)[number];
type Text = { file: string; text: string } | { file: string; failed: true };

const href = (t: Transcript) => `/transcripts/${t.file}`;

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
  const [loaded, setLoaded] = useState<Text | null>(null);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    fetch(href(selected))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(
        (text) => alive && setLoaded({ file: selected.file, text }),
        () => alive && setLoaded({ file: selected.file, failed: true }),
      );
    return () => {
      alive = false;
    };
  }, [selected]);

  // Only show text that belongs to the transcript currently open.
  const current = loaded && loaded.file === selected?.file ? loaded : null;
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
                onClick={() => {
                  setLoaded(null);
                  setSelected(t);
                }}
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
        {current === null ? (
          <p className="hist-note">LOADING…</p>
        ) : 'failed' in current ? (
          <p className="err-line">COULD NOT LOAD TRANSCRIPT</p>
        ) : (
          <pre className="tr-text">{current.text}</pre>
        )}
      </Dialog>
    </>
  );
}
