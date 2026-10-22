import { describe, expect, it } from 'vitest';
import type { TaskChange, TaskDto } from '../api/types';
import { reducer, initialState } from './reducer';

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

describe('reducer', () => {
  it('reset fills the map and last event id', () => {
    const s = reducer(initialState, {
      type: 'reset',
      list: { tasks: [task('a'), task('b')], lastEventId: 4 },
    });
    expect(s.tasks.size).toBe(2);
    expect(s.lastEventId).toBe(4);
  });

  it('reset keeps the log', () => {
    let s = reducer(initialState, {
      type: 'reset',
      list: { tasks: [task('a')], lastEventId: 4 },
    });
    s = reducer(s, { type: 'change', change: change(5, task('a')) });
    s = reducer(s, { type: 'reset', list: { tasks: [], lastEventId: 1 } });
    expect(s.log).toHaveLength(1);
    expect(s.lastEventId).toBe(1);
  });

  it('applies a newer change and logs it', () => {
    let s = reducer(initialState, {
      type: 'reset',
      list: { tasks: [task('a')], lastEventId: 4 },
    });
    s = reducer(s, {
      type: 'change',
      change: change(5, task('a', { state: 'finished' })),
    });
    expect(s.tasks.get('a')?.state).toBe('finished');
    expect(s.lastEventId).toBe(5);
    expect(s.log).toEqual([
      {
        id: 5,
        taskId: 'a',
        name: 'task a',
        state: 'finished',
        at: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('ignores a duplicate event id', () => {
    let s = reducer(initialState, {
      type: 'reset',
      list: { tasks: [task('a')], lastEventId: 4 },
    });
    s = reducer(s, { type: 'change', change: change(5, task('a')) });
    expect(
      reducer(s, {
        type: 'change',
        change: change(5, task('a', { state: 'cancelled' })),
      }),
    ).toBe(s);
  });

  it('ignores an older event id', () => {
    const s = reducer(initialState, {
      type: 'reset',
      list: { tasks: [task('a')], lastEventId: 4 },
    });
    expect(reducer(s, { type: 'change', change: change(3, task('a')) })).toBe(
      s,
    );
  });

  it('adds unknown tasks', () => {
    const s = reducer(initialState, {
      type: 'change',
      change: change(1, task('new')),
    });
    expect(s.tasks.has('new')).toBe(true);
  });

  it('trims the log to the last 50', () => {
    let s = initialState;
    for (let i = 1; i <= 60; i++) {
      s = reducer(s, { type: 'change', change: change(i, task('a')) });
    }
    expect(s.log).toHaveLength(50);
    expect(s.log[49].id).toBe(60);
    expect(s.log[0].id).toBe(11);
  });

  it('upsert ignores older rows and applies newer ones, leaving ids and log', () => {
    let s = reducer(initialState, {
      type: 'reset',
      list: {
        tasks: [task('a', { updatedAt: '2026-01-01T00:00:05.000Z' })],
        lastEventId: 4,
      },
    });
    const older = reducer(s, {
      type: 'upsert',
      task: task('a', {
        state: 'cancelled',
        updatedAt: '2026-01-01T00:00:01.000Z',
      }),
    });
    expect(older.tasks.get('a')?.state).toBe('running');
    s = reducer(s, {
      type: 'upsert',
      task: task('a', {
        state: 'cancelled',
        updatedAt: '2026-01-01T00:00:09.000Z',
      }),
    });
    expect(s.tasks.get('a')?.state).toBe('cancelled');
    expect(s.lastEventId).toBe(4);
    expect(s.log).toHaveLength(0);
  });

  it('upsert adds an unknown task', () => {
    const s = reducer(initialState, { type: 'upsert', task: task('z') });
    expect(s.tasks.has('z')).toBe(true);
  });
});
