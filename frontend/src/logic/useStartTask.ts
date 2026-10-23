import { useRef, useState, type FormEvent } from 'react';
import { createTask } from '../api/client';
import type { TaskDto } from '../api/types';
import {
  parseSeconds,
  problemFromError,
  validateStart,
  type Problem,
} from './problems';

// The start form's state and submit, without its markup.
export function useStartTask(onCreated: (task: TaskDto) => void) {
  const [name, setName] = useState('');
  const [seconds, setSeconds] = useState('180');
  const [submitting, setSubmitting] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const inFlight = useRef(false);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (inFlight.current) return;
    const trimmed = name.trim();
    const found = validateStart(trimmed, seconds);
    setProblems(found);
    if (found.length > 0) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      const task = await createTask({
        name: trimmed,
        durationSeconds: Number(seconds.trim()),
      });
      setName('');
      onCreated(task);
    } catch (err) {
      setProblems([problemFromError(err)]);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return {
    name,
    setName,
    seconds,
    setSeconds,
    secondsValue: parseSeconds(seconds),
    submitting,
    problems,
    submit,
  };
}
