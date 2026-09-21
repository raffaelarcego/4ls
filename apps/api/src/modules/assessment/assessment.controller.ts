import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AssessmentService } from './assessment.service';

class ResultDto {
  @IsString() languageCode!: string;
  @IsBoolean() correct!: boolean;
}

class RecordAssessmentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultDto)
  results!: ResultDto[];
}

@UseGuards(JwtAuthGuard)
@Controller('assessment')
export class AssessmentController {
  constructor(private readonly service: AssessmentService) {}

  /** A prova de hoje. Vem vazia quando nao ha material descansado. */
  @Get('exam')
  async exam(@CurrentUser('id') userId: string) {
    const { items, canDoIds } = await this.service.buildExam(userId);
    return {
      items,
      questions: canDoIds.map((id) => ({ canDoId: id, question: this.service.questionFor(id) })),
    };
  }

  @Post('record')
  record(@CurrentUser('id') userId: string, @Body() dto: RecordAssessmentDto) {
    return this.service.record(userId, dto.results);
  }
}
