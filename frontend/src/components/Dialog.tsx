import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Window } from './Window';
import './Dialog.css';

// A native modal <dialog> framed as a design-system Window. Esc, focus
// trapping and focus return come from the browser. No backdrop-click close:
// a text-selection drag that ends outside the Window would close it.
//
// close() hides a dialog instantly, so closing first sets data-closing and
// waits for the Window's exit animation, if its stylesheet swaps one in.
// Esc is routed through onClose so it takes the same path.
const EXIT_FALLBACK_MS = 600;
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
  const cancelExit = useRef<(() => void) | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      cancelExit.current?.();
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (!dialog.open || dialog.hasAttribute('data-closing')) return;

    // An exit animation exists only if data-closing swaps the Window's
    // animation; the entry animation alone must not hold the dialog open.
    const win = dialog.querySelector<HTMLElement>('.win');
    const animation = () => (win ? getComputedStyle(win).animationName : '');
    const before = animation();
    dialog.setAttribute('data-closing', '');
    const name = animation();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      clearTimeout(timer);
      win?.removeEventListener('animationend', onEnd);
      dialog.removeAttribute('data-closing');
      cancelExit.current = null;
    };
    const finish = () => {
      stop();
      dialog.close();
    };
    function onEnd(e: AnimationEvent) {
      if (e.target === win) finish();
    }
    if (!win || !name || name === 'none' || name === before) {
      finish();
      return;
    }
    win.addEventListener('animationend', onEnd);
    timer = setTimeout(finish, EXIT_FALLBACK_MS);
    cancelExit.current = stop;
  }, [open]);

  useEffect(() => () => cancelExit.current?.(), []);

  return (
    <dialog
      ref={ref}
      className={className ? `dlg ${className}` : 'dlg'}
      aria-label={title}
      onClose={onClose}
      onKeyDown={(e) => {
        // Taking Esc here, before it becomes a cancel, matters: Chrome lets a
        // page cancel only one Esc per user activation, so a second Esc (say
        // preview, then drawer) would otherwise close instantly.
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <Window title={title} footer={footer}>
        {children}
      </Window>
    </dialog>
  );
}
