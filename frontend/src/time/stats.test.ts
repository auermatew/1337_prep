import { describe, expect, it } from 'vitest';
import type { TaskDto } from '../api/types';
import { archiveStats } from './stats';

function task(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: 't1',
    name: 'task',
    durationSeconds: 10,
    state: 'finished',
    startedAt: '2026-10-22T10:00:00.000Z',
    endsAt: '2026-10-22T10:00:10.000Z',
    updatedAt: '2026-10-22T10:00:10.000Z',
    ...overrides,
  };
}

describe('archiveStats', () => {
  it('counts finished and cancelled tasks and ignores running ones', () => {
    const stats = archiveStats([
      task(),
      task(),
      task({ state: 'cancelled' }),
      task({ state: 'running', updatedAt: '2026-10-22T10:05:00.000Z' }),
    ]);
    expect(stats.finished).toBe(2);
    expect(stats.cancelled).toBe(1);
    expect(stats.spentMs).toBe(30_000);
  });

  it('sums actual time from start to the final transition', () => {
    const stats = archiveStats([
      task(),
      task({ state: 'cancelled', updatedAt: '2026-10-22T10:00:04.000Z' }),
    ]);
    expect(stats.spentMs).toBe(14_000);
  });

  it('counts a task that ended before it started as zero', () => {
    const stats = archiveStats([
      task({ updatedAt: '2026-10-22T09:59:59.000Z' }),
    ]);
    expect(stats.spentMs).toBe(0);
  });
});
