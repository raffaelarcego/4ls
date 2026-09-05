import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Pillar } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AiRouterService } from '../../infrastructure/ai/ai-router.service';
import { planPrompt } from '../../infrastructure/ai/prompts';
import { ErrorsService } from '../errors/errors.service';
import { GamificationService } from '../gamification/gamification.service';
import { SESSION_COMPLETION_XP, xpForActivity } from '../gamification/xp.rules';
import { ReviewService } from '../review/review.service';
import {
  LanguageState,
  MissionPlan,
  pillarForType,
  planSession,
  PlannedActivity,
} from './mission.engine';

@Injectable()
export class StudyService {
  private readonly logger = new Logger(StudyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewService,
    private readonly errors: ErrorsService,
    private readonly gamification: GamificationService,
    private readonly ai: AiRouterService,
  ) {}

  /**
   * Retorna a sessao de hoje. Se ainda nao existir, planeja uma nova.
   * Chamar duas vezes no mesmo dia devolve a mesma sessao -- o plano do dia
   * nao deve mudar embaixo do usuario no meio do estudo.
   */
  async todaySession(userId: string, useAi = false) {
    const existing = await this.findTodaySession(userId);
    if (existing) return this.serialize(existing);

    const created = await this.createSession(userId, useAi);
    return this.serialize(created);
  }

  private async findTodaySession(userId: string) {
    const start = startOfDay(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return this.prisma.studySession.findFirst({
      where: { userId, date: { gte: start, lt: end } },
      include: { activities: { include: { language: true }, orderBy: { order: 'asc' } } },
    });
  }

  /** Monta o estado do aluno que alimenta o planejador. */
  private async collectState(userId: string): Promise<{
    languages: LanguageState[];
    totalMinutes: number;
  }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        userLanguages: { include: { language: true }, orderBy: { priority: 'asc' } },
      },
    });

    const dueCounts = await this.reviews.dueCountByLanguage(userId);

    // Tipos das ultimas 3 sessoes, por idioma, para forcar variedade.
    const recentActivities = await this.prisma.activity.findMany({
      where: { session: { userId } },
      include: { language: { select: { code: true } } },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    const languages: LanguageState[] = [];

    for (const ul of user.userLanguages) {
      const code = ul.language.code;
      const errorRows = await this.errors.byCategory(userId, code);

      languages.push({
        code,
        name: ul.language.name,
        level: ul.currentLevel,
        minutesPerDay: ul.minutesPerDay,
        dueReviews: dueCounts[code] ?? 0,
        skills: {
          listening: ul.listening,
          reading: ul.reading,
          writing: ul.writing,
          speaking: ul.speaking,
          vocabScore: ul.vocabScore,
          grammar: ul.grammar,
        },
        errorCounts: Object.fromEntries(errorRows.map((e) => [e.category, e.occurrences])),
        recentTypes: recentActivities
          .filter((a) => a.language.code === code)
          .slice(0, 6)
          .map((a) => a.type),
      });
    }

    return { languages, totalMinutes: user.dailyMinutes };
  }

  private async createSession(userId: string, useAi: boolean) {
    const { languages, totalMinutes } = await this.collectState(userId);

    let plan = planSession(languages, totalMinutes);

    // A IA e refinamento opcional: se falhar, seguimos com o plano deterministico.
    if (useAi && this.ai.hasProvider()) {
      plan = await this.refineWithAi(userId, languages, totalMinutes, plan);
    }

    const languageIds = await this.languageIdMap();

    const session = await this.prisma.studySession.create({
      data: {
        userId,
        plannedMinutes: totalMinutes,
        plan: plan as unknown as object,
        rationale: plan.rationale,
        activities: {
          create: plan.activities
            .filter((a) => languageIds.has(a.languageCode))
            .map((activity, index) => ({
              languageId: languageIds.get(activity.languageCode)!,
              pillar: activity.pillar,
              type: activity.type,
              order: index,
              plannedMinutes: activity.plannedMinutes,
              reason: activity.reason,
            })),
        },
      },
      include: { activities: { include: { language: true }, orderBy: { order: 'asc' } } },
    });

    return session;
  }

  private async refineWithAi(
    userId: string,
    languages: LanguageState[],
    totalMinutes: number,
    fallback: MissionPlan,
  ): Promise<MissionPlan> {
    try {
      const result = await this.ai.chatJson<{
        rationale: string;
        activities: PlannedActivity[];
      }>({
        task: 'plan.create',
        userId,
        messages: [
          {
            role: 'user',
            content: planPrompt({ totalMinutes, languages }),
          },
        ],
        temperature: 0.4,
      });

      const valid = (result.activities ?? []).filter(
        (a) =>
          a &&
          languages.some((l) => l.code === a.languageCode) &&
          typeof a.plannedMinutes === 'number' &&
          a.plannedMinutes > 0,
      );

      // Um plano da IA que perdeu idiomas ou estourou o tempo nao entra.
      const planned = valid.reduce((sum, a) => sum + a.plannedMinutes, 0);
      const coversAll = languages.every((l) => valid.some((a) => a.languageCode === l.code));

      if (valid.length === 0 || !coversAll || Math.abs(planned - totalMinutes) > 10) {
        this.logger.warn('Plano da IA rejeitado pela validacao; usando o plano deterministico.');
        return fallback;
      }

      return {
        totalMinutes: planned,
        rationale: result.rationale || fallback.rationale,
        activities: valid.map((a) => ({
          ...a,
          pillar: (a.pillar as Pillar) ?? Pillar.LEARN,
        })),
      };
    } catch (err) {
      this.logger.warn(`Planejamento com IA falhou: ${(err as Error).message}`);
      return fallback;
    }
  }


  /**
   * Adiciona um bloco avulso a sessao de hoje.
   *
   * O planejador decide o que voce *deveria* fazer, e essa continua sendo a
   * regra do produto. Mas ele so cabe uns poucos blocos no tempo do dia, entao
   * tipos legitimos (ditado, fala) podiam passar semanas sem nunca aparecer.
   * Aqui o aluno pede um bloco explicitamente -- ele entra na sessao como
   * qualquer outro, com o mesmo XP e o mesmo efeito nas subcompetencias, so
   * que com "voce escolheu" como motivo, para o historico nao mentir sobre
   * quem tomou a decisao.
   */
  async addPractice(
    userId: string,
    input: { languageCode: string; type: string; minutes?: number },
  ) {
    const session = (await this.findTodaySession(userId)) ?? (await this.createSession(userId, false));

    const language = await this.prisma.language.findUnique({
      where: { code: input.languageCode },
    });
    if (!language) throw new NotFoundException(`Idioma "${input.languageCode}" nao encontrado.`);

    const enrolled = await this.prisma.userLanguage.findUnique({
      where: { userId_languageId: { userId, languageId: language.id } },
    });
    if (!enrolled) {
      throw new NotFoundException(`Voce nao esta estudando o idioma "${input.languageCode}".`);
    }

    // Vai para o fim da fila: o bloco escolhido nao atropela o que o
    // planejador ja tinha decidido para hoje.
    const last = await this.prisma.activity.aggregate({
      where: { sessionId: session.id },
      _max: { order: true },
    });

    const minutes = Math.min(20, Math.max(3, input.minutes ?? 5));

    const activity = await this.prisma.activity.create({
      data: {
        sessionId: session.id,
        languageId: language.id,
        pillar: pillarForType(input.type),
        type: input.type,
        order: (last._max.order ?? -1) + 1,
        plannedMinutes: minutes,
        reason: 'Voce escolheu treinar este bloco.',
      },
      include: { language: true },
    });

    await this.prisma.studySession.update({
      where: { id: session.id },
      data: { plannedMinutes: { increment: minutes } },
    });

    return {
      id: activity.id,
      sessionId: session.id,
      languageCode: language.code,
      languageName: language.name,
      pillar: activity.pillar,
      type: activity.type,
      order: activity.order,
      plannedMinutes: activity.plannedMinutes,
      durationSeconds: 0,
      completed: false,
      score: null,
      xpEarned: 0,
      reason: activity.reason,
    };
  }

  /** Marca uma atividade como concluida e credita o XP correspondente. */
  async completeActivity(
    userId: string,
    activityId: string,
    input: { durationSeconds: number; score?: number },
  ) {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, session: { userId } },
    });
    if (!activity) throw new NotFoundException('Atividade nao encontrada.');
    if (activity.completed) return activity;

    const xpEarned = xpForActivity(activity.type);

    const [updated] = await this.prisma.$transaction([
      this.prisma.activity.update({
        where: { id: activity.id },
        data: {
          completed: true,
          durationSeconds: input.durationSeconds,
          score: input.score,
          xpEarned,
        },
      }),
      this.prisma.studySession.update({
        where: { id: activity.sessionId },
        data: {
          xpEarned: { increment: xpEarned },
          durationSeconds: { increment: input.durationSeconds },
        },
      }),
    ]);

    if (typeof input.score === 'number') {
      await this.updateSkillScore(userId, activity.languageId, activity.type, input.score);
    }

    return updated;
  }

  /** Fecha a sessao, credita o bonus, atualiza streak e avalia conquistas. */
  async completeSession(userId: string, sessionId: string) {
    const session = await this.prisma.studySession.findFirst({
      where: { id: sessionId, userId },
      include: { activities: true },
    });
    if (!session) throw new NotFoundException('Sessao nao encontrada.');
    if (session.completed) {
      return { session, newAchievements: [], streak: await this.gamification.getStreak(userId) };
    }

    const updated = await this.prisma.studySession.update({
      where: { id: session.id },
      data: {
        completed: true,
        completedAt: new Date(),
        xpEarned: { increment: SESSION_COMPLETION_XP },
      },
      include: { activities: { include: { language: true }, orderBy: { order: 'asc' } } },
    });

    const streak = await this.gamification.touchStreak(userId);
    const newAchievements = await this.gamification.evaluateAchievements(userId);

    return { session: this.serialize(updated), newAchievements, streak };
  }

  /**
   * Move a subcompetencia na direcao do desempenho observado.
   * Media movel exponencial: um resultado ruim isolado nao derruba o perfil.
   */
  private async updateSkillScore(
    userId: string,
    languageId: string,
    activityType: string,
    score: number,
  ) {
    const field = SKILL_FIELD_BY_TYPE[activityType];
    if (!field) return;

    const userLanguage = await this.prisma.userLanguage.findUnique({
      where: { userId_languageId: { userId, languageId } },
    });
    if (!userLanguage) return;

    const current = (userLanguage as unknown as Record<string, number>)[field] ?? 0;
    const next = current === 0 ? score : current * 0.8 + score * 0.2;

    await this.prisma.userLanguage.update({
      where: { id: userLanguage.id },
      data: { [field]: Math.round(next * 10) / 10 },
    });
  }

  async history(userId: string, limit = 30) {
    const sessions = await this.prisma.studySession.findMany({
      where: { userId },
      include: { activities: { include: { language: true } } },
      orderBy: { date: 'desc' },
      take: limit,
    });
    return sessions.map((s) => this.serialize(s));
  }

  private async languageIdMap(): Promise<Map<string, string>> {
    const languages = await this.prisma.language.findMany();
    return new Map(languages.map((l) => [l.code, l.id]));
  }

  private serialize(session: SessionWithActivities) {
    return {
      id: session.id,
      date: session.date,
      plannedMinutes: session.plannedMinutes,
      durationSeconds: session.durationSeconds,
      xpEarned: session.xpEarned,
      completed: session.completed,
      rationale: session.rationale,
      activities: (session.activities ?? []).map((a) => ({
        id: a.id,
        languageCode: 'language' in a && a.language ? a.language.code : '',
        languageName: 'language' in a && a.language ? a.language.name : '',
        pillar: a.pillar,
        type: a.type,
        order: a.order,
        plannedMinutes: a.plannedMinutes,
        durationSeconds: a.durationSeconds,
        completed: a.completed,
        score: a.score,
        xpEarned: a.xpEarned,
        reason: a.reason,
      })),
    };
  }
}

const SKILL_FIELD_BY_TYPE: Record<string, string> = {
  listening: 'listening',
  // Ditado move escuta, igual ao mission engine, que tambem o ranqueia por ela.
  dictation: 'listening',
  reading: 'reading',
  writing: 'writing',
  speaking: 'speaking',
  tutor: 'speaking',
  vocabulary: 'vocabScore',
  review: 'vocabScore',
  grammar: 'grammar',
};

type SessionWithActivities = {
  id: string;
  date: Date;
  plannedMinutes: number;
  durationSeconds: number;
  xpEarned: number;
  completed: boolean;
  rationale: string | null;
  activities?: Array<{
    id: string;
    pillar: Pillar;
    type: string;
    order: number;
    plannedMinutes: number;
    durationSeconds: number;
    completed: boolean;
    score: number | null;
    xpEarned: number;
    reason: string | null;
    language?: { code: string; name: string };
  }>;
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
