import type { Problem } from '../logic/problems';

// The classic look's words for a problem: uppercase, one line per message.
export function problemLines(problem: Problem): string[] {
  switch (problem.kind) {
    case 'name-required':
      return ['NAME IS REQUIRED'];
    case 'name-too-long':
      return ['NAME IS 100 CHARACTERS AT MOST'];
    case 'seconds-invalid':
      return ['SECONDS MUST BE A WHOLE NUMBER FROM 1 TO 86400'];
    case 'server':
      return problem.messages.map((m) => m.toUpperCase());
    case 'unreachable':
      return ['COULD NOT REACH THE SERVER'];
    case 'not-running':
      return ['TASK IS NOT RUNNING'];
  }
}
