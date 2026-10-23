import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

// A modal sheet on strong glass: a native <dialog> (focus trap, top layer)
// that exists only while open. Esc closes it unless escCloses is false (the
// notebook closes only from its Close button).
export function Sheet(props: {
  title: string;
  open: boolean;
  onClose: () => void;
  escCloses?: boolean;
  className?: string;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return props.open ? <OpenSheet {...props} /> : null;
}

function OpenSheet({
  title,
  onClose,
  escCloses = true,
  className,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  escCloses?: boolean;
  className?: string;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="ms-dialog"
      aria-label={title}
      onKeyDown={(e) => {
        // Taken at keydown, before it becomes a cancel: Chrome lets a page
        // cancel only one Esc per user activation.
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        if (escCloses) onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (escCloses) onClose();
      }}
    >
      <section
        className={
          className
            ? `ms-panel ms-panel-strong ms-sheet ${className}`
            : 'ms-panel ms-panel-strong ms-sheet'
        }
      >
        <header className="ms-sheet-head">
          <h2 className="ms-title">{title}</h2>
        </header>
        <div className="ms-sheet-body">{children}</div>
        {footer && <footer className="ms-sheet-foot">{footer}</footer>}
      </section>
    </dialog>
  );
}
