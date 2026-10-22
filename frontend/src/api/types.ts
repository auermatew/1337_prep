export type TaskState = 'running' | 'finished' | 'cancelled';

export interface TaskDto {
  id: string;
  name: string;
  durationSeconds: number;
  state: TaskState;
  startedAt: string;
  endsAt: string;
  updatedAt: string;
}

export interface TaskEventDto {
  id: number;
  taskId: string;
  state: TaskState;
  at: string;
}

export interface TaskChange {
  event: TaskEventDto;
  task: TaskDto;
}

export interface TaskList {
  tasks: TaskDto[];
  lastEventId: number | null;
}
