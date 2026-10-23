import type { ReactNode } from 'react';

export const CLOUDS_SRC = '/moonrise/clouds.webp';

// The divider under the hero: the clouds overlap the moon's lower edge, then
// a hard gradient from the clouds' underside down to black.
export function CloudFloor({ children }: { children?: ReactNode }) {
  return (
    <div className="ms-floor">
      <img
        className="ms-floor-clouds"
        src={CLOUDS_SRC}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
      <div className="ms-floor-content">{children}</div>
    </div>
  );
}
