import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { Client } from 'pg';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  TASK_EVENTS_CHANNEL,
  TaskChange,
  toEventDto,
  toTaskDto,
} from './task.types.js';

const INITIAL_BACKOFF_MS = 100;
const MAX_BACKOFF_MS = 5000;

/**
 * Per-process feed of task changes, driven by Postgres LISTEN/NOTIFY on a
 * dedicated connection. `changes$` emits each change once, in strictly
 * increasing event-id order, including changes missed while disconnected.
 */
@Injectable()
export class TaskEventsListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskEventsListener.name);
  private readonly subject = new Subject<TaskChange>();
  readonly changes$: Observable<TaskChange> = this.subject.asObservable();

  private client: Client | null = null;
  private lastSeen = 0;
  private destroyed = false;
  private retryTimer: NodeJS.Timeout | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  // While set, live notifications are buffered until the catch-up read is done.
  private buffer: TaskChange[] | null = null;

  constructor(private readonly prisma: PrismaService) {}

  lastSeenId(): number {
    return this.lastSeen;
  }

  /** Backend pid of the listener connection, or null while disconnected. */
  backendPid(): number | null {
    // processID is set by pg after connect but missing from its typings.
    const c = this.client as (Client & { processID?: number }) | null;
    return c?.processID ?? null;
  }

  async onModuleInit(): Promise<void> {
    await this.connect(true);
  }

  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const client = this.client;
    this.client = null;
    this.buffer = null;
    this.subject.complete();
    await client?.end().catch(() => undefined);
  }

  private async connect(initial: boolean): Promise<void> {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      application_name: 'task-events-listener',
    });
    let failed = false;
    let established = false;
    const fail = (err?: Error) => {
      if (failed) return;
      failed = true;
      if (this.client === client) this.client = null;
      client.removeAllListeners('notification');
      void client.end().catch(() => undefined);
      if (this.destroyed || !established) return;
      this.logger.warn(
        `listener connection lost${err ? `: ${err.message}` : ''}; reconnecting`,
      );
      this.scheduleReconnect();
    };
    client.on('error', fail);
    client.on('end', () => fail());
    client.on('notification', (msg) => {
      if (msg.channel === TASK_EVENTS_CHANNEL) this.onNotification(msg.payload);
    });

    this.buffer = [];
    try {
      await client.connect();
      await client.query(`LISTEN ${TASK_EVENTS_CHANNEL}`);
      if (this.destroyed) {
        failed = true;
        await client.end().catch(() => undefined);
        return;
      }
      this.client = client;
      if (initial) await this.setBaseline();
      else await this.catchUp();
    } catch (err) {
      failed = true;
      this.buffer = null;
      this.client = null;
      client.removeAllListeners('notification');
      await client.end().catch(() => undefined);
      if (initial || this.destroyed) throw err;
      this.logger.warn(`reconnect failed: ${(err as Error).message}`);
      this.scheduleReconnect();
      return;
    }
    established = true;
    this.backoffMs = INITIAL_BACKOFF_MS;
    this.flush();
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.retryTimer) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect(false);
    }, delay);
  }

  private async setBaseline(): Promise<void> {
    const max = await this.prisma.taskEvent.aggregate({ _max: { id: true } });
    this.lastSeen = Math.max(this.lastSeen, Number(max._max.id ?? 0));
  }

  private async catchUp(): Promise<void> {
    const events = await this.prisma.taskEvent.findMany({
      where: { id: { gt: BigInt(this.lastSeen) } },
      orderBy: { id: 'asc' },
      include: { task: true },
    });
    for (const { task, ...event } of events) {
      this.deliver({ event: toEventDto(event), task: toTaskDto(task) });
    }
  }

  private flush(): void {
    const pending = this.buffer ?? [];
    this.buffer = null;
    pending.sort((a, b) => a.event.id - b.event.id);
    for (const change of pending) this.deliver(change);
  }

  private onNotification(payload: string | undefined): void {
    let change: TaskChange;
    try {
      change = JSON.parse(payload ?? '') as TaskChange;
      if (typeof change?.event?.id !== 'number' || !change.task) {
        throw new Error('missing event or task');
      }
    } catch (err) {
      this.logger.warn(
        `ignoring malformed notification: ${(err as Error).message}`,
      );
      return;
    }
    if (this.buffer) this.buffer.push(change);
    else this.deliver(change);
  }

  private deliver(change: TaskChange): void {
    if (change.event.id <= this.lastSeen) return;
    this.lastSeen = change.event.id;
    this.subject.next(change);
  }
}
