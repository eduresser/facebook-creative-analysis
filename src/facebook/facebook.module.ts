import { Module } from '@nestjs/common';
import { FacebookCreativeAnalyticsController } from './controllers/facebook-creative-analytics.controller';
import { FacebookService } from './services/facebook.service';
import { FacebookBatchRequestsService } from './services/facebook-batch-requests.service';
import { FacebookConstantsService } from './services/facebook-constants.service';
import { FacebookCreativeService } from './services/facebook-creative.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [FacebookCreativeAnalyticsController],
  providers: [
    FacebookService,
    FacebookBatchRequestsService,
    FacebookConstantsService,
    FacebookCreativeService
  ],
  exports: [FacebookService]
})
export class FacebookModule {} 