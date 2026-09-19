import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsString, Min } from 'class-validator';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AlphabetService } from './alphabet.service';

class RecordAlphabetDto {
  @IsString() lessonId!: string;
  @IsString() languageCode!: string;
  @IsInt() @Min(0) correct!: number;
  @IsInt() @Min(1) total!: number;
}

@UseGuards(JwtAuthGuard)
@Controller('alphabet')
export class AlphabetController {
  constructor(private readonly service: AlphabetService) {}

  /** A licao de alfabeto de hoje para um idioma. */
  @Get('lesson')
  lesson(@CurrentUser('id') userId: string, @Query('language') language: string) {
    return this.service.lesson(userId, language);
  }

  @Post('record')
  record(@CurrentUser('id') userId: string, @Body() dto: RecordAlphabetDto) {
    return this.service.record(userId, dto.lessonId, dto.languageCode, dto.correct, dto.total);
  }
}
