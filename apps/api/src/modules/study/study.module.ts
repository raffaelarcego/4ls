import { Module } from '@nestjs/common';
import { ErrorsModule } from '../errors/errors.module';
import { GamificationModule } from '../gamification/gamification.module';
import { ReviewModule } from '../review/review.module';
import { StudyController } from './study.controller';
import { StudyService } from './study.service';

@Module({
  imports: [ReviewModule, ErrorsModule, GamificationModule],
  controllers: [StudyController],
  providers: [StudyService],
  exports: [StudyService],
})
export class StudyModule {}
