import './TaskId.css';

// The first 8 characters of a task's UUID: enough to tell timers apart.
// Hover shows the full id.
export function TaskId({ id }: { id: string }) {
  return (
    <span className="task-id" title={id}>
      {id.slice(0, 8)}
    </span>
  );
}
