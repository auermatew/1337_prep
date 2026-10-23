import { useRef, useState } from 'react';
import { cancelTask } from '../api/client';
import type { TaskDto } from '../api/types';
import { problemFromError, type Problem } from './problems';

// Cancel a running task once, however often it is clicked. A 409 means the
// server already ended it: the card locks its Cancel for good.
export function useCancelTask(
  task: TaskDto,
  onChanged: (task: TaskDto) => void,
) {
  const [cancelling, setCancelling] = useState(false);
  const [locked, setLocked] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const inFlight = useRef(false);

  const cancel = () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setCancelling(true);
    setProblem(null);
    return cancelTask(task.id).then(
      (updated) => {
        inFlight.current = false;
        setCancelling(false);
        onChanged(updated);
      },
      (err: unknown) => {
        inFlight.current = false;
        setCancelling(false);
        const found = problemFromError(err);
        if (found.kind === 'not-running') setLocked(true);
        setProblem(found);
      },
    );
  };

  return { cancel, cancelling, locked, problem };
}
