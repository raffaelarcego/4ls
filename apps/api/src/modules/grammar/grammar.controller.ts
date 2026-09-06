import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { isLang, Lang, STUDY_LANGUAGES } from './contrast-catalog';
import { GrammarService } from './grammar.service';

class RecordDto {
  @IsString() languageCode!: string;
  @IsInt() @Min(0) correct!: number;
  @IsInt() @Min(1) total!: number;
}

class FlagDto {
  @IsString() languageCode!: string;
  @IsBoolean() flagged!: boolean;
}

class DrillsDto {
  @IsString() languageCode!: string;
  /** Forca gerar exercicios novos em vez de reaproveitar o pool. */
  @IsOptional() @IsBoolean() fresh?: boolean;
}

/**
 * Estudo de gramatica por contraste entre os idiomas.
 *
 * Todo endpoint exige o idioma ALVO, porque o mesmo topico ensina coisas
 * diferentes conforme o idioma que se esta aprendendo: "ordem das palavras"
 * para o alemao e um assunto; para o ingles e outro.
 */
@UseGuards(JwtAuthGuard)
@Controller('grammar')
export class GrammarController {
  constructor(private readonly service: GrammarService) {}

  @Get('topics')
  topics(@CurrentUser('id') userId: string, @Query('language') language: string) {
    return this.service.list(userId, target(language));
  }

  @Get('topics/:id')
  topic(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Query('language') language: string,
  ) {
    return this.service.detail(userId, id, target(language));
  }

  @Post('topics/:id/drills')
  drills(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: DrillsDto) {
    return this.service.drills(userId, id, target(dto.languageCode), dto.fresh ?? false);
  }

  @Post('topics/:id/record')
  record(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: RecordDto) {
    if (dto.correct > dto.total) {
      throw new BadRequestException('Acertos nao podem passar do total de exercicios.');
    }
    return this.service.record(userId, id, target(dto.languageCode), dto.correct, dto.total);
  }

  @Post('topics/:id/flag')
  flag(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: FlagDto) {
    return this.service.flag(userId, id, target(dto.languageCode), dto.flagged);
  }
}

/**
 * O portugues e apoio, nunca alvo: nao ha o que estudar nele. Validar aqui
 * evita que o service tenha de repetir a checagem em todo metodo.
 */
function target(code: string | undefined): Lang {
  if (!code || !isLang(code) || !STUDY_LANGUAGES.includes(code)) {
    throw new BadRequestException(
      `Idioma invalido. Use um destes: ${STUDY_LANGUAGES.join(', ')}.`,
    );
  }
  return code;
}
