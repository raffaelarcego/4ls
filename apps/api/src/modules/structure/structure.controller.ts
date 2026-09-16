import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsString, Min } from 'class-validator';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { StructureService } from './structure.service';

class RecordStructureDto {
  @IsString() patternId!: string;
  @IsString() languageCode!: string;
  @IsInt() @Min(0) correct!: number;
  @IsInt() @Min(1) total!: number;
}

@UseGuards(JwtAuthGuard)
@Controller('structure')
export class StructureController {
  constructor(private readonly service: StructureService) {}

  /** A aula de formacao de frase de hoje para um idioma. */
  @Get('lesson')
  lesson(
    @CurrentUser('id') userId: string,
    @Query('language') language: string,
    @Query('fresh') fresh?: string,
  ) {
    return this.service.lesson(userId, language, fresh === 'true');
  }

  @Post('record')
  record(@CurrentUser('id') userId: string, @Body() dto: RecordStructureDto) {
    return this.service.record(userId, dto.patternId, dto.languageCode, dto.correct, dto.total);
  }
}
