import { Injectable, Logger } from '@nestjs/common';
import { FacebookBatchRequestsService } from './facebook-batch-requests.service';

@Injectable()
export class FacebookCreativeService {
    private readonly logger = new Logger(FacebookCreativeService.name);

    constructor(
        private readonly facebookBatchRequestsService: FacebookBatchRequestsService
    ) {}

    private isCarousel(creative: any) {
        const { asset_feed_spec, object_story_spec } = creative;
        return (
            asset_feed_spec?.ad_formats?.includes('CAROUSEL') ||
            object_story_spec?.link_data?.child_attachments?.length > 0
        );
    };
    
    private hasMultiplePlacements(rules: any) {
        if (!rules) return false;
        const labelTypes = ['carousel_label', 'image_label', 'video_label'];
        return labelTypes.some(type => 
            new Set(rules.map((rule: any) => rule[type]?.id)).size > 1
        );
    };
    
    private extractIds(items: any, key: string) {
        return items?.map((item: any) => item?.[key]);
    };

    extractAssetsFromCreatives(creatives: any) {
        return Object.values(creatives).map((creative: any) => {
            const { id, asset_feed_spec, object_story_spec, effective_instagram_media_id, effective_instagram_story_id } = creative;
            return {
                creativeId: id,
                isCarousel: this.isCarousel(creative),
                hasBody: Boolean(asset_feed_spec?.bodies) ||
                    Boolean(object_story_spec?.image_data?.message) ||
                    Boolean(object_story_spec?.video_data?.message),
                hasCallToAction: Boolean(asset_feed_spec?.call_to_action_types) ||
                    Boolean(object_story_spec?.image_data?.call_to_action) ||
                    Boolean(object_story_spec?.video_data?.call_to_action),
                hasDescription: Boolean(asset_feed_spec?.descriptions) ||
                    Boolean(object_story_spec?.image_data?.link_description) ||
                    Boolean(object_story_spec?.video_data?.link_description),
                hasLinkUrl: Boolean(asset_feed_spec?.link_urls) ||
                    Boolean(object_story_spec?.image_data?.call_to_action?.value?.link) ||
                    Boolean(object_story_spec?.video_data?.call_to_action?.value?.link),
                hasTitle: Boolean(asset_feed_spec?.titles) ||
                    Boolean(object_story_spec?.image_data?.title) ||
                    Boolean(object_story_spec?.video_data?.title),
                hasMultiplePlacements: this.hasMultiplePlacements(asset_feed_spec?.asset_customization_rules),
                assetFeedImageHashes: this.extractIds(asset_feed_spec?.images, 'hash'),
                assetFeedVideoIds: this.extractIds(asset_feed_spec?.videos, 'video_id'),
                objectStoryImageHash: object_story_spec?.photo_data?.image_hash,
                objectStoryVideoId: object_story_spec?.video_data?.video_id,
                objectStoryChildAttachments: object_story_spec?.link_data?.child_attachments?.map((attachment: any) => ({
                    'id': attachment.video_id || attachment.image_hash,
                    'type': attachment.video_id ? 'video_id' : 'image_hash'
                })),
                effectiveInstagramMediaId: effective_instagram_media_id,
                effectiveInstagramStoryId: effective_instagram_story_id
            }
        })
    }

    async createAdsInsightsQueueFromAssets(
        ads: any[],
        assets: any[],
        breakdowns: any[],
        params: any
    ) {
        const assetsByCreativeId = assets.reduce((acc: any, asset: any) => {
            acc[asset.creativeId] = asset;
            return acc;
        }, {});

        const queues: any = {};

        for (const ad of ads) {
            const insightPath = `${ad.id}/insights`;
            const creativeId = ad?.creative?.id;
            const creative = assetsByCreativeId[creativeId];

            if (creative?.hasMultiplePlacements) {
                if (breakdowns.includes('image_asset') && creative.assetFeedImageHashes) {
                    if (!queues.image_asset) queues.image_asset = [];
                    queues.image_asset.push(this.facebookBatchRequestsService.buildRelativeUrl(insightPath, {
                        ...params,
                        breakdowns: 'image_asset',
                        time_increment: 1
                    }));
                }

                if (breakdowns.includes('video_asset') && creative.assetFeedVideoIds) {
                    if (!queues.video_asset) queues.video_asset = [];
                    queues.video_asset.push(this.facebookBatchRequestsService.buildRelativeUrl(insightPath, {
                        ...params,
                        breakdowns: 'video_asset',
                        time_increment: 1
                    }));
                }
            }

            if (breakdowns.includes('body_asset') && creative?.hasBody) {
                if (!queues.body_asset) queues.body_asset = [];
                queues.body_asset.push(this.facebookBatchRequestsService.buildRelativeUrl(insightPath, {
                    ...params,
                    breakdowns: 'body_asset',
                    time_increment: 1
                }));
            }

            if (breakdowns.includes('call_to_action_asset') && creative?.hasCallToAction) {
                if (!queues.call_to_action_asset) queues.call_to_action_asset = [];
                queues.call_to_action_asset.push(this.facebookBatchRequestsService.buildRelativeUrl(insightPath, {
                    ...params,
                    breakdowns: 'call_to_action_asset',
                    time_increment: 1
                }));
            }

            if (breakdowns.includes('description_asset') && creative?.hasDescription) {
                if (!queues.description_asset) queues.description_asset = [];
                queues.description_asset.push(this.facebookBatchRequestsService.buildRelativeUrl(insightPath, {
                    ...params,
                    breakdowns: 'description_asset',
                    time_increment: 1
                }));
            }

            if (breakdowns.includes('link_url_asset') && creative?.hasLinkUrl) {
                if (!queues.link_url_asset) queues.link_url_asset = [];
                queues.link_url_asset.push(this.facebookBatchRequestsService.buildRelativeUrl(insightPath, {
                    ...params,
                    breakdowns: 'link_url_asset',
                    time_increment: 1
                }));
            }

            if (breakdowns.includes('title_asset') && creative?.hasTitle) {
                if (!queues.title_asset) queues.title_asset = [];
                queues.title_asset.push(this.facebookBatchRequestsService.buildRelativeUrl(insightPath, {
                    ...params,
                    breakdowns: 'title_asset',
                    time_increment: 1
                }));
            }
        }

        return queues;
    }

    getImageHashesByCreative(creatives: any) {
        return Object.fromEntries(creatives.map((creative: any) => [ creative.id, [
            this.extractIds(creative.asset_feed_spec?.images, 'hash') || [],
            creative.object_story_spec?.photo_data?.image_hash || [],
            (creative.object_story_spec?.link_data?.child_attachments || [])
                .map((attachment: any) => attachment.image_hash)
                .filter((hash: any) => hash) || []
        ].flat()]).filter(([_, imageHashes]: [string, any]) => imageHashes.length > 0))
    }

    getVideoIdsByCreative(creatives: any) {
        return Object.fromEntries(creatives.map((creative: any) => [ creative.id, [
            this.extractIds(creative.asset_feed_spec?.videos, 'video_id') || [],
            creative.object_story_spec?.video_data?.video_id || [],
            (creative.object_story_spec?.link_data?.child_attachments || [])
                .map((attachment: any) => attachment.video_id)
                .filter((id: any) => id) || []
        ].flat()]).filter(([_, videoIds]: [string, any]) => videoIds.length > 0))
    }
} 