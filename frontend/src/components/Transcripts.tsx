import { useEffect, useState } from 'react';
import { Dialog } from './Dialog';
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

  return (
    <section className="transcripts">
      <p className="tag">03 · TRANSCRIPTS</p>
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
      <Dialog
        title={selected?.file ?? ''}
        open={selected !== null}
        onClose={() => setSelected(null)}
        footer={
          selected && (
            <>
              <Download t={selected} />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelected(null)}
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
    </section>
  );
}
