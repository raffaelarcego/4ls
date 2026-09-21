import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsString, Min } from 'class-validator';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { ReadingService } from './reading.service';

class RecordReadingDto {
  @IsString() passageId!: string;
  /**
   * O progresso e por idioma porque a mesma historia volta nos outros: ler "A
   * mudanca" em ingles nao pode impedir que ela venha em alemao depois.
   */
  @IsString() languageCode!: string;
  @IsInt() @Min(0) correct!: number;
  @IsInt() @Min(1) total!: number;
}

@UseGuards(JwtAuthGuard)
@Controller('reading')
export class ReadingController {
  constructor(private readonly service: ReadingService) {}

  /**
   * O texto de hoje neste idioma -- e as outras versoes junto.
   *
   * Recebe idioma, ao contrario da can-do, porque a leitura acontece num idioma
   * por vez. O que atravessa os quatro e o TEXTO, que e o mesmo; as outras
   * versoes vao na resposta para a comparacao frase a frase.
   */
  @Get('lesson')
  lesson(@CurrentUser('id') userId: string, @Query('language') language: string) {
    return this.service.lesson(userId, language);
  }

  @Post('record')
  record(@CurrentUser('id') userId: string, @Body() dto: RecordReadingDto) {
    return this.service.record(userId, dto.passageId, dto.languageCode, dto.correct, dto.total);
  }
}
