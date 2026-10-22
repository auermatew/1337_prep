import type { TaskChange, TaskDto, TaskList, TaskState } from '../api/types';

export interface LogLine {
  id: number;
  taskId: string;
  name: string;
  state: TaskState;
  at: string;
}

export type StreamState = {
  tasks: Map<string, TaskDto>;
  lastEventId: number | null;
  log: LogLine[];
};

export type StreamAction =
  | { type: 'reset'; list: TaskList }
  | { type: 'change'; change: TaskChange }
  | { type: 'upsert'; task: TaskDto };

export const LOG_LIMIT = 50;

export const initialState: StreamState = {
  tasks: new Map(),
  lastEventId: null,
  log: [],
};

export function reducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case 'reset':
      return {
        ...state,
        tasks: new Map(action.list.tasks.map((t) => [t.id, t])),
        lastEventId: action.list.lastEventId,
      };
    case 'change': {
      const { event, task } = action.change;
      if (state.lastEventId !== null && event.id <= state.lastEventId) {
        return state;
      }
      const tasks = new Map(state.tasks);
      tasks.set(task.id, task);
      const line: LogLine = {
        id: event.id,
        taskId: task.id,
        name: task.name,
        state: event.state,
        at: event.at,
      };
      return {
        tasks,
        lastEventId: event.id,
        log: [...state.log, line].slice(-LOG_LIMIT),
      };
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
