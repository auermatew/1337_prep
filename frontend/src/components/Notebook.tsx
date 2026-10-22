import { useState } from 'react';
import { Dialog } from './Dialog';
import { DrawLayer } from './DrawLayer';
import './SideTabs.css';
import './Notebook.css';

type Mode = 'pen' | 'scroll';

// Phones start in scroll mode so a finger can still reach page 2.
const initialMode = (): Mode =>
  window.matchMedia?.('(max-width: 599px)').matches ? 'scroll' : 'pen';

// A side tab that opens the handwritten planning notes as a two-page spread
// you can draw on. The drawing is a scratch pad: it is gone once closed.
export function Notebook() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(initialMode);
  // A new key remounts the draw layer, which wipes it.
  const [page, setPage] = useState(0);
  const close = () => setOpen(false);
  const wipe = () => setPage((n) => n + 1);

  return (
    <>
      <button
        type="button"
        className="side-tab"
        onClick={() => {
          wipe();
          setOpen(true);
        }}
      >
        NOTES
      </button>
      <Dialog
        title="notebook/"
        className="dlg-notebook"
        open={open}
        onClose={close}
        footer={
          <>
            <span className="nb-meta">HANDWRITTEN · 2026-10-22</span>
            <span className="nb-tools">
              <span className="nb-mode">
                {(['pen', 'scroll'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </span>
              <button type="button" className="link-btn" onClick={wipe}>
                CLEAR
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={close}
              >
                CLOSE
              </button>
            </span>
          </>
        }
      >
        <div className="nb-paper" data-mode={mode}>
          <img
            className="nb-page"
            src="/notes-1.webp"
            alt="Notes, page 1"
            width={1052}
            height={1494}
            loading="lazy"
          />
          <img
            className="nb-page"
            src="/notes-2.png"
            alt="Notes, page 2"
            width={1055}
            height={1491}
            loading="lazy"
          />
          <DrawLayer key={page} />
        </div>
      </Dialog>
    </>
  );
}
