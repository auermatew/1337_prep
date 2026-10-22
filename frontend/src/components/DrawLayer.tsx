import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

const INK = '#7941f2';
const LINE_WIDTH = 3;

// Points are stored as fractions of the canvas box, so strokes stay on the
// same spot of the page when the notebook is resized or reflows.
type Point = [x: number, y: number];

// A transparent canvas over the notebook paper. Mouse, touch and pen all
// arrive as pointer events. Strokes live only as long as this component:
// remount it (a new key) to wipe the page.
export function DrawLayer() {
  const ref = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const active = useRef<{ id: number; stroke: Point[] } | null>(null);
  const [count, setCount] = useState(0);

  const context = useCallback(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return null;
    const { width, height } = canvas.getBoundingClientRect();
    return { ctx, width, height };
  }, []);

  const segment = useCallback(
    (from: Point, to: Point) => {
      const c = context();
      if (!c) return;
      const { ctx, width, height } = c;
      ctx.beginPath();
      ctx.moveTo(from[0] * width, from[1] * height);
      ctx.lineTo(to[0] * width, to[1] * height);
      ctx.stroke();
    },
    [context],
  );

  // Size the backing store for the current box and device pixel ratio, then
  // repaint every stroke.
  const redraw = useCallback(() => {
    const canvas = ref.current;
    const c = context();
    if (!canvas || !c) return;
    const { ctx, width, height } = c;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = INK;
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokes.current) {
      stroke.forEach((p, i) => segment(stroke[i - 1] ?? p, p));
    }
  }, [context, segment]);

  useEffect(() => {
    const canvas = ref.current;
    redraw();
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  const point = (e: PointerEvent<HTMLCanvasElement>): Point => {
    const box = e.currentTarget.getBoundingClientRect();
    return [
      (e.clientX - box.left) / (box.width || 1),
      (e.clientY - box.top) / (box.height || 1),
    ];
  };

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    // Keep receiving moves if the pointer leaves the canvas mid-stroke.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = point(e);
    const stroke: Point[] = [p];
    active.current = { id: e.pointerId, stroke };
    strokes.current.push(stroke);
    setCount(strokes.current.length);
    segment(p, p);
  };

  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const a = active.current;
    if (!a || a.id !== e.pointerId) return;
    const p = point(e);
    segment(a.stroke[a.stroke.length - 1], p);
    a.stroke.push(p);
  };

  const onEnd = (e: PointerEvent<HTMLCanvasElement>) => {
    if (active.current?.id === e.pointerId) active.current = null;
  };

  return (
    <canvas
      ref={ref}
      className="nb-draw"
      aria-label="Drawing layer"
      data-strokes={count}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
    />
  );
}
