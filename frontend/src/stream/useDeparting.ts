import { useEffect, useRef, useState } from 'react';
import type { TaskDto } from '../api/types';

export const DEPART_MS = 1200;

/**
 * Ids of tasks that left `running` within the last `ms`. While an id is in
 * the set the desk keeps its window (flashing) before it moves to the archive.
 */
export function useDeparting(
  tasks: TaskDto[],
  ms = DEPART_MS,
): ReadonlySet<string> {
  const [prev, setPrev] = useState(tasks);
  const [departing, setDeparting] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Derive transitions during render (React's "previous props" pattern), so
  // an ended task never paints in the archive before it flashes on the desk.
  if (prev !== tasks) {
    const wasRunning = new Set(
      prev.filter((t) => t.state === 'running').map((t) => t.id),
    );
    const left = tasks.filter(
      (t) =>
        t.state !== 'running' && wasRunning.has(t.id) && !departing.has(t.id),
    );
    setPrev(tasks);
    if (left.length > 0) {
      setDeparting(new Set([...departing, ...left.map((t) => t.id)]));
    }
  }

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const map = timers.current;
    for (const id of departing) {
      if (map.has(id)) continue;
      map.set(
        id,
        setTimeout(() => {
          map.delete(id);
          setDeparting((cur) => {
            const next = new Set(cur);
            next.delete(id);
            return next;
          });
        }, ms),
      );
    }
  }, [departing, ms]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
      map.clear();
    };
  }, []);

  return departing;
}
