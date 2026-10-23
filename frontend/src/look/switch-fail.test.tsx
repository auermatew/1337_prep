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

vi.mock('./reload', () => ({ reloadInto: vi.fn() }));
import { reloadInto } from './reload';

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
    // (Try again reloads the page into ?look=moon; see useLookSwitch.)
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Moonrise' }));
    await step(T.moonCover);
    expect(screen.getByRole('alert').textContent).toContain(
      "Couldn't load the night. Try again.",
    );
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Try again' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(vi.mocked(reloadInto)).toHaveBeenCalledWith('moon');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await step(T.uncover);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelector('.top')).not.toBeNull();
    expect(localStorage.getItem(LOOK_KEY)).toBe('classic');
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Switch to Moonrise' }),
    );
  });

  it('leaves focus alone after a tap or click, so no ring stays behind', async () => {
    vi.mocked(loadMoonrise).mockImplementationOnce(() =>
      Promise.reject(new Error('chunk')),
    );
    render(<App />);
    // A pointer click carries a click count; a keyboard press has none.
    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to Moonrise' }),
      {
        detail: 1,
      },
    );
    await step(T.moonCover);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }), {
      detail: 1,
    });
    await step(T.uncover);
    expect(document.activeElement).toBe(document.body);
  });

  it('keeps the page underneath out of reach while covered', async () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Moonrise' }));
    expect(container.querySelector('.top')!.closest('[inert]')).not.toBeNull();
    await step(T.moonCover);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await step(T.uncover);
    expect(container.querySelector('[inert]')).toBeNull();
  });
});
