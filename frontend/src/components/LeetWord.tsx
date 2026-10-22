import { useCallback, useEffect, useRef, useState } from 'react';
import './LeetWord.css';

const CHANCE = 0.2;
const GLITCH_MS = 500;
// How close the cursor must come to the word, measured from its box.
const NEAR_PX = 250;
// Without hover (phones), roll on a timer instead.
const IDLE_ROLL_MS = 4000;

const hasHover = () => window.matchMedia?.('(hover: hover)').matches ?? true;

// Distance from a point to the nearest edge of a box (0 inside it).
function distance(box: DOMRect, x: number, y: number): number {
  const dx = Math.max(box.left - x, 0, x - box.right);
  const dy = Math.max(box.top - y, 0, y - box.bottom);
  return Math.hypot(dx, dy);
}

// The headline's purple "timer". With a mouse, each time the cursor comes
// within NEAR_PX of it there is a 1 in 5 chance it glitches into "1337" for
// half a second; on touch screens it rolls every few seconds on its own.
export function LeetWord({
  random = Math.random,
  canHover = hasHover(),
}: {
  random?: () => number;
  canHover?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [glitch, setGlitch] = useState(false);
  const glitching = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const roll = useCallback(() => {
    if (glitching.current || random() >= CHANCE) return;
    glitching.current = true;
    setGlitch(true);
    timer.current = setTimeout(() => {
      glitching.current = false;
      setGlitch(false);
    }, GLITCH_MS);
  }, [random]);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!canHover) {
      const id = setInterval(roll, IDLE_ROLL_MS);
      return () => clearInterval(id);
    }
    let near = false;
    const onMove = (e: PointerEvent) => {
      const el = ref.current;
      if (!el || e.pointerType !== 'mouse') return;
      const now =
        distance(el.getBoundingClientRect(), e.clientX, e.clientY) <= NEAR_PX;
      if (now && !near) roll();
      near = now;
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [canHover, roll]);

  return (
    <em
      ref={ref}
      className={glitch ? 'leet-word glitch' : 'leet-word'}
      data-ghost="timer"
      data-testid="leet-word"
    >
      <span>{glitch ? '1337' : 'timer'}</span>
    </em>
  );
}
