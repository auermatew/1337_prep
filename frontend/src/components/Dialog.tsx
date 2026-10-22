import { useEffect, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { Window } from './Window';
import './Dialog.css';

// A native modal <dialog> framed as a design-system Window. Esc, focus
// trapping and focus return come from the browser.
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

  const onBackdrop = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) e.currentTarget.close();
  };

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click; Esc is native
    <dialog
      ref={ref}
      className={className ? `dlg ${className}` : 'dlg'}
      aria-label={title}
      onClose={onClose}
      onClick={onBackdrop}
    >
      <Window title={title} footer={footer}>
        {children}
      </Window>
    </dialog>
  );
}
