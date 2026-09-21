import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PromotionService } from './promotion.service';
import { Round, ROUNDS } from './promotion.rules';

class PromotionResultDto {
  @IsIn(ROUNDS as unknown as string[]) round!: Round;
  @IsBoolean() correct!: boolean;
}

class AttemptDto {
  @IsString() languageCode!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromotionResultDto)
  results!: PromotionResultDto[];
}

@UseGuards(JwtAuthGuard)
@Controller('promotion')
export class PromotionController {
  constructor(private readonly service: PromotionService) {}

  /** O estado do chefe em cada idioma -- e, quando fechado, o que falta. */
  @Get('status')
  status(@CurrentUser('id') userId: string) {
    return this.service.status(userId);
  }

  /** O exame de um idioma. 403 quando o chefe nao esta aberto. */
  @Get('exam')
  exam(@CurrentUser('id') userId: string, @Query('language') language: string) {
    return this.service.exam(userId, language);
  }

  @Post('attempt')
  attempt(@CurrentUser('id') userId: string, @Body() dto: AttemptDto) {
    return this.service.attempt(userId, dto.languageCode, dto.results);
  }
}
