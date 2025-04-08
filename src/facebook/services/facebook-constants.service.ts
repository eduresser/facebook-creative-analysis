import { Injectable, Scope, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Injectable({ scope: Scope.REQUEST })
export class FacebookConstantsService {
    private requestInfos: any;

    constructor(@Inject(REQUEST) private readonly request: Request) {
        this.requestInfos = this.getRequestInfos();
    }

    private getRequestInfos(): any {
        const token = this.request?.headers?.['access-token'] as string;
        const { accountId, date_start, date_end, breakdown } = this.request?.body;

        if (!token) {
            throw new HttpException('Access token is required', HttpStatus.UNAUTHORIZED);
        }

        if (!accountId) {
            throw new HttpException('Account ID is required', HttpStatus.BAD_REQUEST);
        }

        if (!date_start) {
            throw new HttpException('Date start is required', HttpStatus.BAD_REQUEST);
        }

        if (!date_end) {
            throw new HttpException('Date end is required', HttpStatus.BAD_REQUEST);
        }

        if (!breakdown) {
            throw new HttpException('Breakdown is required', HttpStatus.BAD_REQUEST);
        }

        return {
            token,
            accountId,
            date_start,
            date_end,
            breakdown,
            baseUrl: 'https://graph.facebook.com/v22.0'
        };
    }

    getInfo(path: string): any {
        return this.requestInfos[path];
    }
} 