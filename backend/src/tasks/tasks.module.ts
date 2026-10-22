import { Module } from '@nestjs/common';
import { TaskEventsListener } from './task-events.listener.js';
import { TaskTimers } from './task-timers.service.js';
import { TaskTransitions } from './task-transitions.service.js';
import { TaskStreamController } from './task-stream.controller.js';
import { TaskStreamService } from './task-stream.service.js';
import { TasksController } from './tasks.controller.js';
import { TasksQuery } from './tasks.query.js';

@Module({
  controllers: [TaskStreamController, TasksController],
  providers: [
    TaskTransitions,
    TaskEventsListener,
    TaskTimers,
    TasksQuery,
    TaskStreamService,
  ],
  exports: [TaskTransitions, TaskEventsListener, TaskTimers, TasksQuery],
})
export class TasksModule {}
