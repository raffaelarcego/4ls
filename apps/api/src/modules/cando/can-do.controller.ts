import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsString, Min } from 'class-validator';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CanDoService } from './can-do.service';

class RecordCanDoDto {
  @IsString() canDoId!: string;
  /** O progresso e por idioma: ele pode fechar em espanhol e ainda errar o russo. */
  @IsString() languageCode!: string;
  @IsInt() @Min(0) correct!: number;
  @IsInt() @Min(1) total!: number;
}

@UseGuards(JwtAuthGuard)
@Controller('cando')
export class CanDoController {
  constructor(private readonly service: CanDoService) {}

  /**
   * A can-do de hoje nos quatro idiomas.
   *
   * Sem parametro de idioma, e de proposito: o que esta rota entrega nao
   * pertence a idioma nenhum -- e a mesma coisa dita nos quatro.
   */
  @Get('today')
  today(@CurrentUser('id') userId: string) {
    return this.service.today(userId);
  }

  @Post('record')
  record(@CurrentUser('id') userId: string, @Body() dto: RecordCanDoDto) {
    return this.service.record(userId, dto.canDoId, dto.languageCode, dto.correct, dto.total);
  }
}
