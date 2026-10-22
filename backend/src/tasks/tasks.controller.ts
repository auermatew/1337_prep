import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CreateTaskDto } from './create-task.dto.js';
import { TaskDto, TaskEventDto } from './task.types.js';
import { TaskTransitions } from './task-transitions.service.js';
import { TasksQuery } from './tasks.query.js';

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly transitions: TaskTransitions,
    private readonly query: TasksQuery,
  ) {}

  @Post()
  async create(@Body() dto: CreateTaskDto): Promise<TaskDto> {
    return (await this.transitions.create(dto)).task;
  }

  @Get()
  list(): Promise<{ tasks: TaskDto[]; lastEventId: number | null }> {
    return this.query.list();
  }

  @Get(':id/events')
  async events(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TaskEventDto[]> {
    const events = await this.query.events(id);
    if (!events) throw new NotFoundException('Task not found');
    return events;
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@Param('id', new ParseUUIDPipe()) id: string): Promise<TaskDto> {
    const change = await this.transitions.transition(id, 'cancelled');
    if (change) return change.task;
    if (!(await this.query.exists(id))) {
      throw new NotFoundException('Task not found');
    }
    throw new ConflictException('Task is not running');
  }
}
