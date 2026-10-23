import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { task } from '../test/desk';
import { MoonArchive } from './Archive';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  taskEvents: vi.fn(),
}));
import { taskEvents } from '../api/client';

beforeEach(() => {
  vi.mocked(taskEvents).mockReturnValue(new Promise(() => {}));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const rows = () =>
  screen.queryAllByRole('row').filter((r) => r.closest('tbody'));

function archive(ended = [task('a', 'finished')]) {
  return render(<MoonArchive ended={ended} newestEventIds={new Map()} />);
}

describe('MoonArchive', () => {
  it('is hidden while nothing has ended', () => {
    const { container } = archive([]);
    expect(container.textContent).toBe('');
  });

  it('shows 20 rows until Show all, then Show less', async () => {
    archive(Array.from({ length: 25 }, (_, i) => task(`f${i}`, 'finished', i)));
    expect(rows()).toHaveLength(20);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Show all (25)' }));
    expect(rows()).toHaveLength(25);
    await user.click(screen.getByRole('button', { name: 'Show less' }));
    expect(rows()).toHaveLength(20);
  });

  it('sums finished, cancelled and time spent', () => {
    archive([
      ...Array.from({ length: 25 }, (_, i) => task(`f${i}`, 'finished', i)),
      task('c', 'cancelled', 30),
    ]);
    const stats = within(screen.getByLabelText('Archive stats'));
    const value = (label: string) =>
      stats.getByText(label).nextElementSibling?.textContent ??
      stats.getByText(label).previousElementSibling?.textContent;
    expect(value('Finished')).toBe('25');
    expect(value('Cancelled')).toBe('1');
    expect(value('Time spent')).toBe('26m');
  });

  it('names the state with a word and strikes cancelled durations', () => {
    archive([task('c', 'cancelled')]);
    expect(within(rows()[0]).getByText('Cancelled')).toBeTruthy();
    expect(rows()[0].className).toContain('ms-row-cancelled');
  });

  it('keeps one history open at a time', async () => {
    archive([task('a', 'finished', 2), task('b', 'finished', 1)]);
    const user = userEvent.setup();
    const [first, second] = screen.getAllByRole('button', { name: 'History' });
    await user.click(first);
    expect(
      screen.getByRole('region', { name: 'History of task a' }),
    ).toBeTruthy();
    await user.click(second);
    expect(
      screen.queryByRole('region', { name: 'History of task a' }),
    ).toBeNull();
    expect(
      screen.getByRole('region', { name: 'History of task b' }),
    ).toBeTruthy();
  });
});
