import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MoonNotebook } from './Notebook';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const book = () => document.querySelector('.ms-notebook')!;
const canvas = () => screen.getByLabelText('Drawing layer');

function draw() {
  fireEvent.pointerDown(canvas(), {
    pointerId: 1,
    button: 0,
    clientX: 5,
    clientY: 5,
  });
  fireEvent.pointerUp(canvas(), { pointerId: 1 });
}

describe('MoonNotebook', () => {
  it('opens on the cover, then swings open by itself', () => {
    render(<MoonNotebook open onClose={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: 'Open the notebook' }),
    ).toBeTruthy();
    expect(book().classList.contains('ms-notebook-open')).toBe(false);
    act(() => vi.advanceTimersByTime(1800));
    expect(book().classList.contains('ms-notebook-open')).toBe(true);
  });

  it('opens at once when the cover is clicked', () => {
    render(<MoonNotebook open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open the notebook' }));
    expect(book().classList.contains('ms-notebook-open')).toBe(true);
  });

  it('ignores Esc', () => {
    const onClose = vi.fn();
    render(<MoonNotebook open onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Notebook' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('swings shut on Close and goes after 2.3 s', () => {
    const onClose = vi.fn();
    render(<MoonNotebook open onClose={onClose} />);
    act(() => vi.advanceTimersByTime(1800));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(book().classList.contains('ms-notebook-open')).toBe(false);
    act(() => vi.advanceTimersByTime(2299));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('draws in red over the whole spread once open', () => {
    render(<MoonNotebook open onClose={vi.fn()} />);
    expect(canvas().closest('.ms-nb-drawzone')).not.toBeNull();
    expect(
      canvas().closest('.ms-nb-drawzone')!.classList.contains('ms-nb-inking'),
    ).toBe(false);
    act(() => vi.advanceTimersByTime(1800));
    act(() => vi.advanceTimersByTime(1100));
    expect(
      canvas().closest('.ms-nb-drawzone')!.classList.contains('ms-nb-inking'),
    ).toBe(true);
    draw();
    expect(canvas().getAttribute('data-strokes')).toBe('1');
  });

  it('clears the drawing', () => {
    render(<MoonNotebook open onClose={vi.fn()} />);
    act(() => vi.advanceTimersByTime(1800));
    act(() => vi.advanceTimersByTime(1100));
    draw();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(canvas().getAttribute('data-strokes')).toBe('0');
  });

  it('starts blank after closing and reopening', () => {
    const onClose = vi.fn();
    const { rerender } = render(<MoonNotebook open onClose={onClose} />);
    act(() => vi.advanceTimersByTime(1800));
    act(() => vi.advanceTimersByTime(1100));
    draw();
    rerender(<MoonNotebook open={false} onClose={onClose} />);
    rerender(<MoonNotebook open onClose={onClose} />);
    expect(canvas().getAttribute('data-strokes')).toBe('0');
    expect(book().classList.contains('ms-notebook-open')).toBe(false);
  });
});
