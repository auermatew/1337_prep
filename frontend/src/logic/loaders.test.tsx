import { act, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TaskDto } from '../api/types';
import { DrawLayer } from '../components/DrawLayer';
import { TRANSCRIPTS, transcriptHref } from './transcripts';
import { ARCHIVE_PAGE, useArchive } from './useArchive';
import { useTaskHistory } from './useTaskHistory';
import { useTranscript } from './useTranscript';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  taskEvents: vi.fn(),
}));
import { taskEvents } from '../api/client';

const mockEvents = vi.mocked(taskEvents);

function task(id: string, minute: number): TaskDto {
  const at = (m: number) => new Date(Date.UTC(2026, 0, 1, 0, m)).toISOString();
  return {
    id,
    name: id,
    durationSeconds: 60,
    state: 'finished',
    startedAt: at(minute),
    endsAt: at(minute + 1),
    updatedAt: at(minute + 1),
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('useTaskHistory', () => {
  it('loads, then reloads when the refresh key changes', async () => {
    mockEvents.mockResolvedValue([
      { id: 1, taskId: 'a', state: 'running', at: '2026-01-01T00:00:00Z' },
    ]);
    const { result, rerender } = renderHook(
      ({ key }) => useTaskHistory('a', key),
      { initialProps: { key: 1 as number | null } },
    );
    expect(result.current).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ key: 2 });
    await waitFor(() => expect(mockEvents).toHaveBeenCalledTimes(2));
  });

  it('does not fetch while disabled', () => {
    renderHook(() => useTaskHistory('a', 1, false));
    expect(mockEvents).not.toHaveBeenCalled();
  });

  it('reports a failed load', async () => {
    mockEvents.mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useTaskHistory('a', null));
    await waitFor(() => expect(result.current).toEqual({ status: 'failed' }));
  });
});

describe('useArchive', () => {
  it('sorts newest first and pages at 20 until shown all', () => {
    const ended = Array.from({ length: 25 }, (_, i) => task(`t${i}`, i));
    const { result } = renderHook(() => useArchive(ended));
    expect(ARCHIVE_PAGE).toBe(20);
    expect(result.current.sorted[0].id).toBe('t24');
    expect(result.current.rows).toHaveLength(20);
    expect(result.current.total).toBe(25);
    act(() => result.current.toggleShowAll());
    expect(result.current.rows).toHaveLength(25);
    expect(result.current.stats.finished).toBe(25);
  });
});

describe('useTranscript', () => {
  it('lists three transcripts under /transcripts/', () => {
    expect(TRANSCRIPTS).toHaveLength(3);
    expect(transcriptHref(TRANSCRIPTS[1])).toBe(
      '/transcripts/backend-planning.md',
    );
  });

  it('is null with nothing selected', () => {
    const { result } = renderHook(() => useTranscript(null));
    expect(result.current).toBeNull();
  });

  it('loads the text of the selected file', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('hello'))),
    );
    const { result } = renderHook(() => useTranscript(TRANSCRIPTS[0]));
    await waitFor(() =>
      expect(result.current).toEqual({ status: 'ready', value: 'hello' }),
    );
  });

  it('shows loading, not an old failure, for a new selection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('', { status: 500 }))),
    );
    const { result, rerender } = renderHook(({ t }) => useTranscript(t), {
      initialProps: { t: TRANSCRIPTS[0] },
    });
    await waitFor(() => expect(result.current).toEqual({ status: 'failed' }));
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    rerender({ t: TRANSCRIPTS[1] });
    expect(result.current).toEqual({ status: 'loading' });
  });

  it('shows loading when the same file is opened again after a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('', { status: 500 }))),
    );
    const { result, rerender } = renderHook(
      ({ t }: { t: (typeof TRANSCRIPTS)[number] | null }) => useTranscript(t),
      {
        initialProps: {
          t: TRANSCRIPTS[0] as (typeof TRANSCRIPTS)[number] | null,
        },
      },
    );
    await waitFor(() => expect(result.current).toEqual({ status: 'failed' }));
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    rerender({ t: null });
    rerender({ t: TRANSCRIPTS[0] });
    expect(result.current).toEqual({ status: 'loading' });
  });
});

describe('DrawLayer', () => {
  it('draws in the ink it is given', () => {
    const ctx = {
      setTransform: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: '',
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    render(<DrawLayer ink="#ff2a1f" />);
    expect(ctx.strokeStyle).toBe('#ff2a1f');
  });
});
