import { useState } from 'react';
import { Dialog } from './Dialog';
import './SideTabs.css';
import './Notebook.css';

// A side tab that opens the handwritten planning notes as a two-page spread.
export function Notebook() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button type="button" className="side-tab" onClick={() => setOpen(true)}>
        NOTES
      </button>
      <Dialog
        title="notebook/"
        className="dlg-notebook"
        open={open}
        onClose={close}
        footer={
          <>
            <span>HANDWRITTEN · 2026-10-22</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={close}
            >
              CLOSE
            </button>
          </>
        }
      >
        <div className="nb-paper">
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
        </div>
      </Dialog>
    </>
  );
}
