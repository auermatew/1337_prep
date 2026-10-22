import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskDto, TaskState } from '../api/types';
import { useDeparting } from './useDeparting';

const task = (id: string, state: TaskState): TaskDto => ({
  id,
  name: id,
  durationSeconds: 10,
  state,
  startedAt: '2026-01-01T00:00:00.000Z',
  endsAt: '2026-01-01T00:00:10.000Z',
  updatedAt: '2026-01-01T00:00:10.000Z',
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDeparting', () => {
  it('holds a task that left running for 1.2 s', () => {
    const { result, rerender } = renderHook(
      ({ tasks }) => useDeparting(tasks),
      {
        initialProps: { tasks: [task('a', 'running')] },
      },
    );
    expect(result.current.size).toBe(0);

    rerender({ tasks: [task('a', 'finished')] });
    expect(result.current.has('a')).toBe(true);

    act(() => vi.advanceTimersByTime(1199));
    expect(result.current.has('a')).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.has('a')).toBe(false);
  });

  it('ignores tasks first seen already ended', () => {
    const { result, rerender } = renderHook(
      ({ tasks }) => useDeparting(tasks),
      {
        initialProps: { tasks: [] as TaskDto[] },
      },
    );
    rerender({ tasks: [task('b', 'cancelled')] });
    expect(result.current.size).toBe(0);
  });
});
