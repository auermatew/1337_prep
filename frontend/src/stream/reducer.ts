import type { TaskChange, TaskDto, TaskList, TaskState } from '../api/types';

export interface LogLine {
  /** Unique per line, even when a database reset reuses event ids. */
  seq: number;
  id: number;
  taskId: string;
  name: string;
  state: TaskState;
  at: string;
}

export type StreamState = {
  tasks: Map<string, TaskDto>;
  /** Highest event id applied to `tasks` (a reset sets it from the list). */
  lastEventId: number | null;
  /**
   * Highest event id printed to the log. It trails `lastEventId` after a
   * resync, so the replayed batch the list already covers still prints.
   */
  loggedEventId: number | null;
  log: LogLine[];
  seq: number;
};

export type StreamAction =
  | { type: 'reset'; list: TaskList }
  | { type: 'change'; change: TaskChange }
  | { type: 'upsert'; task: TaskDto };

export const LOG_LIMIT = 50;

export const initialState: StreamState = {
  tasks: new Map(),
  lastEventId: null,
  loggedEventId: null,
  log: [],
  seq: 0,
};

const after = (id: number, last: number | null) => last === null || id > last;

export function reducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case 'reset': {
      const listId = action.list.lastEventId;
      // Keep the logged mark behind the list, except on the first load (no
      // history to print) and when ids went backwards (a database reset).
      const loggedEventId =
        state.loggedEventId === null ||
        listId === null ||
        listId < state.loggedEventId
          ? listId
          : state.loggedEventId;
      return {
        ...state,
        tasks: new Map(action.list.tasks.map((t) => [t.id, t])),
        lastEventId: listId,
        loggedEventId,
      };
    }
    case 'change': {
      const { event, task } = action.change;
      const apply = after(event.id, state.lastEventId);
      const print = after(event.id, state.loggedEventId);
      if (!apply && !print) return state;
      let next = state;
      if (apply) {
        const tasks = new Map(state.tasks);
        tasks.set(task.id, task);
        next = { ...next, tasks, lastEventId: event.id };
      }
      if (print) {
        const seq = state.seq + 1;
        const line: LogLine = {
          seq,
          id: event.id,
          taskId: task.id,
          name: task.name,
          state: event.state,
          at: event.at,
        };
        next = {
          ...next,
          seq,
          loggedEventId: event.id,
          log: [...state.log, line].slice(-LOG_LIMIT),
        };
      }
      return next;
    }
    case 'upsert': {
      const existing = state.tasks.get(action.task.id);
      if (
        existing &&
        Date.parse(action.task.updatedAt) < Date.parse(existing.updatedAt)
      ) {
        return state;
      }
      const tasks = new Map(state.tasks);
      tasks.set(action.task.id, action.task);
      return { ...state, tasks };
    }
  }
}
