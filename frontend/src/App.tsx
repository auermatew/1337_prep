import { useMemo } from 'react';
import { ClassicLook } from './ClassicLook';
import { useDeparting } from './stream/useDeparting';
import { useTaskStream } from './stream/useTaskStream';
import { useNow } from './time/useNow';

// Owns the stream for the page's whole life and hands its data to the look,
// so switching looks never reconnects or empties the feed.
export default function App() {
  const { tasks, status, lastEventId, log, upsert, error } = useTaskStream();
  const now = useNow();
  const departing = useDeparting(tasks);

  const newestEventIds = useMemo(() => {
    const ids = new Map<string, number>();
    for (const line of log) {
      ids.set(line.taskId, Math.max(ids.get(line.taskId) ?? 0, line.id));
    }
    return ids;
  }, [log]);

  const onDesk = useMemo(
    () => tasks.filter((t) => t.state === 'running' || departing.has(t.id)),
    [tasks, departing],
  );
  const ended = useMemo(
    () => tasks.filter((t) => t.state !== 'running' && !departing.has(t.id)),
    [tasks, departing],
  );

  const desk = {
    onDesk,
    ended,
    departing,
    log,
    status,
    lastEventId,
    error,
    upsert,
    newestEventIds,
    now,
  };

  return <ClassicLook {...desk} />;
}
