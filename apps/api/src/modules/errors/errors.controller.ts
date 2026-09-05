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

  @Post(':id/resolve')
  resolve(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.resolve(userId, id);
  }
}
