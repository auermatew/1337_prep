import { useCallback, useSyncExternalStore } from 'react';

type Listener = () => void;

const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;
let current = Date.now();

function tick(): void {
  current = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener, intervalMs: number): () => void {
  listeners.add(listener);
  if (timer === null) {
    current = Date.now();
    timer = setInterval(tick, intervalMs);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return current;
}

export function useNow(intervalMs = 250): number {
  const sub = useCallback(
    (listener: Listener) => subscribe(listener, intervalMs),
    [intervalMs],
  );
  return useSyncExternalStore(sub, getSnapshot);
}
