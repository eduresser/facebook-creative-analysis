import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Injectable()
export class DateService {
    private readonly logger = new Logger(DateService.name);

    setupDates(dateStart: string, dateEnd: string, timezoneOffsetHoursUtc: number = -3): any {
        try {
            const initialDate = new Date(dateStart);
            const finalDate = new Date(dateEnd);

            if (isNaN(initialDate.getTime()) || isNaN(finalDate.getTime())) {
                throw new Error('Invalid date format. Please use YYYY-MM-DD');
            }

            const initialDateAdjusted = new Date(initialDate.getTime() + timezoneOffsetHoursUtc * 60 * 60 * 1000);
            const finalDateAdjusted = new Date(finalDate.getTime() + timezoneOffsetHoursUtc * 60 * 60 * 1000);

            const initialDateStr = initialDateAdjusted.toISOString().split('T')[0];
            const finalDateStr = finalDateAdjusted.toISOString().split('T')[0];

            this.logger.debug(`Initial date: ${initialDateStr}, Final date: ${finalDateStr}`);

            return [initialDateStr, finalDateStr];
        } catch (error) {
            this.logger.error(`Error setting up dates: ${error.message}`);
            throw new HttpException(
                `Invalid date format: ${error.message}`,
                HttpStatus.BAD_REQUEST
            );
        }
    }
} 