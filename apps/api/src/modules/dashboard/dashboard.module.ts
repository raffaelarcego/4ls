import { Module } from '@nestjs/common';
import { ErrorsModule } from '../errors/errors.module';
import { GamificationModule } from '../gamification/gamification.module';
import { LanguagesModule } from '../languages/languages.module';
import { ReviewModule } from '../review/review.module';
import { StudyModule } from '../study/study.module';
import { VocabularyModule } from '../vocabulary/vocabulary.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [StudyModule, LanguagesModule, ReviewModule, VocabularyModule, ErrorsModule, GamificationModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
