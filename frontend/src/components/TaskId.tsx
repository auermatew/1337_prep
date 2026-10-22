import { useEffect, useState } from 'react';
import './TaskId.css';

const CONFIRM_MS = 1200;

// The first 8 characters of a task's UUID: enough to tell timers apart.
// Hover shows the full id; a click copies it for API calls.
export function TaskId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
    } catch {
      // No clipboard (insecure context, denied): the hover title still has it.
    }
  };

  return (
    <button
      type="button"
      className="task-id"
      title={id}
      aria-label={`Copy task id ${id}`}
      onClick={copy}
    >
      {copied ? 'COPIED' : id.slice(0, 8)}
    </button>
  );
}
