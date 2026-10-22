import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  TaskChange,
  TaskDto,
  TaskEventDto,
  toEventDto,
  toTaskDto,
} from './task.types.js';

@Injectable()
export class TasksQuery {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<{ tasks: TaskDto[]; lastEventId: number | null }> {
    // RepeatableRead gives both reads one snapshot. Under the default
    // ReadCommitted each statement gets its own, so a change committing
    // between them would be counted in lastEventId but missing from tasks,
    // and a client resuming with ?after=lastEventId would never see it.
    const [tasks, last] = await this.prisma.$transaction(
      async (tx) =>
        Promise.all([
          tx.task.findMany({ orderBy: { startedAt: 'desc' } }),
          tx.taskEvent.aggregate({ _max: { id: true } }),
        ]),
      { isolationLevel: 'RepeatableRead' },
    );
    return {
      tasks: tasks.map(toTaskDto),
      lastEventId: last._max.id === null ? null : Number(last._max.id),
    };
  }

  /**
   * Events with id > `after`, oldest first, each with its task's current row,
   * plus the resume point to dedupe against. Both reads share one snapshot.
   * An `after` beyond the newest event id is stale or bogus: it comes back as
   * `resume: null` with nothing replayed, so it can't later suppress live
   * events that are numerically below it.
   */
  async replay(
    after: number,
  ): Promise<{ resume: number | null; changes: TaskChange[] }> {
    const [events, last] = await this.prisma.$transaction(
      async (tx) =>
        Promise.all([
          tx.taskEvent.findMany({
            where: { id: { gt: BigInt(after) } },
            orderBy: { id: 'asc' },
            include: { task: true },
          }),
          tx.taskEvent.aggregate({ _max: { id: true } }),
        ]),
      { isolationLevel: 'RepeatableRead' },
    );
    const max = Number(last._max.id ?? 0);
    if (after > max) return { resume: null, changes: [] };
    return {
      resume: after,
      changes: events.map(({ task, ...event }) => ({
        event: toEventDto(event),
        task: toTaskDto(task),
      })),
    };
  }

  /** Events of one task, oldest first; null when the task doesn't exist. */
  async events(taskId: string): Promise<TaskEventDto[] | null> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true },
    });
    if (!task) return null;
    const events = await this.prisma.taskEvent.findMany({
      where: { taskId },
      orderBy: { id: 'asc' },
    });
    return events.map(toEventDto);
  }

  async exists(taskId: string): Promise<boolean> {
    return (await this.prisma.task.count({ where: { id: taskId } })) > 0;
  }
}
