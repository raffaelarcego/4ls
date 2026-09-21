import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Pillar } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AiRouterService } from '../../infrastructure/ai/ai-router.service';
import { planPrompt } from '../../infrastructure/ai/prompts';
import { ErrorsService } from '../errors/errors.service';
import { GamificationService } from '../gamification/gamification.service';
import { SESSION_COMPLETION_XP, xpForActivity } from '../gamification/xp.rules';
import { ReviewService } from '../review/review.service';
import { AlphabetService } from '../alphabet/alphabet.service';
import { AssessmentService } from '../assessment/assessment.service';
import { FoundationService } from '../foundation/foundation.service';
import { hasMorphology } from '../morphology/morphology.catalog';
import { TrapsService } from '../traps/traps.service';
import {
  dailyTypesFor,
  LanguageState,
  MissionPlan,
  pillarForType,
  planSession,
  PlannedActivity,
} from './mission.engine';

/**
 * De quantos em quantos dias volta a producao quadrupla.
 *
 * Semanal, nao diaria. Escrever a mesma frase em quatro idiomas e o exercicio
 * mais duro do produto e, se virasse rotina, mediria memoria de curto prazo em
 * vez de aquisicao: os conceitos precisam de tempo para assentar entre uma
 * producao e a seguinte.
 */
const PRODUCTION_INTERVAL_DAYS = 7;

@Injectable()
export class StudyService {
  private readonly logger = new Logger(StudyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewService,
    private readonly errors: ErrorsService,
    private readonly gamification: GamificationService,
    private readonly ai: AiRouterService,
    private readonly alphabet: AlphabetService,
    private readonly foundation: FoundationService,
    private readonly assessment: AssessmentService,
    private readonly traps: TrapsService,
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
    return this.prisma.studySession.findFirst({
      where: { userId, date: todayWindow() },
      include: { activities: { include: { language: true }, orderBy: { order: 'asc' } } },
    });
  }

  /** Monta o estado do aluno que alimenta o planejador. */
  private async collectState(userId: string): Promise<{
    languages: LanguageState[];
    totalMinutes: number;
    includeProduction: boolean;
    includeAssessment: boolean;
  }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        userLanguages: { include: { language: true }, orderBy: { priority: 'asc' } },
      },
    });

    const dueCounts = await this.reviews.dueCountByLanguage(userId);
    // Uma consulta so para os quatro idiomas: o bloco de armadilhas depende
    // dela, e pedir por idioma dentro do laco seriam quatro varreduras.
    const interference = await this.traps.interferenceCountByLanguage(userId);

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
        needsAlphabet: await this.alphabet.needsAlphabet(userId, code),
        needsFoundation: await this.foundation.needsFoundation(userId, code),
        // Fato sobre a lingua, nao sobre o aluno: vem do catalogo, sem consulta.
        hasMorphology: hasMorphology(code),
        interferenceErrors: interference[code] ?? 0,
        recentTypes: recentActivities
          .filter((a) => a.language.code === code)
          .slice(0, 6)
          .map((a) => a.type),
      });
    }

    return {
      languages,
      totalMinutes: user.dailyMinutes,
      includeProduction: await this.productionIsDue(userId),
      includeAssessment: await this.assessment.isDue(userId),
    };
  }

  /**
   * Faz uma semana ou mais desde a ultima producao quadrupla?
   *
   * Conta a ATIVIDADE criada, e nao a concluida, de proposito: se ela fosse
   * medida pela conclusao, um bloco pulado a traria de volta todo dia seguinte
   * -- e o aluno que pulou uma vez por falta de tempo passaria a ve-la sempre,
   * que e a forma mais rapida de transformar o bloco mais dificil do produto
   * numa irritacao diaria.
   */
  private async productionIsDue(userId: string): Promise<boolean> {
    const since = new Date();
    since.setDate(since.getDate() - PRODUCTION_INTERVAL_DAYS);

    const recent = await this.prisma.activity.findFirst({
      where: { session: { userId }, type: 'production', createdAt: { gte: since } },
      select: { id: true },
    });

    return recent === null;
  }

  private async createSession(userId: string, useAi: boolean) {
    const { languages, totalMinutes, includeProduction, includeAssessment } =
      await this.collectState(userId);

    let plan = planSession(languages, totalMinutes, { includeProduction, includeAssessment });

    // A IA e refinamento opcional: se falhar, seguimos com o plano deterministico.
    if (useAi && this.ai.hasProvider()) {
      plan = await this.refineWithAi(userId, languages, totalMinutes, plan);
    }

    const languageIds = await this.languageIdMap();

    /*
     * A criacao e serializada por usuario.
     *
     * "Procura, e se nao achar cria" nao basta: o dashboard e a tela de sessao
     * pedem o dia ao mesmo tempo, e duas chamadas simultaneas nao encontram
     * nada, criam uma sessao cada e o aluno fica com dois planos diferentes
     * para o mesmo dia. Reproduzido: cinco chamadas em paralelo geraram cinco
     * sessoes em menos de um segundo.
     *
     * A trava so envolve a reconferencia e o insert. O caro -- montar o estado,
     * planejar e o refinamento por IA -- fica de fora de proposito: segurar a
     * trava durante uma chamada de IA prenderia a conexao por minutos.
     *
     * `pg_advisory_xact_lock` e liberado sozinho no fim da transacao, inclusive
     * se ela falhar, entao nao ha trava orfa para limpar.
     */
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

        const concurrent = await tx.studySession.findFirst({
          where: { userId, date: todayWindow() },
          include: { activities: { include: { language: true }, orderBy: { order: 'asc' } } },
        });
        if (concurrent) return concurrent;

        return tx.studySession.create({
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
      },
      /*
       * Os 5s padrao do Prisma nao servem aqui: quem espera na trava segura a
       * transacao aberta enquanto o primeiro monta o dia, e montar o dia sozinho
       * ja custa perto de 5s (sao 13 atividades inseridas contra um Postgres
       * remoto). A espera e limitada por essa criacao, nao por trabalho proprio
       * -- assim que o primeiro termina, os outros so releem e devolvem.
       */
      { timeout: 20_000, maxWait: 15_000 },
    );
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

      /*
       * Estrutura e vocabulario sao regra do produto, nao preferencia do
       * planejador -- o mesmo conceito nos quatro idiomas e a regra de frase de
       * cada um. A IA e refinamento, e refinamento nao tem licenca para
       * remover a promessa: um plano sem esses dois blocos em algum idioma cai
       * inteiro para o deterministico, que os garante por construcao.
       *
       * O idioma em modo alfabeto e cobrado pelo bloco que o substitui, e nao
       * por `structure`: exigir a aula de frase de quem ainda nao le rejeitaria
       * TODO plano refinado enquanto a trilha durasse.
       */
      const keepsDaily = languages.every((l) =>
        dailyTypesFor(l).every((type) =>
          valid.some((a) => a.languageCode === l.code && a.type === type),
        ),
      );

      /*
       * A moldura cross-language e cobrada pela mesma regra, e nao por tipo
       * fixo: so e exigida quando o plano deterministico tambem a criou.
       *
       * Ela depende do tamanho do dia e do numero de idiomas, entao exigi-la
       * sempre rejeitaria todo plano refinado num dia curto -- justamente o dia
       * em que o refinamento mais ajudaria. E quando ela cabe, ela nao e
       * opcional: contraste e comparacao sao a exigencia central do aluno, e a
       * IA nao tem licenca para remove-la.
       */
      const keepsFrame = fallback.activities
        .filter((a) => a.type === 'contrast' || a.type === 'compare')
        .every((a) => valid.some((v) => v.type === a.type));

      if (
        valid.length === 0 ||
        !coversAll ||
        !keepsDaily ||
        !keepsFrame ||
        Math.abs(planned - totalMinutes) > 10
      ) {
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
  // Producao quadrupla e escrita livre, so que em quatro frentes ao mesmo
  // tempo -- move a mesma competencia.
  production: 'writing',
  // Os dois blocos cross-language movem a competencia do idioma que os
  // hospeda nominalmente -- e o mesmo campo que o motor usa para ranquear, para
  // o bloco nao melhorar uma nota que ninguem consulta no dia seguinte.
  contrast: 'grammar',
  compare: 'writing',
  speaking: 'speaking',
  // Repetir a frase inteira no ritmo certo e fala, como o Speaking Lab.
  shadowing: 'speaking',
  tutor: 'speaking',
  vocabulary: 'vocabScore',
  review: 'vocabScore',
  // Montar frase e gramatica aplicada -- e o mesmo campo que o mission engine
  // usa para ranquear estrutura, senao o bloco melhoraria uma nota que ninguem
  // consulta para decidir o dia seguinte.
  structure: 'grammar',
  grammar: 'grammar',
  // Terminacao certa e gramatica aplicada -- o mesmo campo que o motor usa para
  // ranquear o bloco.
  morphology: 'grammar',
  // Desfazer interferencia melhora a mesma competencia que o motor consulta
  // para ranquear o bloco.
  traps: 'grammar',
  // Decodificar letra a som e leitura -- mesma competencia que o motor usa para
  // ranquear o bloco.
  alphabet: 'reading',
  // A prova ja grava a nota por idioma e ja move a competencia com peso
  // proprio (ver AssessmentService.record). Deixa-la tambem passar por aqui
  // aplicaria o ajuste duas vezes, e a segunda com peso de bloco comum --
  // diluindo justamente a unica medida objetiva do sistema.
  // Montar a frase com as primeiras pecas e gramatica, como estrutura -- e o
  // mesmo campo que o mission engine usa para ranquear os dois.
  foundation: 'grammar',
  // O chefe de fase tambem fica de fora, e por um motivo mais forte que o da
  // prova: vencer ENCOLHE as competencias de proposito (a regua do nivel novo e
  // outra). Deixa-lo passar por aqui devolveria por cima o que a promocao
  // acabou de baixar, e o chefe seguinte abriria no dia seguinte.
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

/** A janela do dia de hoje, para achar a sessao ja planejada. */
function todayWindow(): { gte: Date; lt: Date } {
  const start = startOfDay(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}
