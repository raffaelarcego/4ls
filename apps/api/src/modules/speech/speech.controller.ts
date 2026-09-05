import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { SpeechService } from './speech.service';

class SpeakDto {
  @IsString() @MinLength(1) @MaxLength(600) text!: string;
  @IsString() @IsIn(['en', 'es', 'de', 'pt']) languageCode!: string;
  @IsOptional() @IsString() voice?: string;
  @IsOptional() @IsNumber() @Min(0.5) @Max(1.5) speed?: number;
}

class TranscribeDto {
  /** Audio em base64 -- evita multipart e mantem o endpoint sob o guard JWT. */
  @IsString() @MinLength(16) audio!: string;
  @IsString() mimeType!: string;
  @IsString() @IsIn(['en', 'es', 'de', 'pt']) languageCode!: string;
  @IsOptional() @IsString() @MaxLength(400) hint?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('speech')
export class SpeechController {
  constructor(private readonly service: SpeechService) {}

  /**
   * O front consulta isto antes de decidir como falar: com provider, usa a voz
   * natural; sem provider, cai na sintese do proprio navegador.
   */
  @Get('status')
  status() {
    return this.service.status();
  }

  /** Estatisticas do cache de audio, para a tela de Progresso. */
  @Get('cache')
  cache() {
    return this.service.cacheStats();
  }

  @Post('tts')
  speak(@CurrentUser('id') userId: string, @Body() dto: SpeakDto) {
    return this.service.speak(userId, dto);
  }

  @Post('transcribe')
  transcribe(@CurrentUser('id') userId: string, @Body() dto: TranscribeDto) {
    return this.service.transcribe(userId, dto);
  }
}
