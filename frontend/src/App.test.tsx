import { cleanup, render, screen, within } from '@testing-library/react';
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
    expect(screen.getByText('ARCHIVE')).toBeTruthy();
    expect(archiveRows()).toHaveLength(2);
  });

  it('hides the archive when nothing has ended', () => {
    withTasks([task('a', 'running')]);
    render(<App />);
    expect(screen.queryByText('ARCHIVE')).toBeNull();
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

  it('shows archive stats over all ended tasks', () => {
    withTasks([
      ...Array.from({ length: 25 }, (_, i) => task(`f${i}`, 'finished', i)),
      task('c', 'cancelled', 30),
      task('r', 'running', 31),
    ]);
    render(<App />);
    const stats = within(screen.getByLabelText('ARCHIVE STATS'));
    const value = (label: string) =>
      stats.getByText(label).nextElementSibling?.textContent;
    expect(value('FINISHED')).toBe('25');
    expect(value('CANCELLED')).toBe('1');
    expect(value('TIME SPENT')).toBe('26M 00S');
  });

  it('links to the GitHub repo in a new tab', () => {
    withTasks([]);
    render(<App />);
    const link = screen.getByRole('link', { name: 'GITHUB ↗' });
    expect(link.getAttribute('href')).toBe(
      'https://github.com/auermatew/1337_prep',
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('labels sections without numbers', () => {
    withTasks([task('a', 'finished')]);
    render(<App />);
    expect(screen.getByText('TIMERS')).toBeTruthy();
    expect(screen.getByText('ARCHIVE')).toBeTruthy();
    expect(screen.queryByText(/^\d\d · /)).toBeNull();
  });

  it('keeps transcripts in a side tab, not on the page', () => {
    withTasks([]);
    render(<App />);
    expect(screen.queryByText('TRANSCRIPTS', { selector: 'p' })).toBeNull();
    expect(screen.getByRole('button', { name: 'TRANSCRIPTS' })).toBeTruthy();
  });

  it('shows only the connection status in the header', () => {
    withTasks([]);
    const { container } = render(<App />);
    const top = container.querySelector('.top')!;
    expect(top.textContent).toContain('CONNECTED');
    expect(top.textContent).not.toContain('LAST ID');
  });

  it('shows the short task id in archive rows and timer windows', () => {
    withTasks([
      { ...task('x', 'running'), id: 'aaaa1111-2222-4333-8444-555566667777' },
      { ...task('y', 'finished'), id: 'bbbb1111-2222-4333-8444-555566667777' },
    ]);
    render(<App />);
    expect(screen.getByText('aaaa1111').getAttribute('title')).toBe(
      'aaaa1111-2222-4333-8444-555566667777',
    );
    const row = archiveRows()[0];
    expect(row.textContent).toContain('bbbb1111');
  });
});
