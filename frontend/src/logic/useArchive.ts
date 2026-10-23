import { useMemo, useState } from 'react';
import type { TaskDto } from '../api/types';
import { archiveStats } from '../time/stats';

export const ARCHIVE_PAGE = 20;

// Ended tasks, newest first, one page of rows until "show all".
export function useArchive(ended: TaskDto[]) {
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(
    () =>
      [...ended].sort(
        (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
      ),
    [ended],
  );
  const stats = useMemo(() => archiveStats(ended), [ended]);
  return {
    sorted,
    rows: showAll ? sorted : sorted.slice(0, ARCHIVE_PAGE),
    total: sorted.length,
    showAll,
    toggleShowAll: () => setShowAll((v) => !v),
    stats,
  };
}
