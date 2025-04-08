import { Controller, Post, Body, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { FacebookService } from '../services/facebook.service';
import { FacebookCreativeAnalyticsDto } from '../dto/facebook-creative-analytics.dto';

@Controller('facebook/creative-analytics')
export class FacebookCreativeAnalyticsController {
    constructor(private readonly facebookService: FacebookService) {}

    @Post()
    async getCreativeAnalytics(
        @Headers('access-token') accessToken: string,
        @Body() analyticsDto: FacebookCreativeAnalyticsDto
    ) {
        if (!accessToken) {
            throw new HttpException('Access token is required', HttpStatus.UNAUTHORIZED);
        }

        try {
            const { accountId, date_start, date_end, breakdown } = analyticsDto;
            return await this.facebookService.getFacebookCreativeAnalytics(accountId, date_start, date_end, breakdown);
        } catch (error) {
            throw new HttpException(
                {
                    status: 'error',
                    message: error.message || 'An error occurred while fetching Facebook creative analytics',
                    details: error.response?.data || error.response || error
                },
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
} 