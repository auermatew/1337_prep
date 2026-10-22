import { Module } from '@nestjs/common';
import { TaskTransitions } from './task-transitions.service.js';

@Module({
  providers: [TaskTransitions],
  exports: [TaskTransitions],
})
export class TasksModule {}
