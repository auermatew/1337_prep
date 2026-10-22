import { describe, expect, it } from 'vitest';
import type { TaskDto } from '../api/types';
import {
  formatClock,
  formatCountdown,
  formatSpent,
  progressStep,
  remainingMs,
} from './format';

function task(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: 't1',
    name: 'task',
    durationSeconds: 10,
    state: 'running',
    startedAt: '2026-10-22T10:00:00.000Z',
    endsAt: '2026-10-22T10:00:10.000Z',
    updatedAt: '2026-10-22T10:00:00.000Z',
    ...overrides,
  };
}

const START = Date.parse('2026-10-22T10:00:00.000Z');

describe('formatCountdown', () => {
  it('formats zero as 00:00', () => {
    expect(formatCountdown(0)).toBe('00:00');
  });

  it('rounds partial seconds up', () => {
    expect(formatCountdown(1)).toBe('00:01');
  });

  it('formats minutes as mm:ss', () => {
    expect(formatCountdown(61_000)).toBe('01:01');
  });

  it('switches to h:mm:ss from one hour', () => {
    expect(formatCountdown(3_600_000)).toBe('1:00:00');
  });

  it('formats long durations with multi-digit hours', () => {
    expect(formatCountdown(86_400_000)).toBe('24:00:00');
  });
});

describe('remainingMs', () => {
  it('is clamped to 0 when endsAt is in the past', () => {
    const t = task({ endsAt: new Date(START - 5_000).toISOString() });
    expect(remainingMs(t, START)).toBe(0);
  });

  it('is endsAt minus now while running', () => {
    expect(remainingMs(task(), START + 4_000)).toBe(6_000);
  });
});

describe('progressStep', () => {
  it('is 0 at the start', () => {
    expect(progressStep(task(), START)).toBe(0);
  });

  it('is 9 at half of a 10 s timer', () => {
    expect(progressStep(task(), START + 5_000)).toBe(9);
  });

  it('is clamped to 19 past the end', () => {
    expect(progressStep(task(), START + 60_000)).toBe(19);
  });
});

describe('formatClock', () => {
  it('formats as local 24h HH:MM:SS', () => {
    const iso = '2026-10-22T11:37:00.000Z';
    expect(formatClock(iso)).toBe(new Date(iso).toLocaleTimeString('en-GB'));
  });
});

describe('formatSpent', () => {
  it('formats zero as 0S', () => {
    expect(formatSpent(0)).toBe('0S');
  });

  it('shows seconds alone under a minute', () => {
    expect(formatSpent(42_000)).toBe('42S');
  });

  it('pads seconds after minutes', () => {
    expect(formatSpent(61_000)).toBe('1M 01S');
  });

  it('shows hours, minutes and seconds', () => {
    expect(formatSpent(3_852_000)).toBe('1H 04M 12S');
  });

  it('rounds to the nearest second', () => {
    expect(formatSpent(1_400)).toBe('1S');
  });

  it('clamps negatives to 0S', () => {
    expect(formatSpent(-5)).toBe('0S');
  });
});
