import type { TaskDto, TaskEventDto, TaskList } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];

  constructor(status: number, messages: string[]) {
    super(messages.join('; '));
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
  }
}

async function errorMessages(res: Response): Promise<string[]> {
  try {
    const body = (await res.json()) as { message?: unknown };
    if (Array.isArray(body.message)) return body.message.map(String);
    if (typeof body.message === 'string') return [body.message];
  } catch {
    // non-JSON body: fall through
  }
  return [`HTTP ${res.status}`];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new ApiError(res.status, await errorMessages(res));
  return (await res.json()) as T;
}

export function listTasks(): Promise<TaskList> {
  return request<TaskList>('/api/tasks');
}

export function createTask(input: {
  name: string;
  durationSeconds: number;
}): Promise<TaskDto> {
  return request<TaskDto>('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function cancelTask(id: string): Promise<TaskDto> {
  return request<TaskDto>(`/api/tasks/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
}

export function taskEvents(id: string): Promise<TaskEventDto[]> {
  return request<TaskEventDto[]>(`/api/tasks/${encodeURIComponent(id)}/events`);
}
