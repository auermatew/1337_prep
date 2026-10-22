import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskChange, TaskDto, TaskList } from '../api/types';
import { FakeEventSource } from '../test/fakeEventSource';
import { RESYNC_HOLD_LIMIT, useTaskStream } from './useTaskStream';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  listTasks: vi.fn(),
}));
import { listTasks } from '../api/client';

const mockList = vi.mocked(listTasks);

function task(id: string, over: Partial<TaskDto> = {}): TaskDto {
  return {
    id,
    name: `task ${id}`,
    durationSeconds: 10,
    state: 'running',
    startedAt: '2026-01-01T00:00:00.000Z',
    endsAt: '2026-01-01T00:00:10.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function change(eventId: number, t: TaskDto): TaskChange {
  return {
    event: { id: eventId, taskId: t.id, state: t.state, at: t.updatedAt },
    task: t,
  };
}

const list = (tasks: TaskDto[], lastEventId: number | null): TaskList => ({
  tasks,
  lastEventId,
});

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const es = (i = 0) => FakeEventSource.instances[i];

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.reset();
  vi.stubGlobal('EventSource', FakeEventSource);
  mockList.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useTaskStream', () => {
  it('resumes after the list lastEventId', async () => {
    mockList.mockResolvedValue(list([], 7));
    renderHook(() => useTaskStream());
    await flush();
    expect(es().url).toBe('/api/tasks/stream?after=7');
  });

  it('opens with after=0 when there are no events', async () => {
    mockList.mockResolvedValue(list([], null));
    renderHook(() => useTaskStream());
    await flush();
    expect(es().url).toBe('/api/tasks/stream?after=0');
  });

  it('tracks status', async () => {
    mockList.mockResolvedValue(list([], null));
    const { result } = renderHook(() => useTaskStream());
    expect(result.current.status).toBe('connecting');
    await flush();
    expect(result.current.status).toBe('connecting');
    act(() => es().open());
    expect(result.current.status).toBe('open');
    act(() => es().fail());
    expect(result.current.status).toBe('reconnecting');
  });

  it('resyncs with a fresh list after an error then open', async () => {
    mockList.mockResolvedValueOnce(list([task('a')], 9));
    mockList.mockResolvedValueOnce(list([task('b')], 2));
    const { result } = renderHook(() => useTaskStream());
    await flush();
    act(() => es().open());
    act(() => es().fail());
    act(() => es().open());
    await flush();
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(result.current.tasks.map((t) => t.id)).toEqual(['b']);
    expect(result.current.lastEventId).toBe(2);
    act(() => es().emit(change(3, task('b', { state: 'finished' }))));
    expect(result.current.tasks[0].state).toBe('finished');
    expect(result.current.lastEventId).toBe(3);
  });

  it('keeps events received while the resync fetch is pending', async () => {
    mockList.mockResolvedValueOnce(list([task('a')], 4));
    let resolve!: (l: TaskList) => void;
    mockList.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useTaskStream());
    await flush();
    act(() => es().open());
    act(() => es().fail());
    act(() => es().open());
    act(() => es().emit(change(5, task('a', { state: 'finished' }))));
    await act(async () => resolve(list([task('a')], 4)));
    expect(result.current.tasks[0].state).toBe('finished');
    expect(result.current.lastEventId).toBe(5);
  });

  it('applies low-id events received during a database-reset resync', async () => {
    mockList.mockResolvedValueOnce(list([task('a')], 59));
    let resolve!: (l: TaskList) => void;
    mockList.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useTaskStream());
    await flush();
    act(() => es().open());
    act(() => es().fail());
    act(() => es().open());
    act(() => es().emit(change(3, task('b', { state: 'finished' }))));
    await act(async () => resolve(list([task('b')], 2)));
    expect(result.current.tasks.map((t) => t.state)).toEqual(['finished']);
    expect(result.current.lastEventId).toBe(3);
  });

  it('logs a replayed event the resync list already covers', async () => {
    mockList.mockResolvedValueOnce(list([task('a')], 4));
    let resolve!: (l: TaskList) => void;
    mockList.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useTaskStream());
    await flush();
    act(() => es().open());
    act(() => es().fail());
    act(() => es().open());
    act(() => es().emit(change(5, task('a', { state: 'finished' }))));
    await act(async () => resolve(list([task('a', { state: 'finished' })], 5)));
    expect(result.current.log.map((l) => l.id)).toEqual([5]);
    expect(result.current.lastEventId).toBe(5);
    expect(result.current.tasks[0].state).toBe('finished');
  });

  it('logs a replayed event that arrives after the resync list', async () => {
    mockList.mockResolvedValueOnce(list([task('a')], 4));
    mockList.mockResolvedValueOnce(list([task('a', { state: 'finished' })], 5));
    const { result } = renderHook(() => useTaskStream());
    await flush();
    act(() => es().open());
    act(() => es().fail());
    act(() => es().open());
    await flush();
    act(() => es().emit(change(5, task('a', { state: 'finished' }))));
    act(() => es().emit(change(5, task('a', { state: 'finished' }))));
    expect(result.current.log.map((l) => l.id)).toEqual([5]);
    expect(result.current.lastEventId).toBe(5);
  });

  it('ignores a stale resync that resolves while a newer one is pending', async () => {
    mockList.mockResolvedValueOnce(list([task('a')], 4));
    let resolveA!: (l: TaskList) => void;
    let resolveB!: (l: TaskList) => void;
    mockList.mockReturnValueOnce(new Promise((r) => (resolveA = r)));
    mockList.mockReturnValueOnce(new Promise((r) => (resolveB = r)));
    const { result } = renderHook(() => useTaskStream());
    await flush();
    act(() => es().open());
    act(() => es().fail());
    act(() => es().open());
    act(() => es().fail());
    act(() => es().open());
    await act(async () => resolveA(list([task('a')], 4)));
    act(() => es().emit(change(5, task('a', { state: 'finished' }))));
    expect(result.current.lastEventId).toBe(4);
    await act(async () => resolveB(list([task('a')], 4)));
    expect(result.current.tasks[0].state).toBe('finished');
    expect(result.current.lastEventId).toBe(5);
    expect(result.current.log.map((l) => l.id)).toEqual([5]);
  });

  it('retries a failed resync every 2s', async () => {
    mockList.mockResolvedValueOnce(list([task('a')], 4));
    mockList.mockRejectedValueOnce(new Error('boom'));
    mockList.mockRejectedValueOnce(new Error('boom'));
    mockList.mockResolvedValueOnce(list([task('a', { state: 'finished' })], 5));
    const { result } = renderHook(() => useTaskStream());
    await flush();
    act(() => es().open());
    act(() => es().fail());
    act(() => es().open());
    await flush();
    expect(result.current.error).toBe('Could not reach the server');
    expect(mockList).toHaveBeenCalledTimes(2);
    await advance(1999);
    expect(mockList).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(mockList).toHaveBeenCalledTimes(3);
    expect(result.current.error).toBe('Could not reach the server');
    await advance(2000);
    expect(mockList).toHaveBeenCalledTimes(4);
    expect(result.current.error).toBeNull();
    expect(result.current.tasks[0].state).toBe('finished');
    expect(result.current.lastEventId).toBe(5);
  });

  it('applies held events when a resync attempt fails', async () => {
    mockList.mockResolvedValueOnce(list([task('a')], 4));
    let reject!: (e: Error) => void;
    mockList.mockReturnValueOnce(new Promise((_, r) => (reject = r)));
    const { result } = renderHook(() => useTaskStream());
    await flush();
    act(() => es().open());
    act(() => es().fail());
    act(() => es().open());
    act(() => es().emit(change(5, task('a', { state: 'finished' }))));
    expect(result.current.lastEventId).toBe(4);
    await act(async () => reject(new Error('boom')));
    expect(result.current.tasks[0].state).toBe('finished');
    expect(result.current.lastEventId).toBe(5);
    expect(result.current.log.at(-1)?.id).toBe(5);
    expect(result.current.error).toBe('Could not reach the server');
  });

  it('applies events directly between failed resync attempts', async () => {
    mockList.mockResolvedValueOnce(list([task('a')], 4));
    mockList.mockRejectedValueOnce(new Error('boom'));
    mockList.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useTaskStream());
    await flush();
    act(() => es().open());
    act(() => es().fail());
    act(() => es().open());
    await flush();
    expect(result.current.error).toBe('Could not reach the server');
    act(() => es().emit(change(6, task('a', { state: 'finished' }))));
    expect(result.current.tasks[0].state).toBe('finished');
    expect(result.current.lastEventId).toBe(6);
    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it('holds again during the retry and replays on success', async () => {
    mockList.mockResolvedValueOnce(list([task('a')], 4));
    mockList.mockRejectedValueOnce(new Error('boom'));
    let resolve!: (l: TaskList) => void;
    mockList.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useTaskStream());
    await flush();
    act(() => es().open());
    act(() => es().fail());
    act(() => es().open());
    await flush();
    act(() => es().emit(change(6, task('a'))));
    expect(result.current.lastEventId).toBe(6);
    await advance(2000);
    expect(mockList).toHaveBeenCalledTimes(3);
    act(() => es().emit(change(7, task('a', { state: 'finished' }))));
    expect(result.current.lastEventId).toBe(6);
    expect(result.current.tasks[0].state).toBe('running');
    await act(async () => resolve(list([task('a')], 6)));
    expect(result.current.tasks[0].state).toBe('finished');
    expect(result.current.lastEventId).toBe(7);
    expect(result.current.log.map((l) => l.id)).toEqual([6, 7]);
    expect(result.current.error).toBeNull();
  });

  it('abandons an attempt that holds RESYNC_HOLD_LIMIT events', async () => {
    mockList.mockResolvedValueOnce(list([task('a')], 4));
    let resolve!: (l: TaskList) => void;
    mockList.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    mockList.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useTaskStream());
    await flush();
    act(() => es().open());
    act(() => es().fail());
    act(() => es().open());
    const last = 4 + RESYNC_HOLD_LIMIT;
    act(() => {
      for (let id = 5; id <= last; id++) es().emit(change(id, task('a')));
    });
    expect(result.current.lastEventId).toBe(last);
    expect(result.current.log.at(-1)?.id).toBe(last);
    const before = result.current;
    await act(async () =>
      resolve(list([task('a', { state: 'cancelled' })], 4)),
    );
    expect(result.current.lastEventId).toBe(last);
    expect(result.current.tasks).toBe(before.tasks);
    expect(result.current.log).toBe(before.log);
    expect(mockList).toHaveBeenCalledTimes(2);
    await advance(2000);
    expect(mockList).toHaveBeenCalledTimes(3);
  });

  it('stops retrying a failed resync once a newer one supersedes it', async () => {
    mockList.mockResolvedValueOnce(list([task('a')], 4));
    mockList.mockRejectedValueOnce(new Error('boom'));
    mockList.mockResolvedValue(list([task('a')], 4));
    renderHook(() => useTaskStream());
    await flush();
    act(() => es().open());
    act(() => es().fail());
    act(() => es().open());
    await flush();
    act(() => es().fail());
    act(() => es().open());
    await flush();
    expect(mockList).toHaveBeenCalledTimes(3);
    await advance(5000);
    expect(mockList).toHaveBeenCalledTimes(3);
  });

  it('recreates a closed source after 2s using the current lastEventId', async () => {
    mockList.mockResolvedValue(list([task('a')], 4));
    renderHook(() => useTaskStream());
    await flush();
    const first = es();
    act(() => first.open());
    act(() => first.emit(change(5, task('a', { state: 'finished' }))));
    act(() => first.fail(true));
    expect(FakeEventSource.instances).toHaveLength(1);
    await advance(2000);
    expect(first.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(es(1).url).toBe('/api/tasks/stream?after=5');
  });

  it('sorts newest startedAt first', async () => {
    mockList.mockResolvedValue(
      list(
        [
          task('old', { startedAt: '2026-01-01T00:00:00.000Z' }),
          task('new', { startedAt: '2026-01-01T00:05:00.000Z' }),
          task('mid', { startedAt: '2026-01-01T00:02:00.000Z' }),
        ],
        1,
      ),
    );
    const { result } = renderHook(() => useTaskStream());
    await flush();
    expect(result.current.tasks.map((t) => t.id)).toEqual([
      'new',
      'mid',
      'old',
    ]);
  });

  it('exposes upsert', async () => {
    mockList.mockResolvedValue(list([], null));
    const { result } = renderHook(() => useTaskStream());
    await flush();
    act(() => result.current.upsert(task('x')));
    expect(result.current.tasks.map((t) => t.id)).toEqual(['x']);
  });

  it('closes on unmount and stops reconnecting', async () => {
    mockList.mockResolvedValue(list([], null));
    const { unmount } = renderHook(() => useTaskStream());
    await flush();
    const first = es();
    act(() => first.fail(true));
    unmount();
    expect(first.closed).toBe(true);
    await advance(5000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('retries the first list on failure', async () => {
    mockList.mockRejectedValueOnce(new Error('boom'));
    mockList.mockResolvedValueOnce(list([], null));
    const { result } = renderHook(() => useTaskStream());
    await flush();
    expect(result.current.error).toBe('Could not reach the server');
    expect(result.current.status).toBe('connecting');
    expect(FakeEventSource.instances).toHaveLength(0);
    await advance(2000);
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });
});
