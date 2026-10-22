import { Injectable } from '@nestjs/common';
import { Prisma, Task } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  TASK_EVENTS_CHANNEL,
  TaskChange,
  toEventDto,
  toTaskDto,
} from './task.types.js';

// Serialises all transitions so event ids are assigned in commit order.
const TRANSITION_LOCK_KEY = 4242001;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class TaskTransitions {
  constructor(private readonly prisma: PrismaService) {}

  create(input: {
    name: string;
    durationSeconds: number;
  }): Promise<TaskChange> {
    return this.record(async (tx, now) => {
      return tx.task.create({
        data: {
          name: input.name,
          durationSeconds: input.durationSeconds,
          state: 'running',
          startedAt: now,
          endsAt: new Date(now.getTime() + input.durationSeconds * 1000),
          updatedAt: now,
        },
      });
    }) as Promise<TaskChange>;
  }

  async transition(
    taskId: string,
    to: 'finished' | 'cancelled',
  ): Promise<TaskChange | null> {
    if (!UUID_RE.test(taskId)) return null;
    return this.record(async (tx, now) => {
      try {
        return await tx.task.update({
          where: { id: taskId, state: 'running' },
          data: { state: to, updatedAt: now },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2025'
        ) {
          return null;
        }
        throw e;
      }
    });
  }

  private record(
    write: (tx: Prisma.TransactionClient, now: Date) => Promise<Task | null>,
  ): Promise<TaskChange | null> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TRANSITION_LOCK_KEY})`;
        const now = new Date();
        const task = await write(tx, now);
        if (!task) return null;
        const event = await tx.taskEvent.create({
          data: { taskId: task.id, state: task.state, at: now },
        });
        const change: TaskChange = {
          event: toEventDto(event),
          task: toTaskDto(task),
        };
        await tx.$executeRaw`SELECT pg_notify(${TASK_EVENTS_CHANNEL}, ${JSON.stringify(change)})`;
        return change;
      },
      { maxWait: 10_000, timeout: 10_000 },
    );
  }
}
