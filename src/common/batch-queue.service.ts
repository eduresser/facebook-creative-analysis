import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BatchQueueService {
    private queue: any[] = [];

    addToQueue(items: any[]) {
        this.queue.push(items);
        this.queue = this.splitIntoBatches(this.queue.flat());
    }

    getNextBatches(): any[][] {
        return this.queue.splice(0, this.queue.length);
    }

    hasItems(): boolean {
        return this.queue.length > 0;
    }

    private splitIntoBatches(arr: any[], size = 50): any[][] {
        return Array.from(
            { length: Math.ceil(arr.length / size) },
            (_, i) => arr.slice(i * size, (i + 1) * size)
        );
    }
} 