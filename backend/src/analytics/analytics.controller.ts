import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get('monthly-by-category')
    getMonthlyByCategory(
        @Query('userId') userId: string,
        @Query('year') year?: string,
    ) {
        const currentYear = year ? parseInt(year) : new Date().getFullYear();
        return this.analyticsService.getMonthlyByCategory(parseInt(userId), currentYear);
    }

    @Get('available-years')
    getAvailableYears(@Query('userId') userId: string) {
        return this.analyticsService.getAvailableYears(parseInt(userId));
    }
}
