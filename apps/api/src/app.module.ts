import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './infrastructure/ai/ai.module';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { SpeechModule } from './infrastructure/speech/speech.module';
import { AlphabetModule } from './modules/alphabet/alphabet.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { AuthModule } from './modules/auth/auth.module';
import { CanDoModule } from './modules/cando/can-do.module';
import { ConceptsModule } from './modules/concepts/concepts.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ErrorsModule } from './modules/errors/errors.module';
import { FoundationModule } from './modules/foundation/foundation.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { GrammarModule } from './modules/grammar/grammar.module';
import { HealthModule } from './modules/health/health.module';
import { LanguagesModule } from './modules/languages/languages.module';
import { PromotionModule } from './modules/promotion/promotion.module';
import { ReadingModule } from './modules/reading/reading.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { ReviewModule } from './modules/review/review.module';
import { SpeechFeatureModule } from './modules/speech/speech.module';
import { StructureModule } from './modules/structure/structure.module';
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
    ConceptsModule,
    AlphabetModule,
    FoundationModule,
    AssessmentModule,
    StructureModule,
    CanDoModule,
    PromotionModule,
    ReadingModule,
    ReferenceModule,
    ReviewModule,
    ErrorsModule,
    GamificationModule,
    GrammarModule,
    StudyModule,
    TutorModule,
    SpeechFeatureModule,
    DashboardModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
