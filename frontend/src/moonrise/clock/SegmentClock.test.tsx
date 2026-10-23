import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SegmentClock } from './SegmentClock';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const lit = (root: ParentNode) => root.querySelectorAll('.ms-seg-on');

describe('SegmentClock', () => {
  it('draws seven segments per digit and two dots per colon', () => {
    const { container } = render(<SegmentClock value="13:37" />);
    expect(container.querySelectorAll('polygon')).toHaveLength(4 * 7);
    expect(container.querySelectorAll('rect')).toHaveLength(2);
  });

  it('lights only the two right-hand bars for a 1', () => {
    const { container } = render(<SegmentClock value="1" />);
    expect(lit(container)).toHaveLength(2);
  });

  it('carries its label as an image', () => {
    render(<SegmentClock value="02:41" label="02:41 left" />);
    expect(screen.getByRole('img', { name: '02:41 left' })).toBeTruthy();
  });

  it('defaults to the word 1337', () => {
    render(<SegmentClock />);
    expect(screen.getByRole('img', { name: '1337' })).toBeTruthy();
  });

  it('flashes once when the pulse key changes', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<SegmentClock pulseKey={1} />);
    const root = container.firstElementChild!;
    expect(root.classList.contains('ms-clock-flash')).toBe(false);
    rerender(<SegmentClock pulseKey={2} />);
    expect(root.classList.contains('ms-clock-flash')).toBe(true);
    act(() => vi.advanceTimersByTime(320));
    expect(root.classList.contains('ms-clock-flash')).toBe(false);
  });

  it('holds the scramble, then locks into the value', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<SegmentClock boot="hold" />);
    // Each frame schedules the next after it renders: step frame by frame.
    const frames = (n: number) => {
      for (let i = 0; i < n; i++) act(() => vi.advanceTimersByTime(70));
    };
    frames(60);
    rerender(<SegmentClock boot={false} />);
    frames(20);
    // 1337: 2 + 5 + 5 + 3 lit segments
    expect(lit(container)).toHaveLength(15);
  });

  it('draws no glow filter when glow is off', () => {
    const { container } = render(<SegmentClock value="12" glow={false} />);
    expect(container.querySelector('g[filter]')).toBeNull();
  });

  it('glows by default', () => {
    const { container } = render(<SegmentClock value="12" />);
    expect(container.querySelector('g[filter]')).not.toBeNull();
  });
});
