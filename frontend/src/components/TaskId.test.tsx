import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskId } from './TaskId';

const ID = '3f2a1b9c-4d5e-4f60-8a7b-1c2d3e4f5a6b';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('TaskId', () => {
  it('shows the first 8 characters with the full id on hover', () => {
    render(<TaskId id={ID} />);
    const button = screen.getByRole('button', { name: `Copy task id ${ID}` });
    expect(button.textContent).toBe('3f2a1b9c');
    expect(button.getAttribute('title')).toBe(ID);
  });

  it('copies the full id and confirms for a moment', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<TaskId id={ID} />);
    const button = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(button);
    });
    expect(writeText).toHaveBeenCalledWith(ID);
    expect(button.textContent).toBe('COPIED');
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(button.textContent).toBe('3f2a1b9c');
  });

  it('keeps showing the id when the clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    render(<TaskId id={ID} />);
    const button = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(button);
    });
    expect(button.textContent).toBe('3f2a1b9c');
  });
});
