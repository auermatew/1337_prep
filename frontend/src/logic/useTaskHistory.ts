import { useEffect, useState } from 'react';
import { taskEvents } from '../api/client';
import type { TaskEventDto } from '../api/types';
import type { Loadable } from './loadable';

// A task's event history, reloaded whenever `refreshKey` (its newest stream
// event id) changes, so an open history keeps up with the stream.
export function useTaskHistory(
  taskId: string,
  refreshKey: number | null,
  enabled = true,
): Loadable<TaskEventDto[]> {
  const [result, setResult] = useState<Loadable<TaskEventDto[]>>({
    status: 'loading',
  });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    taskEvents(taskId).then(
      (events) => {
        if (alive) setResult({ status: 'ready', value: events });
      },
      () => {
        if (alive) setResult({ status: 'failed' });
      },
    );
    return () => {
      alive = false;
    };
  }, [taskId, refreshKey, enabled]);

  return result;
}
