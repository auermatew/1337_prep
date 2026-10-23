import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MoonNotebook } from './Notebook';
import { pageWidth } from './pageWidth';

const ctx = {
  setTransform: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  drawImage: vi.fn(),
} as unknown as CanvasRenderingContext2D;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
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

describe('pageWidth', () => {
  it('fills a phone-wide sheet with the spread', () => {
    expect(pageWidth(375, 812)).toBe(156);
  });

  it('stays within the screen height and 400px on big screens', () => {
    expect(pageWidth(1440, 900)).toBe(400);
    expect(pageWidth(1024, 600)).toBe(226);
  });

  it('fits a small phone, and never goes below 120px', () => {
    expect(pageWidth(320, 568)).toBe(128);
    expect(pageWidth(260, 500)).toBe(120);
  });
});

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

  it('hands focus from the cover to Close once it swings open', () => {
    render(<MoonNotebook open onClose={vi.fn()} />);
    screen.getByRole('button', { name: 'Open the notebook' }).focus();
    act(() => vi.advanceTimersByTime(1800));
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Close' }),
    );
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

  it('keeps the ink on the paper', () => {
    render(<MoonNotebook open onClose={vi.fn()} />);
    act(() => vi.advanceTimersByTime(1800));
    act(() => vi.advanceTimersByTime(1100));
    vi.mocked(ctx.save).mockClear();
    draw();
    expect(ctx.save).toHaveBeenCalled();
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
