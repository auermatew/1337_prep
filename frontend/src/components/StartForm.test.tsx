import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TaskDto } from '../api/types';
import { StartForm } from './StartForm';

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
  cleanup();
  vi.clearAllMocks();
});

function setup() {
  const onCreated = vi.fn();
  render(<StartForm onCreated={onCreated} />);
  const name = screen.getByLabelText('NAME') as HTMLInputElement;
  const seconds = screen.getByLabelText('SECONDS') as HTMLInputElement;
  const button = screen.getByRole('button', { name: 'START TIMER →' });
  return { onCreated, name, seconds, button, user: userEvent.setup() };
}

describe('StartForm', () => {
  it('requires a name and does not call the API', async () => {
    const { seconds, button, user } = setup();
    await user.clear(seconds);
    await user.type(seconds, '180');
    await user.click(button);
    expect(screen.getByText('NAME IS REQUIRED')).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it.each(['0', '1.5'])('rejects seconds %s', async (value) => {
    const { name, seconds, button, user } = setup();
    await user.type(name, 'tea');
    await user.clear(seconds);
    await user.type(seconds, value);
    await user.click(button);
    expect(
      screen.getByText('SECONDS MUST BE A WHOLE NUMBER FROM 1 TO 86400'),
    ).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('submits a trimmed name, clears it and reports the task', async () => {
    mockCreate.mockResolvedValue(created);
    const { name, seconds, button, onCreated, user } = setup();
    await user.type(name, '  tea  ');
    await user.clear(seconds);
    await user.type(seconds, '180');
    await user.click(button);
    expect(mockCreate).toHaveBeenCalledWith({
      name: 'tea',
      durationSeconds: 180,
    });
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(name.value).toBe('');
    expect(seconds.value).toBe('180');
  });

  it('shows every server validation message', async () => {
    mockCreate.mockRejectedValue(
      new ApiError(400, ['name too fancy', 'seconds too long']),
    );
    const { name, button, user } = setup();
    await user.type(name, 'tea');
    await user.click(button);
    expect(screen.getByText('NAME TOO FANCY')).toBeTruthy();
    expect(screen.getByText('SECONDS TOO LONG')).toBeTruthy();
  });

  it('hints minutes and hours while typing seconds', async () => {
    const { seconds, name, user } = setup();
    const hint = document.getElementById('start-seconds-hint')!;
    expect(seconds.getAttribute('aria-describedby')).toBe('start-seconds-hint');
    const typeSeconds = async (value: string) => {
      await user.clear(seconds);
      await user.type(seconds, value);
    };

    await typeSeconds('1500');
    expect(hint.classList.contains('on')).toBe(true);
    expect(hint.textContent).toBe('= 25M');

    await typeSeconds('45');
    expect(hint.classList.contains('on')).toBe(false);

    await typeSeconds(' 3725 ');
    expect(hint.classList.contains('on')).toBe(true);
    expect(hint.textContent).toBe('= 1H 02M 05S');

    await typeSeconds('86401');
    expect(hint.classList.contains('on')).toBe(true);
    expect(hint.textContent).toBe('HELL NAW');
    await typeSeconds('abc');
    expect(hint.classList.contains('on')).toBe(false);

    await typeSeconds('1500');
    await user.click(name);
    expect(hint.classList.contains('on')).toBe(false);
  });
});
