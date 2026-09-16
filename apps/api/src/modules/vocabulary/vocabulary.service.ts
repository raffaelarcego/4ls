import { Injectable } from '@nestjs/common';
import { CefrLevel, VocabStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ConceptsService } from '../concepts/concepts.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly concepts: ConceptsService,
  ) {}

  async list(userId: string, languageCode?: string, status?: VocabStatus) {
    const items = await this.prisma.userVocabulary.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
        ...(languageCode ? { vocabulary: { language: { code: languageCode } } } : {}),
      },
      include: { vocabulary: { include: { language: true, concept: true } } },
      orderBy: { nextReview: 'asc' },
      take: 500,
    });

    return items.map((item) => ({
      id: item.id,
      // O conceito viaja junto com o termo: e o que permite a tela mostrar
      // "trabalho" com as quatro realizacoes lado a lado em vez de quatro
      // palavras soltas que por acaso significam a mesma coisa.
      conceptId: item.vocabulary.conceptId,
      gloss: item.vocabulary.concept?.gloss ?? item.vocabulary.meaning,
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
   * Adiciona um termo ao vocabulario do usuario.
   *
   * Delega ao ConceptsService de proposito: nenhum termo entra sozinho neste
   * produto. O que chega aqui como "uma palavra em ingles" sai como um
   * conceito matriculado nos quatro idiomas -- e essa e a regra que o
   * ConceptsService existe para nunca deixar furar. Idempotente.
   */
  async add(userId: string, input: AddVocabularyInput) {
    return this.concepts.learn(userId, {
      languageCode: input.languageCode,
      term: input.term,
      meaning: input.meaning,
      example: input.example,
      translation: input.translation,
      level: input.level ?? CefrLevel.A1,
      source: input.source ?? 'user',
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
