import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsObject } from 'class-validator';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { LanguagesService } from './languages.service';

class DistributionDto {
  @IsObject() distribution!: Record<string, number>;
}

@UseGuards(JwtAuthGuard)
@Controller('languages')
export class LanguagesController {
  constructor(private readonly service: LanguagesService) {}

  @Get()
  forUser(@CurrentUser('id') userId: string) {
    return this.service.forUser(userId);
  }

  @Patch('distribution')
  updateDistribution(@CurrentUser('id') userId: string, @Body() dto: DistributionDto) {
    return this.service.updateDistribution(userId, dto.distribution);
  }
}
