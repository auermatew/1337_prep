import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TaskDto } from '../api/types';
import { useCancelTask } from './useCancelTask';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  cancelTask: vi.fn(),
}));
import { ApiError, cancelTask } from '../api/client';

const mockCancel = vi.mocked(cancelTask);

const task: TaskDto = {
  id: 't1',
  name: 'tea',
  durationSeconds: 180,
  state: 'running',
  startedAt: '2026-01-01T00:00:00.000Z',
  endsAt: '2026-01-01T00:03:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('useCancelTask', () => {
  it('sends one request for two cancels', () => {
    mockCancel.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useCancelTask(task, vi.fn()));
    act(() => {
      result.current.cancel();
      result.current.cancel();
    });
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(result.current.cancelling).toBe(true);
  });

  it('locks on a 409', async () => {
    mockCancel.mockRejectedValue(new ApiError(409, ['Task is not running']));
    const { result } = renderHook(() => useCancelTask(task, vi.fn()));
    await act(async () => result.current.cancel());
    expect(result.current.locked).toBe(true);
    expect(result.current.problem).toEqual({ kind: 'not-running' });
    expect(result.current.cancelling).toBe(false);
  });

  it('reports the updated task', async () => {
    const updated = { ...task, state: 'cancelled' as const };
    mockCancel.mockResolvedValue(updated);
    const onChanged = vi.fn();
    const { result } = renderHook(() => useCancelTask(task, onChanged));
    await act(async () => result.current.cancel());
    expect(onChanged).toHaveBeenCalledWith(updated);
    expect(result.current.problem).toBeNull();
  });
});
