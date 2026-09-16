import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CefrLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { ConceptsService } from './concepts.service';

class LearnConceptDto {
  @IsString() languageCode!: string;
  @IsString() @MinLength(1) term!: string;
  @IsString() @MinLength(1) meaning!: string;
  @IsOptional() @IsString() example?: string;
  @IsOptional() @IsString() translation?: string;
  @IsOptional() @IsEnum(CefrLevel) level?: CefrLevel;
}

class ProductionSentenceDto {
  @IsString() languageCode!: string;
  @IsString() sentence!: string;
}

class EvaluateProductionDto {
  @IsString() conceptId!: string;

  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ProductionSentenceDto)
  sentences!: ProductionSentenceDto[];
}

class CaptureDto {
  @IsString() languageCode!: string;
  @IsString() @MinLength(40) text!: string;
  @IsOptional() @IsInt() @Min(1) @Max(12) count?: number;
}

@UseGuards(JwtAuthGuard)
@Controller('concepts')
export class ConceptsController {
  constructor(private readonly service: ConceptsService) {}

  /**
   * A aula de vocabulario de hoje, vista a partir de um idioma.
   * Os conceitos sao os mesmos em todos os idiomas -- o que muda e so qual
   * realizacao vem primeiro no card.
   */
  @Get('lesson')
  lesson(
    @CurrentUser('id') userId: string,
    @Query('language') language: string,
    @Query('count') count?: string,
  ) {
    return this.service.lesson(userId, language, count ? Number(count) : 5);
  }

  /** Quantos conceitos do aluno ja existem nos quatro idiomas. */
  @Get('coverage')
  coverage(@CurrentUser('id') userId: string) {
    return this.service.gaps(userId);
  }

  /**
   * Aprender um termo novo. Ele nunca entra sozinho: o conceito e completado
   * nos outros idiomas e matriculado nos quatro de uma vez.
   */
  @Post('learn')
  learn(@CurrentUser('id') userId: string, @Body() dto: LearnConceptDto) {
    return this.service.learn(userId, dto);
  }

  /**
   * O conceito da vez para producao livre: dizer a mesma coisa nos quatro
   * idiomas, sem alternativa na tela.
   */
  @Get('production/mission')
  productionMission(@CurrentUser('id') userId: string) {
    return this.service.productionMission(userId);
  }

  @Post('production/evaluate')
  evaluateProduction(@CurrentUser('id') userId: string, @Body() dto: EvaluateProductionDto) {
    return this.service.evaluateProduction(userId, dto.conceptId, dto.sentences);
  }

  /**
   * Captura de texto: cole um artigo e o vocabulario dele entra como conceito,
   * ja nos quatro idiomas.
   */
  @Post('capture')
  capture(@CurrentUser('id') userId: string, @Body() dto: CaptureDto) {
    return this.service.capture(userId, dto);
  }
}
