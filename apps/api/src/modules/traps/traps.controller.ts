import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { TrapsService } from './traps.service';

class TrapResultDto {
  /** Id do catalogo, ou o id do erro dele quando o par minimo veio de um erro. */
  @IsString() id!: string;
  @IsBoolean() correct!: boolean;
}

class RecordTrapsDto {
  @IsString() languageCode!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrapResultDto)
  results!: TrapResultDto[];
}

@UseGuards(JwtAuthGuard)
@Controller('traps')
export class TrapsController {
  constructor(private readonly service: TrapsService) {}

  /** A rodada de armadilhas de hoje num idioma. */
  @Get('lesson')
  lesson(@CurrentUser('id') userId: string, @Query('language') language: string) {
    return this.service.lesson(userId, language);
  }

  /**
   * O resultado. Acertar varias vezes FECHA o erro que gerou a armadilha -- e o
   * unico caminho do app em que um erro se resolve sozinho.
   */
  @Post('record')
  record(@CurrentUser('id') userId: string, @Body() dto: RecordTrapsDto) {
    return this.service.record(userId, dto.languageCode, dto.results);
  }
}
