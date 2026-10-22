import type { TaskDto } from '../api/types';

export interface ArchiveStats {
  finished: number;
  cancelled: number;
  spentMs: number;
}

// Actual time is start → the finish/cancel transition (`updatedAt`), not the
// planned duration. Clamped so clock skew between processes never subtracts.
export function archiveStats(tasks: TaskDto[]): ArchiveStats {
  const stats: ArchiveStats = { finished: 0, cancelled: 0, spentMs: 0 };
  for (const t of tasks) {
    if (t.state === 'running') continue;
    stats[t.state] += 1;
    stats.spentMs += Math.max(
      0,
      Date.parse(t.updatedAt) - Date.parse(t.startedAt),
    );
  }
  return stats;
}
