import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskDto } from '../api/types';
import { deskProps, task } from '../test/desk';
import MoonriseLook from './MoonriseLook';
import { TimerCard } from './TimerCard';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  cancelTask: vi.fn(),
  taskEvents: vi.fn(),
}));
import { ApiError, cancelTask, taskEvents } from '../api/client';

const mockCancel = vi.mocked(cancelTask);
const mockEvents = vi.mocked(taskEvents);

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
  mockEvents.mockReturnValue(new Promise(() => {}));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// Runs from 00:00 to 00:01 UTC on 2026-01-01.
const running = task('a', 'running');
const at = (s: number) => Date.UTC(2026, 0, 1, 0, 0, s);

function card(t: TaskDto, now: number, extra: { departing?: boolean } = {}) {
  return render(
    <TimerCard
      task={t}
      now={now}
      departing={extra.departing ?? false}
      onChanged={vi.fn()}
      newestEventId={null}
      glow
    />,
  );
}

describe('TimerCard', () => {
  it('counts down from endsAt', () => {
    card(running, at(15));
    expect(screen.getByRole('img', { name: '00:45 left' })).toBeTruthy();
    expect(screen.getByText('Running')).toBeTruthy();
  });

  it('shows the moon phase of the elapsed time', () => {
    card(running, at(15));
    expect(screen.getByRole('img', { name: '25% elapsed' })).toBeTruthy();
  });

  it('says Finishing… at 00:00 until the server confirms', () => {
    card(running, at(75));
    expect(screen.getByRole('img', { name: '00:00 left' })).toBeTruthy();
    expect(screen.getByText('Finishing…')).toBeTruthy();
  });

  it('cancels once even when clicked twice', async () => {
    mockCancel.mockReturnValue(new Promise(() => {}));
    card(running, at(15));
    const user = userEvent.setup();
    const button = screen.getByRole('button', { name: 'Cancel' });
    await user.click(button);
    await user.click(button);
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Cancelling…')).toBeTruthy();
  });

  it('says the timer already ended on a 409 and keeps Cancel off', async () => {
    mockCancel.mockRejectedValue(new ApiError(409, ['Task is not running']));
    card(running, at(15));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'This timer already ended.',
    );
    expect(
      (screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('opens its history as a popover and closes it again', async () => {
    card(running, at(15));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(
      screen.getByRole('region', { name: `History of ${running.name}` }),
    ).toBeTruthy();
    expect(screen.getByText('Loading…')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Hide history' }));
    expect(screen.queryByRole('region', { name: /^History of/ })).toBeNull();
  });

  it('sets like the moon when it finishes', () => {
    const { container } = card(task('a', 'finished'), at(75), {
      departing: true,
    });
    expect(container.querySelector('.ms-exit-finished')).not.toBeNull();
    expect(screen.getByText('Finished')).toBeTruthy();
  });

  it('fades when it is cancelled', () => {
    const { container } = card(task('a', 'cancelled'), at(75), {
      departing: true,
    });
    expect(container.querySelector('.ms-exit-cancelled')).not.toBeNull();
  });
});

describe('MoonriseLook cards', () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => task(`r${i}`, 'running'));
  const glowing = (root: ParentNode) =>
    root.querySelectorAll('.ms-timer g[filter]').length;

  it('shows a card per timer on the desk', () => {
    render(<MoonriseLook {...deskProps({ onDesk: many(3) })} />);
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.queryByText('Nothing running')).toBeNull();
  });

  it('drops the card glow above 20 timers', () => {
    const { container, unmount } = render(
      <MoonriseLook {...deskProps({ onDesk: many(20) })} />,
    );
    expect(glowing(container)).toBe(20);
    unmount();
    const again = render(<MoonriseLook {...deskProps({ onDesk: many(21) })} />);
    expect(glowing(again.container)).toBe(0);
  });

  it('puts the start form on the cloud floor', () => {
    render(<MoonriseLook {...deskProps()} />);
    expect(screen.getByRole('button', { name: 'Start timer →' })).toBeTruthy();
  });
});
