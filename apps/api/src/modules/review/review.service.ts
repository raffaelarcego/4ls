import { Injectable, NotFoundException } from '@nestjs/common';
import { VocabStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { review, ReviewGrade } from './srs.engine';

const REVIEW_XP = 10;

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  /** Itens vencidos, opcionalmente filtrados por idioma. */
  async due(userId: string, languageCode?: string, limit = 20) {
    const items = await this.prisma.userVocabulary.findMany({
      where: {
        userId,
        nextReview: { lte: new Date() },
        status: { not: VocabStatus.MASTERED },
        ...(languageCode ? { vocabulary: { language: { code: languageCode } } } : {}),
      },
      include: { vocabulary: { include: { language: true } } },
      orderBy: { nextReview: 'asc' },
      take: limit,
    });

    return items.map((item) => ({
      id: item.id,
      status: item.status,
      confidence: item.confidence,
      term: item.vocabulary.term,
      meaning: item.vocabulary.meaning,
      example: item.vocabulary.example,
      translation: item.vocabulary.translation,
      level: item.vocabulary.level,
      languageCode: item.vocabulary.language.code,
      languageName: item.vocabulary.language.name,
    }));
  }

  /** Quantos itens estao vencidos por idioma -- alimenta o Daily Mission Engine. */
  async dueCountByLanguage(userId: string): Promise<Record<string, number>> {
    const rows = await this.prisma.userVocabulary.findMany({
      where: {
        userId,
        nextReview: { lte: new Date() },
        status: { not: VocabStatus.MASTERED },
      },
      select: { vocabulary: { select: { language: { select: { code: true } } } } },
    });

    return rows.reduce<Record<string, number>>((acc, row) => {
      const code = row.vocabulary.language.code;
      acc[code] = (acc[code] ?? 0) + 1;
      return acc;
    }, {});
  }

  /** Registra a resposta de uma revisao e reagenda o item. */
  async grade(userId: string, userVocabularyId: string, grade: ReviewGrade) {
    const item = await this.prisma.userVocabulary.findFirst({
      where: { id: userVocabularyId, userId },
      include: { vocabulary: true },
    });
    if (!item) throw new NotFoundException('Item de vocabulario nao encontrado.');

    const next = review(
      {
        status: item.status,
        easeFactor: item.easeFactor,
        intervalDays: item.intervalDays,
        repetitions: item.repetitions,
        correctCount: item.correctCount,
        wrongCount: item.wrongCount,
        confidence: item.confidence,
      },
      grade,
    );

    const updated = await this.prisma.userVocabulary.update({
      where: { id: item.id },
      data: {
        status: next.status,
        easeFactor: next.easeFactor,
        intervalDays: next.intervalDays,
        repetitions: next.repetitions,
        correctCount: next.correctCount,
        wrongCount: next.wrongCount,
        confidence: next.confidence,
        lastReview: next.lastReview,
        nextReview: next.nextReview,
      },
    });

    // Errar repetidamente vira um dado de Error Intelligence.
    if (grade === 'again' && updated.wrongCount >= 3) {
      await this.recordVocabularyStruggle(userId, item.vocabularyId, item.vocabulary.term);
    }

    return {
      id: updated.id,
      status: updated.status,
      nextReview: updated.nextReview,
      intervalDays: updated.intervalDays,
      confidence: updated.confidence,
      xpEarned: grade === 'again' ? 0 : REVIEW_XP,
    };
  }

  private async recordVocabularyStruggle(userId: string, vocabularyId: string, term: string) {
    const vocab = await this.prisma.vocabulary.findUnique({
      where: { id: vocabularyId },
      select: { languageId: true },
    });
    if (!vocab) return;

    const existing = await this.prisma.errorRecord.findFirst({
      where: {
        userId,
        languageId: vocab.languageId,
        category: 'VOCABULARY',
        description: { contains: term },
        resolved: false,
      },
    });

    if (existing) {
      await this.prisma.errorRecord.update({
        where: { id: existing.id },
        data: { occurrenceCount: { increment: 1 }, lastOccurrence: new Date() },
      });
    } else {
      await this.prisma.errorRecord.create({
        data: {
          userId,
          languageId: vocab.languageId,
          category: 'VOCABULARY',
          description: `Dificuldade recorrente com a palavra "${term}"`,
          source: 'review',
          severity: 2,
        },
      });
    }
  }
}
