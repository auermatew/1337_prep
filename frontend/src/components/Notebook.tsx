import { useState } from 'react';
import { Dialog } from './Dialog';
import './SideTabs.css';
import './Notebook.css';

// A tab pinned to the right edge that opens the handwritten planning notes.
export function Notebook() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button type="button" className="side-tab" onClick={() => setOpen(true)}>
        NOTES
      </button>
      <Dialog
        title="notebook.webp"
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
        <img
          className="nb-img"
          src="/notebook.webp"
          alt="Handwritten planning notes"
          width={1052}
          height={1494}
          loading="lazy"
        />
      </Dialog>
    </>
  );
}
