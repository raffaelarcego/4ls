import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { ReviewService } from './review.service';
import { ReviewGrade } from './srs.engine';

class GradeDto {
  @IsIn(['again', 'hard', 'good', 'easy'])
  grade!: ReviewGrade;
}

@UseGuards(JwtAuthGuard)
@Controller('review')
export class ReviewController {
  constructor(private readonly service: ReviewService) {}

  @Get('due')
  due(
    @CurrentUser('id') userId: string,
    @Query('language') language?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.due(userId, language, limit ? Number(limit) : 20);
  }

  @Get('due/count')
  dueCount(@CurrentUser('id') userId: string) {
    return this.service.dueCountByLanguage(userId);
  }

  @Post(':id/grade')
  grade(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: GradeDto,
  ) {
    return this.service.grade(userId, id, dto.grade);
  }
}
