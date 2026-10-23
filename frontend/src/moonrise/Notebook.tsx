import { useEffect, useState } from 'react';
import { DrawLayer } from '../components/DrawLayer';
import { reducedMotion } from './clock/motion';
import { Sheet } from './Sheet';

export const COVER_SRC = '/moonrise/cover.webp';
export const PAPER_SRC = '/moonrise/paper.webp';
const INK = '#ff2a1f';
/** The closed cover is held this long so its text can be read. */
const HOLD_MS = 1800;
/** The cover's turn; drawing starts once the spread lies open. */
const TURN_MS = 1100;
/** Close: the cover swings shut, rests, then the sheet goes. */
const SHUT_MS = 2300;

// One page's width: the spread fits the viewport, phones included.
function pageWidth(): number {
  return Math.max(
    150,
    Math.min(
      400,
      Math.floor((window.innerWidth - 120) / 2),
      Math.floor((window.innerHeight - 260) / 1.5),
    ),
  );
}

// The handwritten notebook: closed on its cover, then the cover swings open
// on the spine into a two-page spread you can draw on in red, across both
// pages. Once open it stays open: only Close closes it.
export function MoonNotebook({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [bookOpen, setBookOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [inking, setInking] = useState(false);
  // A new key remounts the draw layer, which wipes it.
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(pageWidth);

  // Every opening starts on the closed cover with a blank page.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setBookOpen(false);
      setClosing(false);
      setInking(false);
      setPage((n) => n + 1);
      setWidth(pageWidth());
    }
  }

  useEffect(() => {
    if (!open || bookOpen || closing) return;
    const t = setTimeout(
      () => setBookOpen(true),
      reducedMotion() ? 0 : HOLD_MS,
    );
    return () => clearTimeout(t);
  }, [open, bookOpen, closing]);

  useEffect(() => {
    if (!bookOpen) return;
    const t = setTimeout(() => setInking(true), reducedMotion() ? 0 : TURN_MS);
    return () => clearTimeout(t);
  }, [bookOpen]);

  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(onClose, reducedMotion() ? 0 : SHUT_MS);
    return () => clearTimeout(t);
  }, [closing, onClose]);

  const close = () => {
    if (closing) return;
    setBookOpen(false);
    setInking(false);
    setClosing(true);
  };

  return (
    <Sheet
      title="Notebook"
      open={open}
      onClose={close}
      escCloses={false}
      className="ms-sheet-notebook"
      footer={
        <>
          <span>Handwritten · 22 Oct 2026</span>
          <span className="ms-sheet-actions">
            <button
              type="button"
              className="ms-btn ms-btn-text"
              onClick={() => setPage((n) => n + 1)}
            >
              Clear
            </button>
            <button
              type="button"
              className="ms-btn ms-btn-glass ms-btn-small"
              onClick={close}
            >
              Close
            </button>
          </span>
        </>
      }
    >
      <div
        className={bookOpen ? 'ms-notebook ms-notebook-open' : 'ms-notebook'}
        style={{ '--nb-w': `${width}px` } as React.CSSProperties}
      >
        <div className="ms-nb-book">
          <div className="ms-nb-page ms-nb-right">
            <img
              className="ms-nb-paper"
              src={PAPER_SRC}
              alt=""
              draggable={false}
            />
            <span className="ms-nb-spine ms-nb-spine-l" aria-hidden="true" />
            <img
              className="ms-nb-ink"
              src="/notes-2.png"
              alt="Handwritten notes, page 2"
              draggable={false}
            />
          </div>
          <button
            type="button"
            className="ms-nb-leaf"
            onClick={() => setBookOpen(true)}
            aria-expanded={bookOpen}
            aria-label={bookOpen ? 'Notebook, open' : 'Open the notebook'}
            tabIndex={bookOpen ? -1 : 0}
          >
            <span className="ms-nb-face ms-nb-front">
              <img src={COVER_SRC} alt="" draggable={false} />
            </span>
            <span className="ms-nb-face ms-nb-back">
              <img
                className="ms-nb-paper ms-nb-mirror"
                src={PAPER_SRC}
                alt=""
                draggable={false}
              />
              <span className="ms-nb-spine ms-nb-spine-r" aria-hidden="true" />
              <img
                className="ms-nb-ink ms-nb-ink-left"
                src="/notes-1.webp"
                alt="Handwritten notes, page 1"
                draggable={false}
              />
            </span>
          </button>
        </div>
        <div
          className={inking ? 'ms-nb-drawzone ms-nb-inking' : 'ms-nb-drawzone'}
        >
          <DrawLayer key={page} ink={INK} />
        </div>
      </div>
    </Sheet>
  );
}
