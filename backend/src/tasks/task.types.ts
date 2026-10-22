import type { Task, TaskEvent } from '../generated/prisma/client.js';

export type TaskStateName = 'running' | 'finished' | 'cancelled';

export interface TaskDto {
  id: string;
  name: string;
  durationSeconds: number;
  state: TaskStateName;
  startedAt: string;
  endsAt: string;
  updatedAt: string;
}

export interface TaskEventDto {
  id: number;
  taskId: string;
  state: TaskStateName;
  at: string;
}

export interface TaskChange {
  event: TaskEventDto;
  task: TaskDto;
}

export const TASK_EVENTS_CHANNEL = 'task_events';

export function toTaskDto(task: Task): TaskDto {
  return {
    id: task.id,
    name: task.name,
    durationSeconds: task.durationSeconds,
    state: task.state,
    startedAt: task.startedAt.toISOString(),
    endsAt: task.endsAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function toEventDto(event: TaskEvent): TaskEventDto {
  return {
    id: Number(event.id),
    taskId: event.taskId,
    state: event.state,
    at: event.at.toISOString(),
  };
}
