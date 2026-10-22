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
    let hadError = false;
    let resyncing = false;
    let buffered: TaskChange[] = [];

    const connect = () => {
      const after = lastIdRef.current;
      const es = new EventSource(
        '/api/tasks/stream' + (after !== null ? `?after=${after}` : ''),
      );
      source = es;
      es.addEventListener('task', (e) => {
        const change = JSON.parse((e as MessageEvent).data) as TaskChange;
        if (resyncing) buffered.push(change);
        else dispatch({ type: 'change', change });
      });
      es.onopen = () => {
        setStatus('open');
        if (!hadError) return;
        hadError = false;
        resyncing = true;
        buffered = [];
        listTasks().then(
          (list) => {
            if (disposed) return;
            resyncing = false;
            dispatch({ type: 'reset', list });
            for (const change of buffered) {
              if (
                list.lastEventId === null ||
                change.event.id > list.lastEventId
              ) {
                dispatch({ type: 'change', change });
              }
            }
            buffered = [];
            setError(null);
          },
          (err) => {
            if (disposed) return;
            resyncing = false;
            for (const change of buffered) dispatch({ type: 'change', change });
            buffered = [];
            setError(describe(err));
          },
        );
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
