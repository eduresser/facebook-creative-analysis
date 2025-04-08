import { Injectable, Scope, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Injectable({ scope: Scope.REQUEST })
export class FacebookConstantsService {
    private requestInfos: any;

    constructor(@Inject(REQUEST) private readonly request: Request) {
        this.requestInfos = this.getRequestInfos();
    }

    private isValidDate(dateString: string): boolean {
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date.getTime());
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

        if (!date_start || !this.isValidDate(date_start)) {
            throw new HttpException('Date start is required and must be a valid date', HttpStatus.BAD_REQUEST);
        }

        let finalDateEnd = date_end;
        if (!date_end || !this.isValidDate(date_end)) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            finalDateEnd = yesterday.toISOString().split('T')[0];
        }

        if (!breakdown) {
            throw new HttpException('Breakdown is required', HttpStatus.BAD_REQUEST);
        }

        return {
            token,
            accountId,
            date_start,
            date_end: finalDateEnd,
            breakdown,
            baseUrl: 'https://graph.facebook.com/v22.0'
        };
    }

    getInfo(path: string): any {
        return this.requestInfos[path];
    }
} 