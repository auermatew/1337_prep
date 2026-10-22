import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeetWord } from './LeetWord';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const word = () => screen.getByTestId('leet-word');

describe('LeetWord', () => {
  it('glitches into 1337 for half a second when the roll hits', () => {
    render(<LeetWord random={() => 0} />);
    fireEvent.pointerEnter(word());
    expect(word().textContent).toBe('1337');
    expect(word().classList.contains('glitch')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(word().textContent).toBe('timer');
    expect(word().classList.contains('glitch')).toBe(false);
  });

  it('stays a timer when the roll misses', () => {
    render(<LeetWord random={() => 0.99} />);
    fireEvent.pointerEnter(word());
    expect(word().textContent).toBe('timer');
  });

  it('does not restart while already glitching', () => {
    const random = vi.fn(() => 0);
    render(<LeetWord random={random} />);
    fireEvent.pointerEnter(word());
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.pointerEnter(word());
    expect(random).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(word().textContent).toBe('timer');
  });

  it('hits half the time', () => {
    const { unmount } = render(<LeetWord random={() => 0.49} />);
    fireEvent.pointerEnter(word());
    expect(word().textContent).toBe('1337');
    unmount();
    render(<LeetWord random={() => 0.5} />);
    fireEvent.pointerEnter(word());
    expect(word().textContent).toBe('timer');
  });
});
