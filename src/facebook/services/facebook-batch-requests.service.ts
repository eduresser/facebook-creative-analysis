import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { HttpService } from '../../common/http.service';
import { BatchQueueService } from '../../common/batch-queue.service';
import { FacebookConstantsService } from './facebook-constants.service';

interface RequestItem {
    method: string;
    relative_url: string;
}

@Injectable()
export class FacebookBatchRequestsService {
    private readonly logger = new Logger(FacebookBatchRequestsService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly batchQueue: BatchQueueService,
        private readonly facebookConstantsService: FacebookConstantsService
    ) {}

    buildRelativeUrl(prefix: string, params: any = {}) {
        const paramsString = Object.entries(params).map(entry => entry.join('=')).join('&');
        return `${prefix}?${paramsString}`;
    }

    async getDataInBatch(
        method: 'GET' | 'POST',
        relativeUrls: string[],
        dataPath: string[] = [],
        returnAsArray: boolean = true,
        customLogMessage?: string
    ): Promise<any> {
        const initialBatch = relativeUrls.map(url => ({ method, relative_url: url }));
        this.batchQueue.addToQueue(initialBatch);
        
        const data = returnAsArray ? [] : {};
        while (this.batchQueue.hasItems()) {
            await this.processCurrentBatches(data, dataPath, returnAsArray, customLogMessage);
        }

        return data;
    }

    private async processCurrentBatches(
        data: any,
        dataPath?: string[],
        returnAsArray: boolean = true,
        customLogMessage?: string
    ) {
        const batches = this.batchQueue.getNextBatches();
        await Promise.all(
            batches.map(batch => 
                this.processBatch(data, batch, dataPath, returnAsArray, customLogMessage)
            )
        );
    }

    private async processBatch(
        data: any,
        batch: RequestItem[],
        dataPath: string[] = [],
        returnAsArray: boolean = true,
        customLogMessage?: string
    ) {
        try {
            const response = await this.httpService.persistentRequest(() =>
                axios.post(this.facebookConstantsService.getInfo('baseUrl'), {
                    batch, access_token: this.facebookConstantsService.getInfo('token')
                })
            );

            const newRequests = [];
            const retryableItems = [];
            const unsolvableItems = [];

            for (const idx in response.data) {
                const item = response.data[idx];
                const result = JSON.parse(item.body);
                const originalRequest = batch[idx];

                if (item.code === 200) {
                    this.handlePaginatedRequests(result, dataPath.slice(0, -1), newRequests);
                    this.accumulateData(data, originalRequest, result, dataPath, returnAsArray);
                } else {
                    this.handleItemError(item, originalRequest, retryableItems, unsolvableItems);
                }
            }

            this.logProgress(data, returnAsArray, customLogMessage);
            await this.handleRetries(data, retryableItems, dataPath, customLogMessage, returnAsArray);
            this.handlePagination(newRequests);

            if (unsolvableItems.length > 0) {
                throw new HttpException({
                    error: {
                        message: `Some items in the current batch request were not fetched because of an error.`,
                        items: unsolvableItems
                    }
                }, HttpStatus.BAD_REQUEST);
            }

        } catch (error) {
            const errorResponse = error.response || {};
            throw new HttpException(errorResponse, HttpStatus.BAD_REQUEST);
        }
    }

    private handlePaginatedRequests(
        result: any,
        dataPath: string[] = [],
        newRequests: RequestItem[]
    ) {
        let content = result;
        if (dataPath.length === 0) {
            if (Array.isArray(content)) {
                content.forEach(item => this.checkPagination(item, newRequests));
            } else {
                this.checkPagination(content, newRequests);
            }
            return;
        }
    
        const [currentPath, ...remainingPath] = dataPath;
    
        if (!content || typeof content !== 'object') {
            return;
        }
    
        if (Array.isArray(content)) {
            content.forEach(item => this.handlePaginatedRequests(item, dataPath, newRequests));
        } else {
            this.handlePaginatedRequests(content[currentPath] || content, remainingPath, newRequests);
        }
    }

    private checkPagination(content: any, newRequests: RequestItem[]) {
        const nextUrl = content?.paging?.next;
        if (nextUrl) {
            const urlObject = new URL(nextUrl);
            const path = urlObject.pathname.replace(/^\/v[\d.]+\//, '');

            const params = new URLSearchParams(urlObject.search);
            params.delete('access_token');

            const newQuery = params.toString();
            const relativeUrl = `${path}?${newQuery}`;

            newRequests.push({ 
                method: 'GET', 
                relative_url: relativeUrl 
            });
        }
    }

    private accumulateData(
        data: any,
        originalRequest: RequestItem,
        result: any,
        dataPath: string[] = [],
        returnAsArray: boolean = true
    ): void {
        let content = result;
        for (const path of dataPath) {
            if (Array.isArray(content)) {
                const tempContent = content.map((item: any) => item?.[path]).flat();
                const allItemsAreUndefined = tempContent.every((item: any) => item === undefined);
                if (!allItemsAreUndefined) {
                    content = tempContent.filter((item: any) => item !== undefined);
                }
            } else {
                const tempContent = content?.[path];
                if (tempContent !== undefined) {
                    content = tempContent;
                }
            }
        }

        if (returnAsArray) {
            if (Array.isArray(content)) {
                data.push(...content);
            } else if (content !== undefined) {
                data.push(content);
            }
        } else {
            const id = originalRequest.relative_url.split('/')[0];
            if (content.length > 0) data[id] = content;
        }
    }

    private handleItemError(
        item: any,
        originalRequest: RequestItem,
        retryableItems: RequestItem[],
        unsolvableItems: any[]
    ): void {
        const response = JSON.parse(item.body);
        if (response.error?.code === 960) {
            retryableItems.push(originalRequest);
        } else {
            unsolvableItems.push({ originalRequest, response });
        }
    }

    private handlePagination(newRequests: RequestItem[]) {
        if (newRequests.length > 0) {
            this.logger.debug(`Adding ${newRequests.length} requests to queue.`);
            this.batchQueue.addToQueue(newRequests);
        }
    }

    private async handleRetries(
        data: any,
        retryableItems: RequestItem[],
        dataPath: string[] = [],
        customLogMessage?: string,
        returnAsArray: boolean = true
    ) {
        if (retryableItems.length > 0) {
            this.logger.debug(`Splitting ${retryableItems.length} requests into 2 batches due to timeout.`);
            const batches = this.splitBatch(retryableItems);
            
            await Promise.all(
                batches.map(batch => 
                    this.processBatch(data, batch, dataPath, returnAsArray, customLogMessage)
                )
            );
        }
    }

    private splitBatch(batch: RequestItem[]): RequestItem[][] {
        const mid = Math.ceil(batch.length / 2);
        return [batch.slice(0, mid), batch.slice(mid)];
    }

    private logProgress(data: any, returnAsArray: boolean, customLogMessage?: string) {
        const count = returnAsArray ? data.length : Object.keys(data).length;
        this.logger.debug(`${customLogMessage || 'Total records fetched'}: ${count}`);
    }
} 