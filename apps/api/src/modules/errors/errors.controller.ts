import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { ErrorsService } from './errors.service';

@UseGuards(JwtAuthGuard)
@Controller('errors')
export class ErrorsController {
  constructor(private readonly service: ErrorsService) {}

  @Get()
  top(@CurrentUser('id') userId: string, @Query('language') language: string) {
    return this.service.top(userId, language, 20);
  }

  @Get('by-category')
  byCategory(@CurrentUser('id') userId: string, @Query('language') language?: string) {
    return this.service.byCategory(userId, language);
  }

  /**
   * Os pares de idiomas que mais se atrapalham, com o contraste que resolve
   * cada um. E o que transforma "8 erros de ordem das palavras" em "o russo
   * esta contaminando o seu alemao, estude este topico".
   */
  @Get('interference')
  interference(@CurrentUser('id') userId: string, @Query('limit') limit?: string) {
    return this.service.interference(userId, limit ? Number(limit) : 5);
  }

  @Post(':id/resolve')
  resolve(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.resolve(userId, id);
  }
}
