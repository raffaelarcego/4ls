import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tempo total estudado por idioma, em horas. */
  async timePerLanguage(userId: string) {
    const rows = await this.prisma.activity.groupBy({
      by: ['languageId'],
      where: { session: { userId }, completed: true },
      _sum: { durationSeconds: true },
    });

    const languages = await this.prisma.language.findMany();
    const byId = new Map(languages.map((l) => [l.id, l]));

    return rows.map((r) => ({
      languageCode: byId.get(r.languageId)?.code ?? '',
      languageName: byId.get(r.languageId)?.name ?? '',
      hours: Math.round(((r._sum.durationSeconds ?? 0) / 3600) * 10) / 10,
    }));
  }

  /** Consistencia: dias com sessao concluida nos ultimos N dias. */
  async consistency(userId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const sessions = await this.prisma.studySession.findMany({
      where: { userId, completed: true, date: { gte: since } },
      select: { date: true, xpEarned: true, durationSeconds: true },
    });

    const byDay = new Map<string, { xp: number; seconds: number }>();
    for (const s of sessions) {
      const key = s.date.toISOString().slice(0, 10);
      const entry = byDay.get(key) ?? { xp: 0, seconds: 0 };
      entry.xp += s.xpEarned;
      entry.seconds += s.durationSeconds;
      byDay.set(key, entry);
    }

    return {
      days,
      activeDays: byDay.size,
      percentage: Math.round((byDay.size / days) * 100),
      timeline: Array.from(byDay.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  /**
   * Observabilidade de IA: custo, latencia e taxa de erro por modelo.
   * E isto que responde "qual modelo e melhor e qual e mais barato".
   */
  async aiUsage(userId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await this.prisma.aiCallLog.groupBy({
      by: ['provider', 'model', 'success'],
      where: { userId, createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true, estimatedCost: true },
      _avg: { latencyMs: true },
    });

    const byModel = new Map<
      string,
      {
        provider: string;
        model: string;
        calls: number;
        failures: number;
        inputTokens: number;
        outputTokens: number;
        estimatedCost: number;
        avgLatencyMs: number;
      }
    >();

    for (const row of rows) {
      const key = row.provider + '::' + row.model;
      const entry = byModel.get(key) ?? {
        provider: row.provider,
        model: row.model,
        calls: 0,
        failures: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCost: 0,
        avgLatencyMs: 0,
      };

      entry.calls += row._count._all;
      if (!row.success) entry.failures += row._count._all;
      entry.inputTokens += row._sum.inputTokens ?? 0;
      entry.outputTokens += row._sum.outputTokens ?? 0;
      entry.estimatedCost += row._sum.estimatedCost ?? 0;
      entry.avgLatencyMs = Math.round(row._avg.latencyMs ?? 0);
      byModel.set(key, entry);
    }

    return Array.from(byModel.values()).sort((a, b) => b.calls - a.calls);
  }

  /** Weekly Review: evolucao das competencias e recomendacao da semana. */
  async weeklyReview(userId: string) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const [sessions, assessments, languages] = await Promise.all([
      this.prisma.studySession.findMany({
        where: { userId, date: { gte: weekStart }, completed: true },
        select: { durationSeconds: true, xpEarned: true },
      }),
      this.prisma.assessment.findMany({
        where: { userId, createdAt: { gte: weekStart } },
        include: { language: { select: { code: true, name: true } } },
      }),
      this.prisma.userLanguage.findMany({
        where: { userId },
        include: { language: true },
      }),
    ]);

    const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);

    const perLanguage = languages.map((ul) => {
      const skills = [ul.listening, ul.reading, ul.writing, ul.speaking, ul.vocabScore, ul.grammar];
      const weakest = [
        { name: 'listening', value: ul.listening },
        { name: 'reading', value: ul.reading },
        { name: 'writing', value: ul.writing },
        { name: 'speaking', value: ul.speaking },
        { name: 'vocabulary', value: ul.vocabScore },
        { name: 'grammar', value: ul.grammar },
      ].sort((a, b) => a.value - b.value)[0];

      return {
        code: ul.language.code,
        name: ul.language.name,
        level: ul.currentLevel,
        average: Math.round((skills.reduce((a, b) => a + b, 0) / skills.length) * 10) / 10,
        weakestSkill: weakest.name,
        weakestScore: Math.round(weakest.value),
        assessmentsThisWeek: assessments.filter((a) => a.language.code === ul.language.code).length,
      };
    });

    const worst = [...perLanguage].sort((a, b) => a.weakestScore - b.weakestScore)[0];

    return {
      totalHours: Math.round((totalSeconds / 3600) * 10) / 10,
      sessionsCompleted: sessions.length,
      xpEarned: sessions.reduce((sum, s) => sum + s.xpEarned, 0),
      languages: perLanguage,
      recommendation: worst
        ? `Priorize ${worst.weakestSkill} em ${worst.name} na proxima semana (nota atual: ${worst.weakestScore}%).`
        : 'Continue com a distribuicao atual.',
    };
  }
}
