import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsString, Min } from 'class-validator';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { FoundationService } from './foundation.service';

class RecordFoundationDto {
  @IsString() lessonId!: string;
  @IsString() languageCode!: string;
  @IsInt() @Min(0) correct!: number;
  @IsInt() @Min(1) total!: number;
}

@UseGuards(JwtAuthGuard)
@Controller('foundation')
export class FoundationController {
  constructor(private readonly service: FoundationService) {}

  /** A licao de fundamentos de hoje para um idioma. */
  @Get('lesson')
  lesson(@CurrentUser('id') userId: string, @Query('language') language: string) {
    return this.service.lesson(userId, language);
  }

  @Post('record')
  record(@CurrentUser('id') userId: string, @Body() dto: RecordFoundationDto) {
    return this.service.record(userId, dto.lessonId, dto.languageCode, dto.correct, dto.total);
  }
}
