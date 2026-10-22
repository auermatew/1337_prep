import { useEffect, useRef, useState } from 'react';
import './LeetWord.css';

const CHANCE = 0.25;
const GLITCH_MS = 500;

// The headline's purple "timer": hovering it (or tapping it on a phone,
// where pointerenter fires on touch) has a 1 in 4 chance of glitching into
// "1337" for half a second.
export function LeetWord({ random = Math.random }: { random?: () => number }) {
  const [glitch, setGlitch] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  const roll = () => {
    if (glitch || random() >= CHANCE) return;
    setGlitch(true);
    timer.current = setTimeout(() => setGlitch(false), GLITCH_MS);
  };

  return (
    <em
      className={glitch ? 'leet-word glitch' : 'leet-word'}
      data-ghost="timer"
      data-testid="leet-word"
      onPointerEnter={roll}
    >
      <span>{glitch ? '1337' : 'timer'}</span>
    </em>
  );
}
