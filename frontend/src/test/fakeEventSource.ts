import type { TaskChange } from '../api/types';

type Listener = (event: MessageEvent) => void;

export class FakeEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances: FakeEventSource[] = [];

  readonly url: string;
  readyState = FakeEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  private listeners = new Map<string, Listener[]>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  static reset(): void {
    FakeEventSource.instances = [];
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }

  open(): void {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.();
  }

  emit(change: TaskChange): void {
    const event = new MessageEvent('task', {
      data: JSON.stringify(change),
      lastEventId: String(change.event.id),
    });
    (this.listeners.get('task') ?? []).forEach((l) => l(event));
  }

  fail(closed = false): void {
    this.readyState = closed
      ? FakeEventSource.CLOSED
      : FakeEventSource.CONNECTING;
    this.onerror?.();
  }
}
