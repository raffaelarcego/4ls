import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { TutorService } from './tutor.service';

class SendMessageDto {
  @IsString() languageCode!: string;
  @IsString() @MinLength(1) @MaxLength(2000) content!: string;
  @IsOptional() @IsString() conversationId?: string;
}

class GenerateExercisesDto {
  @IsString() languageCode!: string;
  @IsString() type!: string;
  @IsOptional() @IsInt() @Min(1) @Max(10) count?: number;
}

class ListeningDto {
  @IsString() languageCode!: string;
  @IsOptional() @IsInt() @Min(20) @Max(120) seconds?: number;
  /** Forca gerar conteudo novo em vez de reaproveitar o pool. */
  @IsOptional() @IsBoolean() fresh?: boolean;
}

class DictationDto {
  @IsString() languageCode!: string;
  @IsOptional() @IsInt() @Min(1) @Max(10) count?: number;
}

class SpeakingMissionDto {
  @IsString() languageCode!: string;
}

class SpeakingDto {
  @IsString() languageCode!: string;
  @IsString() mission!: string;
  @IsString() @MinLength(2) @MaxLength(5000) transcript!: string;
}

class WritingDto {
  @IsString() languageCode!: string;
  @IsString() mission!: string;
  @IsString() @MinLength(10) @MaxLength(5000) text!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('tutor')
export class TutorController {
  constructor(private readonly service: TutorService) {}

  @Get('conversations')
  conversations(@CurrentUser('id') userId: string, @Query('language') language?: string) {
    return this.service.listConversations(userId, language);
  }

  @Get('conversations/:id')
  conversation(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.getConversation(userId, id);
  }

  @Post('message')
  message(@CurrentUser('id') userId: string, @Body() dto: SendMessageDto) {
    return this.service.sendMessage(userId, dto);
  }

  @Post('exercises')
  exercises(@CurrentUser('id') userId: string, @Body() dto: GenerateExercisesDto) {
    return this.service.generateExercises(userId, dto);
  }

  @Post('writing')
  writing(@CurrentUser('id') userId: string, @Body() dto: WritingDto) {
    return this.service.evaluateWriting(userId, dto);
  }

  /** Dialogo de listening com perguntas de compreensao. */
  @Post('listening')
  listening(@CurrentUser('id') userId: string, @Body() dto: ListeningDto) {
    return this.service.generateListening(userId, dto);
  }

  /** Frases para o exercicio de ditado. */
  @Post('dictation')
  dictation(@CurrentUser('id') userId: string, @Body() dto: DictationDto) {
    return this.service.generateDictation(userId, dto);
  }

  /** Missao do Speaking Lab: o que dizer. */
  @Post('speaking/mission')
  speakingMission(@CurrentUser('id') userId: string, @Body() dto: SpeakingMissionDto) {
    return this.service.speakingMission(userId, dto);
  }

  /** Speaking Lab: avalia a transcricao e alimenta o Error Intelligence. */
  @Post('speaking')
  speaking(@CurrentUser('id') userId: string, @Body() dto: SpeakingDto) {
    return this.service.evaluateSpeaking(userId, dto);
  }
}
