import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LogLine } from '../stream/useTaskStream';
import { LiveLog } from './LiveLog';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const line = (seq: number, id: number, name: string): LogLine => ({
  seq,
  id,
  taskId: name,
  name,
  state: 'running',
  at: '2026-01-01T00:00:00.000Z',
});

describe('LiveLog', () => {
  it('renders lines with a reused event id under a log role', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <LiveLog
        log={[line(1, 5, 'tea'), line(2, 5, 'pasta')]}
        status="open"
        lastEventId={5}
      />,
    );
    const log = screen.getByRole('log');
    expect(log.getAttribute('aria-live')).toBeNull();
    expect(screen.getByText('tea')).toBeTruthy();
    expect(screen.getByText('pasta')).toBeTruthy();
    expect(error).not.toHaveBeenCalled();
  });
});
