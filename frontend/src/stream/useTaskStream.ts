import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { ApiError, listTasks } from '../api/client';
import type { TaskChange, TaskDto } from '../api/types';
import { initialState, reducer, type LogLine } from './reducer';

export type StreamStatus = 'connecting' | 'open' | 'reconnecting';
export type { LogLine };

const RETRY_MS = 2000;
/** A resync attempt holding this many stream events is abandoned. */
export const RESYNC_HOLD_LIMIT = 500;

function describe(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Could not reach the server';
}

export function useTaskStream(): {
  tasks: TaskDto[];
  status: StreamStatus;
  lastEventId: number | null;
  log: LogLine[];
  upsert: (task: TaskDto) => void;
  error: string | null;
} {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const lastIdRef = useRef<number | null>(null);

  useEffect(() => {
    lastIdRef.current = state.lastEventId;
  }, [state.lastEventId]);

  useEffect(() => {
    let disposed = false;
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let resyncTimer: ReturnType<typeof setTimeout> | null = null;
    let hadError = false;
    let resyncing = false;
    // Bumped by each resync attempt; a resolve or reject from an older one is
    // ignored.
    let resyncGen = 0;
    let buffered: TaskChange[] = [];

    // Stop holding: apply the held events (the reducer's dedup decides).
    const release = () => {
      resyncing = false;
      for (const change of buffered) dispatch({ type: 'change', change });
      buffered = [];
    };

    const retry = (gen: number) => {
      resyncTimer = setTimeout(() => resync(gen), RETRY_MS);
    };

    // Reload the list after a reconnect. Each attempt holds stream events
    // until it lands, then replays them on top: the reducer applies what is
    // newer than the list and logs what has not been logged yet. A failed
    // attempt applies what it held and retries after RETRY_MS; events between
    // attempts go straight to the reducer. An attempt that holds
    // RESYNC_HOLD_LIMIT events is abandoned the same way, under a new gen.
    // An attempt started by a newer onopen inherits what the superseded one
    // held, so `buffered` may be non-empty at its start; the cap still bounds
    // it. Trade-off: after a database reset, events applied outside a
    // successful attempt (released by a failed or abandoned attempt, or
    // applied between attempts) are judged against the old, higher
    // lastEventId and dropped until a list reload succeeds.
    const resync = (gen: number) => {
      resyncing = true;
      listTasks().then(
        (list) => {
          if (disposed || gen !== resyncGen) return;
          dispatch({ type: 'reset', list });
          release();
          setError(null);
        },
        (err) => {
          if (disposed || gen !== resyncGen) return;
          setError(describe(err));
          release();
          retry(gen);
        },
      );
    };

    const connect = () => {
      const es = new EventSource(
        `/api/tasks/stream?after=${lastIdRef.current ?? 0}`,
      );
      source = es;
      es.addEventListener('task', (e) => {
        const change = JSON.parse((e as MessageEvent).data) as TaskChange;
        if (!resyncing) {
          dispatch({ type: 'change', change });
          return;
        }
        buffered.push(change);
        if (buffered.length >= RESYNC_HOLD_LIMIT) {
          release();
          retry(++resyncGen);
        }
      });
      es.onopen = () => {
        setStatus('open');
        if (!hadError) return;
        hadError = false;
        if (resyncTimer) clearTimeout(resyncTimer);
        resync(++resyncGen);
      };
      es.onerror = () => {
        hadError = true;
        setStatus('reconnecting');
        if (es.readyState === EventSource.CLOSED) {
          es.close();
          timer = setTimeout(connect, RETRY_MS);
        }
      };
    };

    const start = () => {
      listTasks().then(
        (list) => {
          if (disposed) return;
          dispatch({ type: 'reset', list });
          setError(null);
          lastIdRef.current = list.lastEventId;
          connect();
        },
        (err) => {
          if (disposed) return;
          setError(describe(err));
          timer = setTimeout(start, RETRY_MS);
        },
      );
    };

    start();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      if (resyncTimer) clearTimeout(resyncTimer);
      source?.close();
    };
  }, []);

  const tasks = useMemo(
    () =>
      [...state.tasks.values()].sort(
        (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt),
      ),
    [state.tasks],
  );
  const upsert = useCallback(
    (task: TaskDto) => dispatch({ type: 'upsert', task }),
    [],
  );

  return {
    tasks,
    status,
    lastEventId: state.lastEventId,
    log: state.log,
    upsert,
    error,
  };
}
