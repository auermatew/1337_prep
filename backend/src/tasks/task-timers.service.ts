import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Subscription } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { TaskEventsListener } from './task-events.listener.js';
import { TaskTransitions } from './task-transitions.service.js';
import { TaskChange } from './task.types.js';

const RETRY_DELAY_MS = 1000;

/**
 * Per-process timers that finish running tasks when they expire. Every
 * process arms a timer for every running task; the conditional transition
 * guarantees only one of them records the `finished` event.
 */
@Injectable()
export class TaskTimers implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TaskTimers.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly subscription: Subscription;
  // Tasks whose timer fired and whose transition is still in flight.
  private readonly firing = new Map<string, { cleared: boolean }>();
  private destroyed = false;
  // While recovery runs: ids that already got a change through changes$.
  private touched: Set<string> | null = null;

  constructor(
    private readonly listener: TaskEventsListener,
    private readonly transitions: TaskTransitions,
    private readonly prisma: PrismaService,
  ) {
    // Subscribe before recovery reads, so nothing falls between the two.
    this.subscription = this.listener.changes$.subscribe((change) =>
      this.onChange(change),
    );
  }

  armedCount(): number {
    return this.timers.size;
  }

  async onApplicationBootstrap(): Promise<void> {
    this.touched = new Set();
    try {
      const running = await this.prisma.task.findMany({
        where: { state: 'running' },
      });
      if (this.destroyed) return;
      for (const task of running) {
        if (this.touched.has(task.id)) continue;
        this.arm(task.id, task.endsAt.getTime() - Date.now());
      }
    } finally {
      this.touched = null;
    }
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    this.subscription.unsubscribe();
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  private onChange({ task }: TaskChange): void {
    this.touched?.add(task.id);
    if (task.state === 'running') {
      this.arm(task.id, new Date(task.endsAt).getTime() - Date.now());
    } else {
      this.clear(task.id);
      const inFlight = this.firing.get(task.id);
      if (inFlight) inFlight.cleared = true;
    }
  }

  private arm(taskId: string, delayMs: number): void {
    if (this.destroyed) return;
    this.clear(taskId);
    const timer = setTimeout(
      () => void this.fire(taskId),
      Math.max(0, delayMs),
    );
    this.timers.set(taskId, timer);
  }

  private clear(taskId: string): void {
    const timer = this.timers.get(taskId);
    if (timer) clearTimeout(timer);
    this.timers.delete(taskId);
  }

  private async fire(taskId: string): Promise<void> {
    this.timers.delete(taskId);
    const state = { cleared: false };
    this.firing.set(taskId, state);
    try {
      // null means someone else finished or cancelled it first: nothing to do.
      await this.transitions.transition(taskId, 'finished');
    } catch (err) {
      if (this.destroyed || state.cleared) return;
      this.logger.warn(
        `finishing task ${taskId} failed: ${(err as Error).message}; retrying`,
      );
      this.arm(taskId, RETRY_DELAY_MS);
    } finally {
      if (this.firing.get(taskId) === state) this.firing.delete(taskId);
    }
  }
}
