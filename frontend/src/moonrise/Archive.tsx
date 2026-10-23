import { memo, useState } from 'react';
import type { TaskDto } from '../api/types';
import { ARCHIVE_PAGE, useArchive } from '../logic/useArchive';
import { formatClock, formatCountdown } from '../time/format';
import { humanize } from './copy';
import { HistoryPopover } from './HistoryPopover';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Ended timers on flat black: three figures, then the table. One history
// popover at a time, floating under its row.
export const MoonArchive = memo(function MoonArchive({
  ended,
  newestEventIds,
}: {
  ended: TaskDto[];
  newestEventIds: Map<string, number>;
}) {
  const { rows, total, showAll, toggleShowAll, stats } = useArchive(ended);
  const [openId, setOpenId] = useState<string | null>(null);

  if (total === 0) return null;

  const spent = humanize(Math.round(stats.spentMs / 1000)) || '0s';

  return (
    <section className="ms-wrap ms-sec-archive" aria-label="Archive">
      <h2 className="display-m">Archive</h2>
      <dl className="ms-stats" aria-label="Archive stats">
        <div className="ms-stat">
          <dt className="ms-stat-label">Finished</dt>
          <dd className="ms-stat-value">{stats.finished}</dd>
        </div>
        <div className="ms-stat">
          <dt className="ms-stat-label">Cancelled</dt>
          <dd className="ms-stat-value">{stats.cancelled}</dd>
        </div>
        <div className="ms-stat">
          <dt className="ms-stat-label">Time spent</dt>
          <dd className="ms-stat-value">{spent}</dd>
        </div>
      </dl>
      <div className="ms-archive">
        <table className="ms-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">State</th>
              <th scope="col">Duration</th>
              <th scope="col">Ended</th>
              <th scope="col">
                <span className="visually-hidden">History</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const open = openId === t.id;
              return (
                <tr key={t.id} className={`ms-row ms-row-${t.state}`}>
                  <td data-label="Name">
                    <span className="ms-row-name">{t.name}</span>{' '}
                    <span className="ms-id" title={t.id}>
                      {t.id.slice(0, 8)}
                    </span>
                  </td>
                  <td data-label="State">
                    <span className={`ms-state-${t.state}`}>
                      {cap(t.state)}
                    </span>
                  </td>
                  <td data-label="Duration" className="ms-num ms-cell-duration">
                    {formatCountdown(t.durationSeconds * 1000)}
                  </td>
                  <td data-label="Ended" className="ms-num">
                    {formatClock(t.updatedAt)}
                  </td>
                  <td className="ms-cell-action">
                    <button
                      type="button"
                      className="ms-btn ms-btn-text"
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? null : t.id)}
                    >
                      {open ? 'Hide history' : 'History'}
                    </button>
                    {open && (
                      <HistoryPopover
                        taskId={t.id}
                        name={t.name}
                        refreshKey={newestEventIds.get(t.id) ?? null}
                        variant="row"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {total > ARCHIVE_PAGE && (
          <button
            type="button"
            className="ms-btn ms-btn-text ms-showall"
            onClick={toggleShowAll}
          >
            {showAll ? 'Show less' : `Show all (${total})`}
          </button>
        )}
      </div>
    </section>
  );
});
