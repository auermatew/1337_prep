import { Module } from '@nestjs/common';
import { TaskEventsListener } from './task-events.listener.js';
import { TaskTimers } from './task-timers.service.js';
import { TaskTransitions } from './task-transitions.service.js';
import { TasksController } from './tasks.controller.js';
import { TasksQuery } from './tasks.query.js';

@Module({
  controllers: [TasksController],
  providers: [TaskTransitions, TaskEventsListener, TaskTimers, TasksQuery],
  exports: [TaskTransitions, TaskEventsListener, TaskTimers, TasksQuery],
})
export class TasksModule {}
