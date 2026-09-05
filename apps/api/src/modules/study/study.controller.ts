import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PRACTICABLE_TYPES } from './mission.engine';
import { StudyService } from './study.service';

class CompleteActivityDto {
  @IsNumber() @Min(0) durationSeconds!: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) score?: number;
}

class PracticeDto {
  @IsString() languageCode!: string;
  @IsIn([...PRACTICABLE_TYPES]) type!: string;
  @IsOptional() @IsNumber() @Min(3) @Max(20) minutes?: number;
}

@UseGuards(JwtAuthGuard)
@Controller('study')
export class StudyController {
  constructor(private readonly service: StudyService) {}

  /** Sessao de hoje (cria na primeira chamada do dia). */
  @Get('today')
  today(@CurrentUser('id') userId: string, @Query('ai') ai?: string) {
    return this.service.todaySession(userId, ai === 'true');
  }

  @Get('history')
  history(@CurrentUser('id') userId: string, @Query('limit') limit?: string) {
    return this.service.history(userId, limit ? Number(limit) : 30);
  }

  /** Adiciona um bloco escolhido pelo aluno a sessao de hoje. */
  @Post('practice')
  practice(@CurrentUser('id') userId: string, @Body() dto: PracticeDto) {
    return this.service.addPractice(userId, dto);
  }

  @Post('activities/:id/complete')
  completeActivity(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: CompleteActivityDto,
  ) {
    return this.service.completeActivity(userId, id, dto);
  }

  @Post('sessions/:id/complete')
  completeSession(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.completeSession(userId, id);
  }
}
