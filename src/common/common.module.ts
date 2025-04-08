import { Module } from '@nestjs/common';
import { HttpService } from './http.service';
import { BatchQueueService } from './batch-queue.service';
import { DateService } from './date.service';

@Module({
  providers: [HttpService, BatchQueueService, DateService],
  exports: [HttpService, BatchQueueService, DateService]
})
export class CommonModule {} 