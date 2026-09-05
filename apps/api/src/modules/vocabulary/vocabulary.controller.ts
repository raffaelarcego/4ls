import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CefrLevel, VocabStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { VocabularyService } from './vocabulary.service';

class AddVocabularyDto {
  @IsString() languageCode!: string;
  @IsString() @MinLength(1) term!: string;
  @IsString() @MinLength(1) meaning!: string;
  @IsOptional() @IsString() example?: string;
  @IsOptional() @IsString() translation?: string;
  @IsOptional() @IsEnum(CefrLevel) level?: CefrLevel;
}

@UseGuards(JwtAuthGuard)
@Controller('vocabulary')
export class VocabularyController {
  constructor(private readonly service: VocabularyService) {}

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Query('language') language?: string,
    @Query('status') status?: VocabStatus,
  ) {
    return this.service.list(userId, language, status);
  }

  @Get('stats')
  stats(@CurrentUser('id') userId: string) {
    return this.service.stats(userId);
  }

  @Post()
  add(@CurrentUser('id') userId: string, @Body() dto: AddVocabularyDto) {
    return this.service.add(userId, dto);
  }
}
