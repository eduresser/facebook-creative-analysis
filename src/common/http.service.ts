import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosResponse } from 'axios';

@Injectable()
export class HttpService {
    private readonly logger = new Logger(HttpService.name);

    async persistentRequest(
        request: () => Promise<AxiosResponse>,
        timeLimit: number = 30000,
        delay: number = 1000
    ): Promise<any> {
        const startTime = Date.now();
        const endTime = startTime + timeLimit;

        while (Date.now() < endTime) {
            try {
                return await request();
            } catch (error) {
                const remainingTime = endTime - Date.now();
                if (this.isUserError(error)) {
                    this.logger.error(
                        `[persistentRequest] Request failed due to client error: ${error.response?.status} - ${error.response?.statusText}`
                    );
                    this.handleError(error);
                }

                if (remainingTime <= 0) {
                    this.logger.error(
                        `[persistentRequest] Request timed out after ${timeLimit}ms. URL: ${error.config?.url}`
                    );
                    throw new HttpException(
                        {
                            error: {
                                message: 'Request timed out',
                                url: error.config?.url,
                                method: error.config?.method,
                                elapsedTime: `${Date.now() - startTime}ms`,
                                response: error.response?.data,
                            },
                        },
                        HttpStatus.REQUEST_TIMEOUT
                    );
                }

                this.logger.warn(
                    `[persistentRequest] Request attempt failed. Retrying in ${delay}ms. Elapsed time: ${Date.now() - startTime}ms. Remaining time: ${remainingTime}ms.`
                );
                await this.delay(delay);
            }
        }

        throw new HttpException(
            {
                message: 'Request timed out',
            },
            HttpStatus.REQUEST_TIMEOUT
        );
    }

    private isUserError(error: any): boolean {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            return axiosError.response !== undefined && 
                   axiosError.response.status >= 400 &&
                   axiosError.response.status < 500;
        }
        return false;
    }

    private handleError(error: any): never {
        if (axios.isAxiosError(error) && error.response) {
            this.logger.error(
                `[handleError] HTTP Error: ${error.response.status} - ${error.response.statusText}. URL: ${error.config?.url}`
            );
            throw new HttpException(
                {
                    error: {
                        message: 'Error during HTTP request.',
                        url: error.config?.url,
                        method: error.config?.method,
                        body: error.config ? this.parseData(error.config.data) : {},
                        response: error.response.data,
                        status: error.response.status,
                        statusText: error.response.statusText
                    },
                },
                HttpStatus.BAD_REQUEST
            );
        }

        this.logger.error(
            `[handleError] Unexpected error: ${error.message}. URL: ${error.config?.url}`
        );
        throw new HttpException(
            {
                error: {
                    message: 'Unexpected error occurred during HTTP request.',
                    method: error.config?.method,
                    url: error.config?.url,
                    details: error.message,
                },
            },
            HttpStatus.INTERNAL_SERVER_ERROR
        );
    }

    private parseData(data: any): any {
        try {
            return JSON.parse(data || '{}');
        } catch {
            return {};
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
} 