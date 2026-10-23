import type { TaskDto } from '../api/types';
import type { LogLine, StreamStatus } from '../stream/useTaskStream';

// What App hands either look: the stream's data, already split for the desk.
export interface DeskProps {
  /** Running tasks plus those still departing (shown leaving). */
  onDesk: TaskDto[];
  /** Ended tasks that have finished departing. */
  ended: TaskDto[];
  departing: ReadonlySet<string>;
  log: LogLine[];
  status: StreamStatus;
  lastEventId: number | null;
  error: string | null;
  upsert: (task: TaskDto) => void;
  newestEventIds: Map<string, number>;
  now: number;
}
