import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskDto, TaskState } from './api/types';
import App from './App';

vi.mock('./stream/useTaskStream', () => ({ useTaskStream: vi.fn() }));
import { useTaskStream } from './stream/useTaskStream';

const mockStream = vi.mocked(useTaskStream);

function task(id: string, state: TaskState, minute = 0): TaskDto {
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

function withTasks(tasks: TaskDto[]) {
  mockStream.mockReturnValue({
    tasks,
    status: 'open',
    lastEventId: 7,
    log: [],
    upsert: vi.fn(),
    error: null,
  });
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const archiveRows = () =>
  screen.queryAllByRole('row').filter((r) => r.closest('tbody'));

describe('App', () => {
  it('splits running windows from the archive by state', () => {
    withTasks([
      task('a', 'running', 4),
      task('b', 'running', 3),
      task('c', 'finished', 2),
      task('d', 'cancelled', 1),
    ]);
    render(<App />);
    expect(screen.getAllByText(/\.tmr$/)).toHaveLength(2);
    expect(screen.getByText('02 · ARCHIVE')).toBeTruthy();
    expect(archiveRows()).toHaveLength(2);
  });

  it('hides the archive when nothing has ended', () => {
    withTasks([task('a', 'running')]);
    render(<App />);
    expect(screen.queryByText('02 · ARCHIVE')).toBeNull();
  });

  it('shows 20 archive rows until SHOW ALL is clicked', async () => {
    withTasks(
      Array.from({ length: 25 }, (_, i) => task(`f${i}`, 'finished', i)),
    );
    render(<App />);
    expect(archiveRows()).toHaveLength(20);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'SHOW ALL (25)' }));
    expect(archiveRows()).toHaveLength(25);
    expect(screen.getByRole('button', { name: 'SHOW LESS' })).toBeTruthy();
  });
});
