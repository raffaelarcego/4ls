import { Injectable, NotFoundException } from '@nestjs/common';
import { CefrLevel } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/** Pesos do nivel global CEFR -- nao e media simples, conforme a regra do produto. */
const SKILL_WEIGHTS: Record<string, number> = {
  listening: 0.2,
  reading: 0.15,
  writing: 0.15,
  speaking: 0.25,
  vocabScore: 0.15,
  grammar: 0.1,
};

const LEVEL_ORDER: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CefrLevel[];

@Injectable()
export class LanguagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll() {
    return this.prisma.language.findMany({ orderBy: { code: 'asc' } });
  }

  async forUser(userId: string) {
    const rows = await this.prisma.userLanguage.findMany({
      where: { userId },
      include: { language: true },
      orderBy: { priority: 'asc' },
    });

    return rows.map((ul) => {
      const skills = {
        listening: ul.listening,
        reading: ul.reading,
        writing: ul.writing,
        speaking: ul.speaking,
        vocabScore: ul.vocabScore,
        grammar: ul.grammar,
        pronunciation: ul.pronunciation,
      };

      return {
        id: ul.id,
        code: ul.language.code,
        name: ul.language.name,
        flag: ul.language.flag,
        currentLevel: ul.currentLevel,
        targetLevel: ul.targetLevel,
        priority: ul.priority,
        minutesPerDay: ul.minutesPerDay,
        skills,
        /** Nota composta 0-100, ponderada pelas competencias que mais importam. */
        compositeScore: Math.round(compositeScore(skills) * 10) / 10,
        suggestedLevel: suggestedLevel(ul.currentLevel, compositeScore(skills)),
      };
    });
  }

  /** Ajusta minutos por idioma; o total precisa bater com dailyMinutes. */
  async updateDistribution(userId: string, distribution: Record<string, number>) {
    const languages = await this.prisma.language.findMany();
    const byCode = new Map(languages.map((l) => [l.code, l.id]));

    for (const [code, minutes] of Object.entries(distribution)) {
      const languageId = byCode.get(code);
      if (!languageId) throw new NotFoundException(`Idioma "${code}" nao encontrado.`);
      await this.prisma.userLanguage.update({
        where: { userId_languageId: { userId, languageId } },
        data: { minutesPerDay: Math.max(0, Math.round(minutes)) },
      });
    }

    const total = Object.values(distribution).reduce((sum, m) => sum + m, 0);
    await this.prisma.user.update({
      where: { id: userId },
      data: { dailyMinutes: Math.max(10, Math.round(total)) },
    });

    return this.forUser(userId);
  }
}

function compositeScore(skills: Record<string, number>): number {
  return Object.entries(SKILL_WEIGHTS).reduce(
    (sum, [skill, weight]) => sum + (skills[skill] ?? 0) * weight,
    0,
  );
}

/**
 * Sugere subir de nivel apenas quando a nota composta se sustenta alto.
 * A promocao continua sendo uma decisao explicita, nao automatica.
 */
function suggestedLevel(current: CefrLevel, score: number): CefrLevel {
  const index = LEVEL_ORDER.indexOf(current);
  if (score >= 85 && index < LEVEL_ORDER.length - 1) return LEVEL_ORDER[index + 1];
  if (score < 30 && index > 0) return LEVEL_ORDER[index - 1];
  return current;
}
