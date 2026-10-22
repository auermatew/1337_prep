import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Window } from './Window';
import './Dialog.css';

// A native modal <dialog> framed as a design-system Window. Esc, focus
// trapping and focus return come from the browser. No backdrop-click close:
// a text-selection drag that ends outside the Window would close it.
export function Dialog({
  title,
  open,
  onClose,
  footer,
  className,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={className ? `dlg ${className}` : 'dlg'}
      aria-label={title}
      onClose={onClose}
    >
      <Window title={title} footer={footer}>
        {children}
      </Window>
    </dialog>
  );
}
