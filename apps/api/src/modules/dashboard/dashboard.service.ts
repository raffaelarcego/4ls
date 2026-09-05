import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AiRouterService } from '../../infrastructure/ai/ai-router.service';
import { ErrorsService } from '../errors/errors.service';
import { GamificationService } from '../gamification/gamification.service';
import { LanguagesService } from '../languages/languages.service';
import { ReviewService } from '../review/review.service';
import { StudyService } from '../study/study.service';
import { VocabularyService } from '../vocabulary/vocabulary.service';

/**
 * O dashboard existe para responder uma unica pergunta:
 * "o que eu deveria estudar agora?". Por isso ele ja devolve a sessao pronta.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly study: StudyService,
    private readonly languages: LanguagesService,
    private readonly reviews: ReviewService,
    private readonly vocabulary: VocabularyService,
    private readonly errors: ErrorsService,
    private readonly gamification: GamificationService,
    private readonly ai: AiRouterService,
  ) {}

  async load(userId: string, useAi = false) {
    const [session, languages, streak, xp, dueCounts, vocabStats] = await Promise.all([
      this.study.todaySession(userId, useAi),
      this.languages.forUser(userId),
      this.gamification.getStreak(userId),
      this.gamification.xpSummary(userId),
      this.reviews.dueCountByLanguage(userId),
      this.vocabulary.stats(userId),
    ]);

    const withInsights = await Promise.all(
      languages.map(async (lang) => ({
        ...lang,
        dueReviews: dueCounts[lang.code] ?? 0,
        vocabulary: vocabStats[lang.code] ?? { total: 0, learning: 0, mastered: 0 },
        topErrors: await this.errors.top(userId, lang.code, 3),
      })),
    );

    return {
      session,
      languages: withInsights,
      streak: { current: streak.current, longest: streak.longest },
      xp,
      aiEnabled: this.ai.hasProvider(),
    };
  }
}
