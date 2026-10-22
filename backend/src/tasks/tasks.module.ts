import { Module } from '@nestjs/common';
import { TaskEventsListener } from './task-events.listener.js';
import { TaskTimers } from './task-timers.service.js';
import { TaskTransitions } from './task-transitions.service.js';

@Module({
  providers: [TaskTransitions, TaskEventsListener, TaskTimers],
  exports: [TaskTransitions, TaskEventsListener, TaskTimers],
})
export class TasksModule {}
