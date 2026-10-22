import type { ReactNode } from 'react';
import './Window.css';

export function Window({
  title,
  footer,
  className,
  children,
}: {
  title: string;
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={className ? `win ${className}` : 'win'}>
      <header className="win-bar">
        <span className="win-menu" aria-hidden="true" />
        <span className="win-box" aria-hidden="true" />
        <span className="win-stripe" aria-hidden="true" />
        <h3 className="win-title" title={title}>
          {title}
        </h3>
        <span className="win-stripe" aria-hidden="true" />
      </header>
      <div className="win-body">{children}</div>
      {footer !== undefined && <footer className="win-foot">{footer}</footer>}
    </section>
  );
}
