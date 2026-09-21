import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { ReferenceService } from './reference.service';

@UseGuards(JwtAuthGuard)
@Controller('reference')
export class ReferenceController {
  constructor(private readonly service: ReferenceService) {}

  /** Quais idiomas do aluno tem material de consulta. */
  @Get('languages')
  languages(@CurrentUser('id') userId: string) {
    return this.service.available(userId);
  }

  @Get()
  get(@CurrentUser('id') userId: string, @Query('language') language: string) {
    return this.service.get(userId, language);
  }
}
