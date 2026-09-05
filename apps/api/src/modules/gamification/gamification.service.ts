import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/** Conquistas avaliadas apos cada sessao concluida. */
const ACHIEVEMENT_RULES: Array<{
  code: string;
  check: (s: UserStats) => boolean;
}> = [
  { code: 'FIRST_SESSION', check: (s) => s.sessionsCompleted >= 1 },
  { code: 'STREAK_7', check: (s) => s.streak >= 7 },
  { code: 'STREAK_30', check: (s) => s.streak >= 30 },
  { code: 'WORDS_100', check: (s) => s.vocabularyCount >= 100 },
  { code: 'WORDS_1000', check: (s) => s.vocabularyCount >= 1000 },
  { code: 'FIRST_CONVERSATION', check: (s) => s.conversations >= 1 },
  { code: 'TEN_SESSIONS', check: (s) => s.sessionsCompleted >= 10 },
];

interface UserStats {
  sessionsCompleted: number;
  streak: number;
  vocabularyCount: number;
  conversations: number;
}

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atualiza o streak considerando o dia local do usuario.
   * Estudar duas vezes no mesmo dia nao incrementa; pular um dia zera.
   */
  async touchStreak(userId: string) {
    const streak =
      (await this.prisma.streak.findUnique({ where: { userId } })) ??
      (await this.prisma.streak.create({ data: { userId } }));

    const today = startOfDay(new Date());
    const last = streak.lastActiveDay ? startOfDay(streak.lastActiveDay) : null;

    if (last && last.getTime() === today.getTime()) {
      return streak; // ja contabilizado hoje
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const continued = last !== null && last.getTime() === yesterday.getTime();
    const current = continued ? streak.current + 1 : 1;

    return this.prisma.streak.update({
      where: { userId },
      data: {
        current,
        longest: Math.max(current, streak.longest),
        lastActiveDay: today,
      },
    });
  }

  async getStreak(userId: string) {
    const streak = await this.prisma.streak.findUnique({ where: { userId } });
    if (!streak) return { current: 0, longest: 0, lastActiveDay: null };

    // Se o usuario perdeu um dia, o streak exibido ja deve ser 0.
    const today = startOfDay(new Date());
    const last = streak.lastActiveDay ? startOfDay(streak.lastActiveDay) : null;
    if (last) {
      const daysSince = Math.round((today.getTime() - last.getTime()) / 86_400_000);
      if (daysSince > 1) return { ...streak, current: 0 };
    }
    return streak;
  }

  /** XP de hoje e da semana corrente. */
  async xpSummary(userId: string) {
    const today = startOfDay(new Date());
    const weekStart = startOfDay(new Date());
    weekStart.setDate(weekStart.getDate() - 6);

    const [todayAgg, weekAgg, totalAgg] = await Promise.all([
      this.prisma.studySession.aggregate({
        where: { userId, date: { gte: today } },
        _sum: { xpEarned: true },
      }),
      this.prisma.studySession.aggregate({
        where: { userId, date: { gte: weekStart } },
        _sum: { xpEarned: true },
      }),
      this.prisma.studySession.aggregate({
        where: { userId },
        _sum: { xpEarned: true },
      }),
    ]);

    return {
      today: todayAgg._sum.xpEarned ?? 0,
      week: weekAgg._sum.xpEarned ?? 0,
      total: totalAgg._sum.xpEarned ?? 0,
    };
  }

  /** Avalia todas as regras e desbloqueia o que for novo. Retorna as novas. */
  async evaluateAchievements(userId: string) {
    const [sessionsCompleted, streak, vocabularyCount, conversations] = await Promise.all([
      this.prisma.studySession.count({ where: { userId, completed: true } }),
      this.getStreak(userId).then((s) => s.current),
      this.prisma.userVocabulary.count({ where: { userId } }),
      this.prisma.conversation.count({ where: { userId } }),
    ]);

    const stats: UserStats = { sessionsCompleted, streak, vocabularyCount, conversations };
    const earnedCodes = ACHIEVEMENT_RULES.filter((r) => r.check(stats)).map((r) => r.code);
    if (earnedCodes.length === 0) return [];

    const achievements = await this.prisma.achievement.findMany({
      where: { code: { in: earnedCodes } },
    });
    const already = await this.prisma.userAchievement.findMany({
      where: { userId, achievementId: { in: achievements.map((a) => a.id) } },
      select: { achievementId: true },
    });
    const alreadyIds = new Set(already.map((a) => a.achievementId));
    const toUnlock = achievements.filter((a) => !alreadyIds.has(a.id));

    if (toUnlock.length === 0) return [];

    await this.prisma.userAchievement.createMany({
      data: toUnlock.map((a) => ({ userId, achievementId: a.id })),
      skipDuplicates: true,
    });

    return toUnlock;
  }

  async listAchievements(userId: string) {
    const [all, unlocked] = await Promise.all([
      this.prisma.achievement.findMany({ orderBy: { xp: 'asc' } }),
      this.prisma.userAchievement.findMany({ where: { userId } }),
    ]);
    const unlockedMap = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt]));

    return all.map((a) => ({
      ...a,
      unlocked: unlockedMap.has(a.id),
      unlockedAt: unlockedMap.get(a.id) ?? null,
    }));
  }
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
