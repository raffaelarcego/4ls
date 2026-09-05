import { Injectable, NotFoundException } from '@nestjs/common';
import { CefrLevel, VocabStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface AddVocabularyInput {
  languageCode: string;
  term: string;
  meaning: string;
  example?: string;
  translation?: string;
  level?: CefrLevel;
  source?: string;
}

@Injectable()
export class VocabularyService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, languageCode?: string, status?: VocabStatus) {
    const items = await this.prisma.userVocabulary.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
        ...(languageCode ? { vocabulary: { language: { code: languageCode } } } : {}),
      },
      include: { vocabulary: { include: { language: true } } },
      orderBy: { nextReview: 'asc' },
      take: 500,
    });

    return items.map((item) => ({
      id: item.id,
      term: item.vocabulary.term,
      meaning: item.vocabulary.meaning,
      example: item.vocabulary.example,
      translation: item.vocabulary.translation,
      level: item.vocabulary.level,
      languageCode: item.vocabulary.language.code,
      status: item.status,
      confidence: item.confidence,
      nextReview: item.nextReview,
      correctCount: item.correctCount,
      wrongCount: item.wrongCount,
    }));
  }

  /** Contagem por idioma e status -- usada no dashboard e no analytics. */
  async stats(userId: string) {
    const rows = await this.prisma.userVocabulary.findMany({
      where: { userId },
      select: {
        status: true,
        vocabulary: { select: { language: { select: { code: true } } } },
      },
    });

    const stats: Record<string, { total: number; learning: number; mastered: number }> = {};
    for (const row of rows) {
      const code = row.vocabulary.language.code;
      stats[code] ??= { total: 0, learning: 0, mastered: 0 };
      stats[code].total += 1;
      if (row.status === VocabStatus.LEARNING || row.status === VocabStatus.NEW) {
        stats[code].learning += 1;
      }
      if (row.status === VocabStatus.MASTERED) stats[code].mastered += 1;
    }
    return stats;
  }

  /**
   * Adiciona um termo ao vocabulario do usuario, criando a entrada global se
   * ela ainda nao existir. Idempotente: chamar duas vezes nao duplica.
   */
  async add(userId: string, input: AddVocabularyInput) {
    const language = await this.prisma.language.findUnique({
      where: { code: input.languageCode },
    });
    if (!language) throw new NotFoundException(`Idioma "${input.languageCode}" nao encontrado.`);

    const term = input.term.trim();

    const vocabulary = await this.prisma.vocabulary.upsert({
      where: { languageId_term: { languageId: language.id, term } },
      create: {
        languageId: language.id,
        term,
        meaning: input.meaning,
        example: input.example,
        translation: input.translation,
        level: input.level ?? CefrLevel.A1,
        source: input.source ?? 'user',
      },
      update: {},
    });

    return this.prisma.userVocabulary.upsert({
      where: { userId_vocabularyId: { userId, vocabularyId: vocabulary.id } },
      create: { userId, vocabularyId: vocabulary.id },
      update: {},
    });
  }

  /** Termos em aprendizado, para dar contexto aos prompts do tutor. */
  async recentTerms(userId: string, languageCode: string, limit = 15): Promise<string[]> {
    const items = await this.prisma.userVocabulary.findMany({
      where: {
        userId,
        status: { in: [VocabStatus.NEW, VocabStatus.LEARNING] },
        vocabulary: { language: { code: languageCode } },
      },
      include: { vocabulary: { select: { term: true } } },
      orderBy: { nextReview: 'asc' },
      take: limit,
    });
    return items.map((i) => i.vocabulary.term);
  }
}
