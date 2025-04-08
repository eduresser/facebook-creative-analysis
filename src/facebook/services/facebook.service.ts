import { Injectable, Logger } from '@nestjs/common';
import { FacebookBatchRequestsService } from './facebook-batch-requests.service';
import { FacebookConstantsService } from './facebook-constants.service';
import { FacebookCreativeService } from './facebook-creative.service';

@Injectable()
export class FacebookService {
    private readonly logger = new Logger(FacebookService.name);
    private commonParams?: any;

    constructor(
        private readonly facebookBatchRequestsService: FacebookBatchRequestsService,
        private readonly facebookConstantsService: FacebookConstantsService,
        private readonly facebookCreativeService: FacebookCreativeService
    ) {}

    async getCommonParams(): Promise<any> {
        if (!this.commonParams) {
            const dateStart = this.facebookConstantsService.getInfo('date_start');
            const dateEnd = this.facebookConstantsService.getInfo('date_end');
            const [ since, until ] = [dateStart, dateEnd];
            const timeRange = JSON.stringify({ since, until });
            this.commonParams = { 'limit': 200, 'time_range': timeRange };
        }

        return this.commonParams;
    }

    async getCampaigns(params?: any): Promise<any[]> {
        const accountId = this.facebookConstantsService.getInfo('accountId');
        this.logger.log(`Getting campaigns for account ${accountId}.`);
        if (!params) {
            params = {
                ...(await this.getCommonParams()),
                fields: 'campaigns.limit(200){account_id,id,name}',
                filtering: JSON.stringify([{ field: 'impressions', operator: 'GREATER_THAN', value: 0 }])
            }
        }
    
        const queue = [ this.facebookBatchRequestsService.buildRelativeUrl(accountId, params) ]
        const campaigns = await this.facebookBatchRequestsService.getDataInBatch('GET', queue, ['campaigns', 'data']);
        const distinctCampaigns = Array.from(new Set(campaigns.map(item => JSON.stringify(item))))
            .map((item: any) => JSON.parse(item));

        this.logger.log(`${distinctCampaigns.length} distinct campaigns fetched.`);

        return distinctCampaigns;
    }

    async getAdsetsFromCampaigns(campaigns: any[], params?: any): Promise<any[]> {
        this.logger.log(`Getting adsets for ${campaigns.length} campaigns.`);
    
        if (!params) {
            params = {
                ...(await this.getCommonParams()),
                fields: 'adsets.limit(200){campaign_id,id,name,promoted_object}'
            }
        }
    
        const queue = campaigns.map((campaign: any) => this.facebookBatchRequestsService.buildRelativeUrl(campaign.id, params));
        const adsets = await this.facebookBatchRequestsService.getDataInBatch('GET', queue, ['adsets', 'data']);
        const distinctAdsets = Array.from(new Set(adsets.map(item => JSON.stringify(item))))
            .map((item: any) => JSON.parse(item));
    
        this.logger.log(`${distinctAdsets.length} distinct adsets fetched.`);
        
        return distinctAdsets;
    }

    async getAdsFromAdsets(adsets: any[], params?: any): Promise<any[]> {
        this.logger.log(`Getting ads for ${adsets.length} adsets.`);

        if (!params) {
            params = {
                ...(await this.getCommonParams()),
                fields: 'ads.limit(200){adset_id,id,name,creative}'
            }
        }

        const queue = adsets.map((adset: any) => this.facebookBatchRequestsService.buildRelativeUrl(adset.id, params));
        const ads = await this.facebookBatchRequestsService.getDataInBatch('GET', queue, ['ads', 'data']);
        const distinctAds = Array.from(new Set(ads.map(item => JSON.stringify(item))))
            .map((item: any) => JSON.parse(item));

        this.logger.log(`${distinctAds.length} distinct ads fetched.`);

        return distinctAds;
    }

    async getAdsInsights(ads: any[], params?: any) {
        this.logger.log(`Getting insights for ${ads.length} ads.`);

        if (!params) {
            params = {
                ...(await this.getCommonParams()),
                fields: 'spend,impressions,clicks,conversions,conversion_values,actions,video_thruplay_watched_actions,estimated_ad_recallers',
                time_increment: 1
            }
        }

        const queue = ads.map((ad: any) => this.facebookBatchRequestsService.buildRelativeUrl(`${ad.id}/insights`, params));
        const insights = await this.facebookBatchRequestsService.getDataInBatch('GET', queue, ['data'], false);

        this.logger.log(`Ads with performance data: ${Object.keys(insights).length} (${Math.round(Object.keys(insights).length / ads.length * 100)}%)`);

        return insights;
    }

    async getCreativesFromAds(ads: any[], params?: any): Promise<any[]> {
        this.logger.log(`Getting creatives for ${ads.length} ads.`);
        const adsWithCreatives = ads.filter((ad: any) => ad.creative);

        this.logger.log(`Ads with creatives: ${adsWithCreatives.length} (${Math.round(adsWithCreatives.length / ads.length * 100)}%)`);

        if (!params) {
            params = {
                ...(await this.getCommonParams()),
                fields: 'creative.limit(200){id,name,asset_feed_spec,object_story_spec,effective_instagram_media_id,effective_instagram_story_id}'
            }
        }

        const queue = adsWithCreatives.map((ad: any) => this.facebookBatchRequestsService.buildRelativeUrl(ad.id, params));
        const creatives = await this.facebookBatchRequestsService.getDataInBatch('GET', queue, ['creative']);
        const distinctCreatives = Array.from(new Set(creatives.map((item: any) => JSON.stringify(item))))
            .map((item: any) => JSON.parse(item));

        this.logger.log(`${distinctCreatives.length} distinct creatives fetched.`);

        return distinctCreatives;
    }

    extractAssetsFromCreatives(creatives: any[]) {
        return this.facebookCreativeService.extractAssetsFromCreatives(creatives);
    }

    async getAdsInsightsBreakdown(ads: any[], assets: any[], breakdowns: any[], params?: any): Promise<any> {
        if (!params) {
            params = {
                ...(await this.getCommonParams()),
                fields: 'spend,impressions,clicks,conversions,conversion_values,actions,video_thruplay_watched_actions,estimated_ad_recallers'
            }
        }

        const queues = await this.facebookCreativeService.createAdsInsightsQueueFromAssets(
            ads, assets, breakdowns, params
        );

        const insights = {}

        this.logger.log(`Getting insights for ${ads.length} ads and ${assets.length} assets.`);
        await Promise.all(
            Object.entries(queues).map(async ([queueType, queueItems]: [string, any]) => {
                insights[queueType] = await this.facebookBatchRequestsService.getDataInBatch(
                    'GET',
                    queueItems as string[],
                    ['insights', 'data'],
                    false,
                    `Total ${queueType} records fetched`
                );
            })
        )

        return insights;
    }

    async getImagesFromCreatives(creatives: any[]) {
        const imageHashesByCreative = this.facebookCreativeService.getImageHashesByCreative(creatives)
        const imageHashes = [...new Set(Object.values(imageHashesByCreative).flat())]

        this.logger.log(`Fetching images for ${imageHashes.length} hashes.`);

        const batchSize = 200;
        
        const imageQueues: string[] = [];
        for (let i = 0; i < imageHashes.length; i += batchSize) {
            const batchHashes = imageHashes.slice(i, i + batchSize);
            const imageQueue = this.facebookBatchRequestsService.buildRelativeUrl(
                `${this.facebookConstantsService.getInfo('accountId')}/adimages`,
                {
                    fields: 'hash,name,permalink_url',
                    limit: batchSize,
                    hashes: JSON.stringify(batchHashes),
                }
            );
            
            imageQueues.push(imageQueue);
        }
        
        const images = await this.facebookBatchRequestsService.getDataInBatch('GET', imageQueues, ['data'])
        const imagesByHash = images.reduce((acc: any, image: any) => {
            const { hash, name, permalink_url } = image;
            acc[hash] = { hash, url: permalink_url, name };
            return acc;
        }, {});

        return Object.fromEntries(Object.entries(imageHashesByCreative).map(([creativeId, hashes]) => 
            [creativeId, hashes.map((hash: string) => imagesByHash[hash]).filter((data: any) => data)]
        ).filter(([_, data]: [string, any]) => data.length > 0));
    }

    async getVideosFromCreatives(creatives: any[]) {
        const videoIdsByCreative = this.facebookCreativeService.getVideoIdsByCreative(creatives);
        const videoIds = [...new Set(Object.values(videoIdsByCreative).flat())]

        this.logger.log(`Fetching videos for ${videoIds.length} ids.`);
        const queue = videoIds.map((videoId: any) => this.facebookBatchRequestsService.buildRelativeUrl(videoId, {
            fields: 'id,title,description,permalink_url,source',
        }));

        const videos = await this.facebookBatchRequestsService.getDataInBatch('GET', queue, ['video']);
        const videosById = videos.reduce((acc: any, video: any) => {
            acc[video.id] = video;
            return acc;
        }, {});

        return Object.fromEntries(Object.entries(videoIdsByCreative).map(([creativeId, videoIds]) => 
            [creativeId, videoIds.map((videoId: string) => videosById[videoId])]
        ));
    }

    async getFacebookCreativeAnalytics(accountId: string, dateStart: string, dateEnd: string, breakdown: string[]): Promise<any> {
        try {
            const campaigns = await this.getCampaigns();
            const adsets = await this.getAdsetsFromCampaigns(campaigns);
            const ads = await this.getAdsFromAdsets(adsets);
            const creatives = await this.getCreativesFromAds(ads);
            const assets = this.extractAssetsFromCreatives(creatives);
            const insights = await this.getAdsInsightsBreakdown(ads, assets, breakdown);
            
            return {
                status: 'success',
                data: {
                    insights,
                    metadata: {
                        campaigns: campaigns.length,
                        adsets: adsets.length,
                        ads: ads.length,
                        creatives: creatives.length,
                        assets: assets.length
                    }
                }
            };
        } catch (error) {
            this.logger.error(`Error fetching Facebook creative analytics: ${error.message}`);
            throw error;
        }
    }
} 