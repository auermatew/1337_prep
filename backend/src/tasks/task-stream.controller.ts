import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TaskStreamService } from './task-stream.service.js';

/** A resume id counts only as a plain run of digits that is a safe integer. */
export function parseResumeId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

@Controller('tasks')
export class TaskStreamController {
  constructor(private readonly stream: TaskStreamService) {}

  // Declared before the :id routes in TasksController (see TasksModule).
  @Get('stream')
  open(@Req() req: Request, @Res() res: Response): void {
    // The header wins when valid; an invalid header falls back to the query.
    const resumeAfter =
      parseResumeId(req.headers['last-event-id']) ??
      parseResumeId(req.query.after);
    this.stream.attach(req, res, resumeAfter);
  }
}
