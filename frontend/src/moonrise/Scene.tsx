import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { starField } from './clock/stars';

export const MOON_SRC = '/moonrise/moon.webp';

// The hero: black sky with a steel glow on the horizon, stars, the moon
// photograph rising from the bottom edge, the 1337 display above it, and a
// giant word that rises between moon and clouds as the hero scrolls away.
export function Scene({
  word,
  children,
}: {
  word?: string;
  children?: ReactNode;
}) {
  const stars = useMemo(() => starField(), []);
  // Mounted by a look switch (data-arriving, set by useLookSwitch): the moon
  // rises the last stretch into place as the curtain fades.
  const [arriving] = useState(() =>
    document.documentElement.hasAttribute('data-arriving'),
  );
  return (
    <section
      className="ms-scene ms-scene-full"
      aria-label="1337"
      style={{ '--ms-horizon': '68' } as React.CSSProperties}
    >
      <div className="ms-scene-glow" aria-hidden="true" />
      <div className="ms-stars" aria-hidden="true">
        {stars.map((st, i) => (
          <i key={i} style={st} />
        ))}
      </div>
      <div
        className={
          arriving ? 'ms-scene-moonlayer ms-moon-arrive' : 'ms-scene-moonlayer'
        }
        aria-hidden="true"
      >
        <img
          className="ms-scene-moon"
          src={MOON_SRC}
          alt=""
          draggable={false}
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
        <div className="ms-scene-rimshade" />
        <div className="ms-scene-rimshade ms-scene-rimshade-k" />
      </div>
      {word && (
        <div className="ms-scene-word">
          <span>{word}</span>
        </div>
      )}
      <div className="ms-scene-content">{children}</div>
    </section>
  );
}
