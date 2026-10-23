import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TaskDto } from '../api/types';
import { secondsEgg, validateStart } from './problems';
import { useStartTask } from './useStartTask';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  createTask: vi.fn(),
}));
import { ApiError, createTask } from '../api/client';

const mockCreate = vi.mocked(createTask);

const created: TaskDto = {
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

describe('validateStart', () => {
  it('requires a name', () => {
    expect(validateStart('', '180')).toEqual([{ kind: 'name-required' }]);
  });

  it('caps the name and checks the seconds together', () => {
    expect(validateStart('x'.repeat(101), '0')).toEqual([
      { kind: 'name-too-long' },
      { kind: 'seconds-invalid' },
    ]);
  });

  it('rejects fractions and anything over a day', () => {
    expect(validateStart('tea', '1.5')).toEqual([{ kind: 'seconds-invalid' }]);
    expect(validateStart('tea', '86401')).toEqual([
      { kind: 'seconds-invalid' },
    ]);
    expect(validateStart('tea', '86400')).toEqual([]);
  });
});

describe('secondsEgg', () => {
  it('finds the two easter eggs', () => {
    expect(secondsEgg(1337)).toBe('leet');
    expect(secondsEgg(86401)).toBe('hell-naw');
    expect(secondsEgg(180)).toBeNull();
    expect(secondsEgg(null)).toBeNull();
  });
});

describe('useStartTask', () => {
  it('submits a trimmed name, clears it and reports the task', async () => {
    mockCreate.mockResolvedValue(created);
    const onCreated = vi.fn();
    const { result } = renderHook(() => useStartTask(onCreated));
    act(() => result.current.setName('  tea '));
    await act(() => result.current.submit());
    expect(mockCreate).toHaveBeenCalledWith({
      name: 'tea',
      durationSeconds: 180,
    });
    expect(result.current.name).toBe('');
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it('keeps every server message', async () => {
    mockCreate.mockRejectedValue(new ApiError(400, ['a', 'b']));
    const { result } = renderHook(() => useStartTask(vi.fn()));
    act(() => result.current.setName('tea'));
    await act(() => result.current.submit());
    expect(result.current.problems).toEqual([
      { kind: 'server', messages: ['a', 'b'] },
    ]);
  });

  it('reports an unreachable server', async () => {
    mockCreate.mockRejectedValue(new TypeError('fetch failed'));
    const { result } = renderHook(() => useStartTask(vi.fn()));
    act(() => result.current.setName('tea'));
    await act(() => result.current.submit());
    expect(result.current.problems).toEqual([{ kind: 'unreachable' }]);
  });

  it('ignores a second submit while one is pending', async () => {
    mockCreate.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useStartTask(vi.fn()));
    act(() => result.current.setName('tea'));
    act(() => void result.current.submit());
    act(() => void result.current.submit());
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.current.submitting).toBe(true);
  });

  it('parses the seconds for hints', () => {
    const { result } = renderHook(() => useStartTask(vi.fn()));
    expect(result.current.secondsValue).toBe(180);
    act(() => result.current.setSeconds('abc'));
    expect(result.current.secondsValue).toBeNull();
  });
});
