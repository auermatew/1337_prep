import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { deskProps } from '../test/desk';
import { LOOK_KEY } from './look';
import { TIMING } from './timing';

vi.mock('../stream/useTaskStream', () => ({ useTaskStream: vi.fn() }));
import { useTaskStream } from '../stream/useTaskStream';

vi.mock('./loadMoonrise', () => ({
  loadMoonrise: vi.fn(() => Promise.reject(new Error('chunk'))),
  preloadMoonrise: vi.fn(),
  isMoonriseReady: () => false,
}));
import { loadMoonrise } from './loadMoonrise';

const T = TIMING.full;
const NONE: never[] = [];

async function step(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  localStorage.clear();
  const { log, status, lastEventId, error, upsert } = deskProps();
  vi.mocked(useTaskStream).mockReturnValue({
    tasks: NONE,
    log,
    status,
    lastEventId,
    error,
    upsert,
  });
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('a failed Moonrise load', () => {
  it('says so, tries again, and goes back to classic', async () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Moonrise' }));
    await step(T.moonCover);
    expect(screen.getByRole('alert').textContent).toContain(
      "Couldn't load the night. Try again.",
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await step(0);
    expect(vi.mocked(loadMoonrise)).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await step(T.uncover);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelector('.top')).not.toBeNull();
    expect(localStorage.getItem(LOOK_KEY)).toBe('classic');
  });
});
