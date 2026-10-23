import type { StreamStatus } from '../stream/useTaskStream';
import { STATUS_WORD } from './copy';

const CLASS: Record<StreamStatus, string> = {
  open: 'ms-live-live',
  connecting: 'ms-live-connecting',
  reconnecting: 'ms-live-reconnecting',
};

// The page's connection: one glowing clock segment, never a dot.
export function LiveIndicator({
  status,
  large,
}: {
  status: StreamStatus;
  large?: boolean;
}) {
  return (
    <span
      className={['ms-live', CLASS[status], large && 'ms-live-lg']
        .filter(Boolean)
        .join(' ')}
      role="status"
    >
      <span className="ms-live-pip" aria-hidden="true" />
      {STATUS_WORD[status]}
    </span>
  );
}
