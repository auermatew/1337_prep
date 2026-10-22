import { Module } from '@nestjs/common';
import { TaskEventsListener } from './task-events.listener.js';
import { TaskTransitions } from './task-transitions.service.js';

@Module({
  providers: [TaskTransitions, TaskEventsListener],
  exports: [TaskTransitions, TaskEventsListener],
})
export class TasksModule {}
