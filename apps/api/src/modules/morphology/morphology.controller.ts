import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { MorphologyService } from './morphology.service';

class MorphologyResultDto {
  @IsString() slotId!: string;
  @IsBoolean() correct!: boolean;
}

class RecordMorphologyDto {
  @IsString() languageCode!: string;
  /**
   * Um resultado por exercicio, com o CASO que ele cobrava.
   *
   * Nao e uma nota da aula: acertar o dativo e errar o instrumental sao fatos
   * diferentes, e e o caso mais fraco que decide a aula de amanha.
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MorphologyResultDto)
  results!: MorphologyResultDto[];
}

@UseGuards(JwtAuthGuard)
@Controller('morphology')
export class MorphologyController {
  constructor(private readonly service: MorphologyService) {}

  /** A tabela de casos de hoje, num idioma. */
  @Get('lesson')
  lesson(@CurrentUser('id') userId: string, @Query('language') language: string) {
    return this.service.lesson(userId, language);
  }

  @Post('record')
  record(@CurrentUser('id') userId: string, @Body() dto: RecordMorphologyDto) {
    return this.service.record(userId, dto.languageCode, dto.results);
  }
}
