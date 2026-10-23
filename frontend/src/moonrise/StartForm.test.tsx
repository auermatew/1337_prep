import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { task } from '../test/desk';
import { MoonStartForm } from './StartForm';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  createTask: vi.fn(),
}));
import { createTask } from '../api/client';

const mockCreate = vi.mocked(createTask);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup() {
  const onCreated = vi.fn();
  render(<MoonStartForm onCreated={onCreated} />);
  return {
    onCreated,
    name: screen.getByLabelText('Name') as HTMLInputElement,
    seconds: screen.getByLabelText('Seconds') as HTMLInputElement,
    button: screen.getByRole('button', { name: 'Start timer →' }),
    user: userEvent.setup(),
  };
}

describe('MoonStartForm', () => {
  it('asks for a name in one sentence', async () => {
    const { button, user } = setup();
    await user.click(button);
    expect(screen.getByRole('alert').textContent).toBe(
      'Give the timer a name of 1 to 100 characters.',
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('always shows the seconds hint', async () => {
    const { seconds, user } = setup();
    expect(screen.getByText('= 3m')).toBeTruthy();
    await user.clear(seconds);
    await user.type(seconds, '1337');
    expect(screen.getByText('= LEET')).toBeTruthy();
    await user.clear(seconds);
    await user.type(seconds, '90000');
    expect(screen.getByText('= HELL NAW')).toBeTruthy();
  });

  it('starts a timer and clears the name', async () => {
    const created = task('t1', 'running');
    mockCreate.mockResolvedValue(created);
    const { name, button, onCreated, user } = setup();
    await user.type(name, 'tea');
    await user.click(button);
    expect(mockCreate).toHaveBeenCalledWith({
      name: 'tea',
      durationSeconds: 180,
    });
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(name.value).toBe('');
  });
});
