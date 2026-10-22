import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TaskDto } from '../api/types';
import { TimerWindow } from './TimerWindow';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  cancelTask: vi.fn(),
  taskEvents: vi.fn(),
}));
import { ApiError, cancelTask } from '../api/client';

const mockCancel = vi.mocked(cancelTask);

const START = Date.parse('2026-01-01T00:00:00.000Z');

const running: TaskDto = {
  id: 't1',
  name: 'tea',
  durationSeconds: 120,
  state: 'running',
  startedAt: '2026-01-01T00:00:00.000Z',
  endsAt: '2026-01-01T00:02:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function show(now: number, onChanged = vi.fn(), task = running) {
  render(
    <TimerWindow
      task={task}
      now={now}
      onChanged={onChanged}
      newestEventId={null}
    />,
  );
  return onChanged;
}

describe('TimerWindow', () => {
  it('counts down from endsAt', () => {
    show(START + 59_000);
    expect(screen.getByText('01:01')).toBeTruthy();
    expect(screen.getByText('tea.tmr')).toBeTruthy();
    expect(screen.getByText(/RUNNING/)).toBeTruthy();
  });

  it('shows 00:00 and FINISHING… once endsAt has passed', () => {
    show(START + 130_000);
    expect(screen.getByText('00:00')).toBeTruthy();
    expect(screen.getByText(/FINISHING…/)).toBeTruthy();
  });

  it('cancels once even when clicked twice', async () => {
    mockCancel.mockReturnValue(new Promise(() => {}));
    show(START);
    const user = userEvent.setup();
    const button = screen.getByRole('button', { name: 'CANCEL' });
    await user.click(button);
    await user.click(button);
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCancel).toHaveBeenCalledWith('t1');
  });

  it('shows a 409 and keeps CANCEL disabled', async () => {
    mockCancel.mockRejectedValue(new ApiError(409, ['Task is not running']));
    show(START);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'CANCEL' }));
    expect(await screen.findByText('TASK IS NOT RUNNING')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'CANCEL' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it.each([
    ['named 1337', { name: '1337' }],
    ['set to 1337 seconds', { durationSeconds: 1337 }],
  ])('glows rainbow when %s', (_label, overrides) => {
    show(START, vi.fn(), { ...running, ...overrides });
    expect(document.querySelector('.win.tw-1337')).not.toBeNull();
  });

  it('does not glow for an ordinary timer', () => {
    show(START);
    expect(document.querySelector('.tw-1337')).toBeNull();
  });
});
