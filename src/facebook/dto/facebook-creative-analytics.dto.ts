import { IsString, IsArray, IsNotEmpty, IsDateString } from 'class-validator';

export class FacebookCreativeAnalyticsDto {
    @IsString()
    @IsNotEmpty()
    accountId: string;

    @IsDateString()
    @IsNotEmpty()
    date_start: string;

    @IsDateString()
    @IsNotEmpty()
    date_end: string;

    @IsArray()
    @IsNotEmpty()
    breakdown: string[];
} 