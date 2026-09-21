import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { ShadowingService } from './shadowing.service';

class AttemptDto {
  /** A frase que o app falou. O gabarito e ela mesma. */
  @IsString() target!: string;
  /** O que o reconhecimento de fala ouviu. Vazio quando ele nao falou nada. */
  @IsString() transcript!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('shadowing')
export class ShadowingController {
  constructor(private readonly service: ShadowingService) {}

  /** As frases de hoje: conteudo que ele ja estudou neste idioma. */
  @Get('lesson')
  lesson(@CurrentUser('id') userId: string, @Query('language') language: string) {
    return this.service.lesson(userId, language);
  }

  /**
   * Corrige uma repeticao.
   *
   * Nao grava nada -- a nota do bloco move a competencia de fala pelo caminho
   * normal, ao concluir a atividade. Esta rota existe para o alinhamento morar
   * num lugar so, e num lugar onde ele tem teste.
   */
  @Post('attempt')
  attempt(@Body() dto: AttemptDto) {
    return this.service.attempt(dto.target, dto.transcript);
  }
}
