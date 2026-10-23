import { vi } from 'vitest';
import type { TaskDto, TaskState } from '../api/types';
import type { DeskProps } from '../look/types';

export function task(id: string, state: TaskState, minute = 0): TaskDto {
  const at = (m: number) => new Date(Date.UTC(2026, 0, 1, 0, m)).toISOString();
  return {
    id,
    name: `task ${id}`,
    durationSeconds: 60,
    state,
    startedAt: at(minute),
    endsAt: at(minute + 1),
    updatedAt: at(minute + 1),
  };
}

// Props for a look, as App derives them, with nothing on the desk.
export function deskProps(overrides: Partial<DeskProps> = {}): DeskProps {
  return {
    onDesk: [],
    ended: [],
    departing: new Set(),
    log: [],
    status: 'open',
    lastEventId: null,
    error: null,
    upsert: vi.fn(),
    newestEventIds: new Map(),
    now: Date.UTC(2026, 0, 1, 0, 0, 30),
    ...overrides,
  };
}
