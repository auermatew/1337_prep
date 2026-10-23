import type { Problem } from '../logic/problems';
import type { StreamStatus } from '../stream/useTaskStream';

// Moonrise words: sentence case, one line, what went wrong and how to fix it.
export function problemText(problem: Problem): string {
  switch (problem.kind) {
    case 'name-required':
    case 'name-too-long':
      return 'Give the timer a name of 1 to 100 characters.';
    case 'seconds-invalid':
      return 'Seconds must be a whole number from 1 to 86400.';
    case 'server': {
      const first = problem.messages[0] ?? '';
      return first.charAt(0).toUpperCase() + first.slice(1);
    }
    case 'unreachable':
      return "Couldn't reach the server. Check your connection and try again.";
    case 'not-running':
      return 'This timer already ended.';
  }
}

// 180 → "3m", 3725 → "1h 2m 5s", 0 → "".
export function humanize(seconds: number): string {
  const s = Math.floor(seconds);
  if (!(s > 0)) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  return [h && `${h}h`, m && `${m}m`, rest && `${rest}s`]
    .filter(Boolean)
    .join(' ');
}

export const STATUS_WORD: Record<StreamStatus, string> = {
  open: 'Live',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
};
