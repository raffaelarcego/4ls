import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('time')
  time(@CurrentUser('id') userId: string) {
    return this.service.timePerLanguage(userId);
  }

  @Get('consistency')
  consistency(@CurrentUser('id') userId: string, @Query('days') days?: string) {
    return this.service.consistency(userId, days ? Number(days) : 30);
  }

  @Get('ai-usage')
  aiUsage(@CurrentUser('id') userId: string, @Query('days') days?: string) {
    return this.service.aiUsage(userId, days ? Number(days) : 30);
  }

  @Get('weekly-review')
  weeklyReview(@CurrentUser('id') userId: string) {
    return this.service.weeklyReview(userId);
  }
}
