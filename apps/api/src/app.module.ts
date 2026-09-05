import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './infrastructure/ai/ai.module';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { SpeechModule } from './infrastructure/speech/speech.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ErrorsModule } from './modules/errors/errors.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { HealthModule } from './modules/health/health.module';
import { LanguagesModule } from './modules/languages/languages.module';
import { ReviewModule } from './modules/review/review.module';
import { SpeechFeatureModule } from './modules/speech/speech.module';
import { StudyModule } from './modules/study/study.module';
import { TutorModule } from './modules/tutor/tutor.module';
import { VocabularyModule } from './modules/vocabulary/vocabulary.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AiModule,
    SpeechModule,
    HealthModule,
    AuthModule,
    LanguagesModule,
    VocabularyModule,
    ReviewModule,
    ErrorsModule,
    GamificationModule,
    StudyModule,
    TutorModule,
    SpeechFeatureModule,
    DashboardModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
