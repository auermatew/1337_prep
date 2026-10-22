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
// jsdom lays the word out as a zero box at (0, 0).
const moveTo = (x: number, y: number) =>
  fireEvent.pointerMove(window, {
    clientX: x,
    clientY: y,
    pointerType: 'mouse',
  });

describe('LeetWord near the cursor', () => {
  it('glitches for half a second when the cursor comes near and the roll hits', () => {
    render(<LeetWord canHover random={() => 0} />);
    moveTo(1000, 1000);
    expect(word().textContent).toBe('timer');
    moveTo(200, 100);
    expect(word().textContent).toBe('1337');
    expect(word().classList.contains('glitch')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(word().textContent).toBe('timer');
  });

  it('rolls once per approach, not on every move nearby', () => {
    const random = vi.fn(() => 0.99);
    render(<LeetWord canHover random={random} />);
    moveTo(1000, 1000);
    moveTo(100, 100);
    moveTo(120, 90);
    moveTo(60, 40);
    expect(random).toHaveBeenCalledTimes(1);
    moveTo(1000, 1000);
    moveTo(100, 100);
    expect(random).toHaveBeenCalledTimes(2);
  });

  it('stays a timer when the roll misses', () => {
    render(<LeetWord canHover random={() => 0.99} />);
    moveTo(1000, 1000);
    moveTo(50, 50);
    expect(word().textContent).toBe('timer');
  });
});

describe('LeetWord without hover', () => {
  it('glitches on its own at random moments', () => {
    let roll = 0.99;
    render(<LeetWord canHover={false} random={() => roll} />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(word().textContent).toBe('timer');
    roll = 0;
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(word().textContent).toBe('1337');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(word().textContent).toBe('timer');
  });

  it('ignores the cursor', () => {
    const random = vi.fn(() => 0);
    render(<LeetWord canHover={false} random={random} />);
    moveTo(1000, 1000);
    moveTo(10, 10);
    expect(random).not.toHaveBeenCalled();
  });
});
