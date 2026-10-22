import type { TaskDto } from '../api/types';

export function remainingMs(task: TaskDto, now: number): number {
  return Math.max(0, Date.parse(task.endsAt) - now);
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

export function progressStep(task: TaskDto, now: number, steps = 19): number {
  const elapsed = now - Date.parse(task.startedAt);
  const duration = task.durationSeconds * 1000;
  if (duration <= 0) return steps;
  const raw = Math.floor((elapsed / duration) * steps);
  return Math.min(steps, Math.max(0, raw));
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB');
}

export function formatSpent(ms: number): string {
  const totalSeconds = Math.round(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}H ${pad(minutes)}M ${pad(seconds)}S`;
  if (minutes > 0) return `${minutes}M ${pad(seconds)}S`;
  return `${seconds}S`;
}
