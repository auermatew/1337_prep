import { Fragment, memo, useState } from 'react';
import type { TaskDto } from '../api/types';
import { ARCHIVE_PAGE, useArchive } from '../logic/useArchive';
import { formatClock, formatCountdown, formatSpent } from '../time/format';
import { History } from './History';
import { TaskId } from './TaskId';
import './Archive.css';

export const Archive = memo(function Archive({
  tasks,
  newestEventIds,
}: {
  tasks: TaskDto[];
  newestEventIds: Map<string, number>;
}) {
  const { sorted, rows, showAll, toggleShowAll, stats } = useArchive(tasks);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  if (sorted.length === 0) return null;

  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="archive">
      <p className="tag">ARCHIVE</p>
      <dl className="arc-stats" aria-label="ARCHIVE STATS">
        <div className="arc-stat">
          <dt>FINISHED</dt>
          <dd className="arc-stat-on">{stats.finished}</dd>
        </div>
        <div className="arc-stat">
          <dt>CANCELLED</dt>
          <dd>{stats.cancelled}</dd>
        </div>
        <div className="arc-stat">
          <dt>TIME SPENT</dt>
          <dd>{formatSpent(stats.spentMs)}</dd>
        </div>
      </dl>
      <table className="arc">
        <thead>
          <tr>
            <th className="arc-name">NAME</th>
            <th className="arc-state">STATE</th>
            <th className="arc-dur">DURATION</th>
            <th className="arc-end">ENDED</th>
            <th className="arc-hist">
              <span className="visually-hidden">HISTORY</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const isOpen = open.has(t.id);
            return (
              <Fragment key={t.id}>
                <tr className={isOpen ? 'arc-row open' : 'arc-row'}>
                  <td className="arc-name">
                    <span className="arc-name-text" title={t.name}>
                      {t.name}
                    </span>
                    <TaskId id={t.id} />
                  </td>
                  <td className="arc-state">
                    {t.state === 'finished' ? (
                      <>
                        <span className="arc-mark">[x]</span> FINISHED
                      </>
                    ) : (
                      <span className="arc-off">[ ] CANCELLED</span>
                    )}
                  </td>
                  <td className="arc-dur">
                    {formatCountdown(t.durationSeconds * 1000)}
                  </td>
                  <td className="arc-end">{formatClock(t.updatedAt)}</td>
                  <td className="arc-hist">
                    <button
                      type="button"
                      className="link-btn"
                      aria-expanded={isOpen}
                      onClick={() => toggle(t.id)}
                    >
                      <span className="arc-hist-word">HISTORY </span>
                      {isOpen ? '↑' : '↓'}
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="arc-detail">
                    <td colSpan={5}>
                      <History
                        taskId={t.id}
                        refreshKey={newestEventIds.get(t.id) ?? null}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {sorted.length > ARCHIVE_PAGE && (
        <button
          type="button"
          className="link-btn arc-more"
          onClick={toggleShowAll}
        >
          {showAll ? 'SHOW LESS' : `SHOW ALL (${sorted.length})`}
        </button>
      )}
    </section>
  );
});
