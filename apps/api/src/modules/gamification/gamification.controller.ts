import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { GamificationService } from './gamification.service';

@UseGuards(JwtAuthGuard)
@Controller('achievements')
export class GamificationController {
  constructor(private readonly service: GamificationService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.service.listAchievements(userId);
  }
}
