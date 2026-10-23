import { ApiError } from '../api/client';

// What went wrong, without the words: each look writes its own copy.
export type Problem =
  | { kind: 'name-required' }
  | { kind: 'name-too-long' }
  | { kind: 'seconds-invalid' }
  | { kind: 'server'; messages: string[] }
  | { kind: 'unreachable' }
  | { kind: 'not-running' };

export const NAME_MAX = 100;
export const SECONDS_MAX = 86400;

export function parseSeconds(seconds: string): number | null {
  const trimmed = seconds.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

// `name` is already trimmed. Mirrors the server's checks.
export function validateStart(name: string, seconds: string): Problem[] {
  const problems: Problem[] = [];
  if (name.length === 0) problems.push({ kind: 'name-required' });
  else if (name.length > NAME_MAX) problems.push({ kind: 'name-too-long' });
  const n = parseSeconds(seconds);
  if (n === null || n < 1 || n > SECONDS_MAX) {
    problems.push({ kind: 'seconds-invalid' });
  }
  return problems;
}

// The seconds hint's two easter eggs, shared by both looks.
export function secondsEgg(n: number | null): 'leet' | 'hell-naw' | null {
  if (n === null) return null;
  if (n > SECONDS_MAX) return 'hell-naw';
  if (n === 1337) return 'leet';
  return null;
}

export function problemFromError(err: unknown): Problem {
  if (err instanceof ApiError) {
    return err.status === 409
      ? { kind: 'not-running' }
      : { kind: 'server', messages: err.messages };
  }
  return { kind: 'unreachable' };
}
