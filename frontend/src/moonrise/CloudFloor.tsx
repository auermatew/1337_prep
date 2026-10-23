import type { ReactNode } from 'react';

export const CLOUDS_SRC = '/moonrise/clouds.webp';

// The divider under the hero: the clouds overlap the moon's lower edge, then
// a hard gradient from the clouds' underside down to black. The cloud bank
// stops growing at twice the screen's height; on wider screens a mirrored
// copy on each side carries it to the edges (a mirror meets the original
// seamlessly, edge column against itself).
export function CloudFloor({ children }: { children?: ReactNode }) {
  return (
    <div className="ms-floor">
      <div className="ms-floor-clouds" aria-hidden="true">
        <div className="ms-bank">
          <i className="ms-bank-side ms-bank-left" />
          <img
            src={CLOUDS_SRC}
            alt=""
            draggable={false}
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
          <i className="ms-bank-side ms-bank-right" />
        </div>
      </div>
      <div className="ms-floor-content">{children}</div>
    </div>
  );
}
