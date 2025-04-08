import { Module } from '@nestjs/common';
import { HttpService } from './http.service';
import { BatchQueueService } from './batch-queue.service';

@Module({
    providers: [HttpService, BatchQueueService],
    exports: [HttpService, BatchQueueService]
})
export class CommonModule {} 