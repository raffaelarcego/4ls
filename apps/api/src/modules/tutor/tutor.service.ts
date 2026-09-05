import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCategory } from '@prisma/client';
import { AiRouterService } from '../../infrastructure/ai/ai-router.service';
import {
  correctionPrompt,
  dictationPrompt,
  exercisePrompt,
  LearnerContext,
  listeningPrompt,
  speakingMissionPrompt,
  speakingPrompt,
  tutorSystemPrompt,
  writingPrompt,
} from '../../infrastructure/ai/prompts';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ErrorsService } from '../errors/errors.service';
import { VocabularyService } from '../vocabulary/vocabulary.service';

interface CorrectionResult {
  hasErrors: boolean;
  corrected: string;
  errors: Array<{
    category: string;
    description: string;
    explanation?: string;
    severity?: number;
  }>;
}

const VALID_CATEGORIES = new Set(Object.values(ErrorCategory) as string[]);

/**
 * Quantos dialogos distintos manter por idioma e nivel antes de comecar a
 * reaproveitar. Oito da variedade suficiente para o aluno nao reconhecer o
 * conteudo de cor, e e barato: sao oito geracoes por nivel, uma vez so.
 */
const LISTENING_POOL_TARGET = 8;

interface DialogueLine {
  speaker: string;
  text: string;
  translation: string;
}

interface ComprehensionQuestion {
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface GeneratedListening {
  title: string;
  context: string;
  lines: DialogueLine[];
  questions: ComprehensionQuestion[];
  vocabulary?: Array<{ term: string; meaning: string }>;
}

/** Uma linha do pool volta com o mesmo formato do que a IA acabou de gerar. */
function serializeListening(
  row: {
    id: string;
    title: string;
    context: string;
    lines: unknown;
    questions: unknown;
    vocabulary: unknown;
  },
  /**
   * Vem de quem chamou, nao de `timesUsed`: a linha e lida antes do
   * incremento, entao derivar do contador daria a resposta errada.
   */
  reused: boolean,
) {
  return {
    id: row.id,
    title: row.title,
    context: row.context,
    lines: (row.lines ?? []) as DialogueLine[],
    questions: (row.questions ?? []) as ComprehensionQuestion[],
    vocabulary: (row.vocabulary ?? []) as Array<{ term: string; meaning: string }>,
    // O front nao usa, mas o campo torna obvio de onde o conteudo veio.
    reused,
  };
}

@Injectable()
export class TutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiRouterService,
    private readonly errors: ErrorsService,
    private readonly vocabulary: VocabularyService,
  ) {}

  /** Monta o contexto do aluno que vai para dentro do prompt. */
  private async buildContext(userId: string, languageCode: string): Promise<LearnerContext> {
    const userLanguage = await this.prisma.userLanguage.findFirst({
      where: { userId, language: { code: languageCode } },
      include: { language: true },
    });
    if (!userLanguage) {
      throw new NotFoundException(`Voce nao esta estudando o idioma "${languageCode}".`);
    }

    const [recentErrors, recentVocabulary] = await Promise.all([
      this.errors.summaryForPrompt(userId, languageCode),
      this.vocabulary.recentTerms(userId, languageCode),
    ]);

    return {
      languageName: userLanguage.language.name,
      languageCode,
      level: userLanguage.currentLevel,
      recentErrors,
      recentVocabulary,
    };
  }

  private async languageId(code: string): Promise<string> {
    const language = await this.prisma.language.findUnique({ where: { code } });
    if (!language) throw new NotFoundException(`Idioma "${code}" nao encontrado.`);
    return language.id;
  }

  async listConversations(userId: string, languageCode?: string) {
    return this.prisma.conversation.findMany({
      where: { userId, ...(languageCode ? { language: { code: languageCode } } : {}) },
      include: { language: { select: { code: true, name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        language: { select: { code: true, name: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversa nao encontrada.');
    return conversation;
  }

  /**
   * Envia uma mensagem ao tutor.
   *
   * Faz duas chamadas de IA em paralelo: uma gera a resposta conversacional,
   * outra extrai as correcoes estruturadas. Separar as duas evita que o
   * modelo tenha de conversar e produzir JSON ao mesmo tempo -- na pratica ele
   * faz uma das duas coisas mal quando sao pedidas juntas.
   */
  async sendMessage(
    userId: string,
    input: { languageCode: string; content: string; conversationId?: string },
  ) {
    const context = await this.buildContext(userId, input.languageCode);
    const languageId = await this.languageId(input.languageCode);

    const conversation = input.conversationId
      ? await this.getConversation(userId, input.conversationId)
      : await this.prisma.conversation.create({
          data: {
            userId,
            languageId,
            title: input.content.slice(0, 60),
          },
          include: {
            language: { select: { code: true, name: true } },
            messages: true,
          },
        });

    const history = (conversation.messages ?? []).slice(-12).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const [reply, correction] = await Promise.all([
      this.ai.chat({
        task: 'tutor.chat',
        userId,
        language: input.languageCode,
        messages: [
          { role: 'system', content: tutorSystemPrompt(context) },
          ...history,
          { role: 'user', content: input.content },
        ],
      }),
      this.correct(userId, context, input.content).catch(() => null),
    ]);

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: input.content,
        correction: correction ? (correction as unknown as object) : undefined,
      },
    });

    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: reply.content,
      },
    });

    // O erro vira dado do perfil -- e o que fecha o ciclo do produto.
    if (correction?.hasErrors && correction.errors.length > 0) {
      await this.errors.recordMany(
        userId,
        languageId,
        correction.errors.filter((e) => VALID_CATEGORIES.has(e.category)).map((e) => ({
          category: e.category as ErrorCategory,
          description: e.description,
          explanation: e.explanation,
          severity: e.severity,
        })),
        { source: 'tutor', userText: input.content, correctedText: correction.corrected },
      );
    }

    return {
      conversationId: conversation.id,
      reply: assistantMessage.content,
      correction,
      provider: reply.provider,
      model: reply.model,
    };
  }

  private async correct(
    userId: string,
    context: LearnerContext,
    text: string,
  ): Promise<CorrectionResult> {
    return this.ai.chatJson<CorrectionResult>({
      task: 'tutor.correct',
      userId,
      language: context.languageCode,
      temperature: 0.1,
      messages: [{ role: 'user', content: correctionPrompt(context, text) }],
    });
  }

  /** Gera exercicios mirando as fraquezas atuais do aluno. */
  async generateExercises(
    userId: string,
    input: { languageCode: string; type: string; count?: number },
  ) {
    const context = await this.buildContext(userId, input.languageCode);
    return this.ai.chatJson<{ exercises: unknown[] }>({
      task: 'exercise.generate',
      userId,
      language: input.languageCode,
      temperature: 0.7,
      messages: [
        { role: 'user', content: exercisePrompt(context, input.type, input.count ?? 5) },
      ],
    });
  }

  /** Writing Lab: avalia o texto, devolve notas e registra os erros. */
  async evaluateWriting(
    userId: string,
    input: { languageCode: string; mission: string; text: string },
  ) {
    const context = await this.buildContext(userId, input.languageCode);
    const languageId = await this.languageId(input.languageCode);

    const result = await this.ai.chatJson<{
      scores: { grammar: number; vocabulary: number; coherence: number; naturalness: number };
      corrected: string;
      feedback: string;
      topErrors: Array<{
        category: string;
        description: string;
        explanation?: string;
        severity?: number;
      }>;
    }>({
      task: 'writing.correct',
      userId,
      language: input.languageCode,
      temperature: 0.2,
      messages: [
        { role: 'user', content: writingPrompt(context, input.mission, input.text) },
      ],
    });

    if (result.topErrors?.length) {
      await this.errors.recordMany(
        userId,
        languageId,
        result.topErrors.filter((e) => VALID_CATEGORIES.has(e.category)).map((e) => ({
          category: e.category as ErrorCategory,
          description: e.description,
          explanation: e.explanation,
          severity: e.severity,
        })),
        { source: 'writing', userText: input.text, correctedText: result.corrected },
      );
    }

    const average =
      (result.scores.grammar +
        result.scores.vocabulary +
        result.scores.coherence +
        result.scores.naturalness) /
      4;

    await this.prisma.assessment.create({
      data: {
        userId,
        languageId,
        skill: 'writing',
        score: average,
        estimatedLevel: context.level as never,
        detail: result.scores as unknown as object,
      },
    });

    return result;
  }

  /**
   * Dialogo de listening no nivel do aluno, com perguntas de compreensao.
   *
   * Os dialogos ficam num pool por idioma e nivel. Enquanto o pool nao enche,
   * cada bloco gera conteudo novo -- e o que garante variedade no inicio.
   * Depois disso, reaproveita o menos usado recentemente.
   *
   * O motivo e de custo, e vale explicar: `speech_clips` guarda o audio pela
   * hash do texto, entao ele so economiza se o texto repetir. Gerando um
   * dialogo novo toda vez, o texto nunca repetia e cada bloco de escuta pagava
   * sintese inteira. Com o pool, a partir da segunda volta o texto ja e
   * conhecido e o audio ja esta em cache: o bloco mais caro do sistema fica de
   * graca.
   *
   * O texto volta cru: quem transforma em audio e o front, pedindo cada fala
   * ao Speech Gateway.
   */
  async generateListening(
    userId: string,
    input: { languageCode: string; seconds?: number; fresh?: boolean },
  ) {
    const context = await this.buildContext(userId, input.languageCode);
    const where = { languageCode: input.languageCode, level: context.level };

    if (!input.fresh) {
      const pool = await this.prisma.listeningDialogue.count({ where });

      if (pool >= LISTENING_POOL_TARGET) {
        const reused = await this.prisma.listeningDialogue.findFirst({
          where,
          orderBy: [{ lastUsedAt: 'asc' }, { timesUsed: 'asc' }],
        });

        if (reused) {
          await this.prisma.listeningDialogue.update({
            where: { id: reused.id },
            data: { timesUsed: { increment: 1 }, lastUsedAt: new Date() },
          });
          return serializeListening(reused, true);
        }
      }
    }

    const result = await this.ai.chatJson<GeneratedListening>({
      task: 'listening.generate',
      userId,
      language: input.languageCode,
      temperature: 0.9,
      maxTokens: 1600,
      messages: [{ role: 'user', content: listeningPrompt(context, input.seconds ?? 45) }],
    });

    // Uma pergunta cuja resposta nao esta entre as opcoes trava o exercicio:
    // e mais seguro descartar a pergunta do que exibir algo impossivel.
    const questions = (result.questions ?? []).filter(
      (q) => Array.isArray(q.options) && q.options.includes(q.answer),
    );
    const lines = (result.lines ?? []).filter((l) => l?.text?.trim());

    // Dialogo sem falas nao entra no pool -- seria lixo permanente.
    if (lines.length === 0) {
      return { ...result, lines, questions, reused: false };
    }

    const stored = await this.prisma.listeningDialogue.create({
      data: {
        languageCode: input.languageCode,
        level: context.level,
        title: result.title ?? 'Diálogo',
        context: result.context ?? '',
        lines: lines as unknown as object,
        questions: questions as unknown as object,
        vocabulary: (result.vocabulary ?? []) as unknown as object,
        timesUsed: 1,
      },
    });

    return serializeListening(stored, false);
  }

  /** Frases para o exercicio de ditado. */
  async generateDictation(userId: string, input: { languageCode: string; count?: number }) {
    const context = await this.buildContext(userId, input.languageCode);
    return this.ai.chatJson<{
      sentences: Array<{ text: string; translation: string; focus: string }>;
    }>({
      task: 'dictation.generate',
      userId,
      language: input.languageCode,
      temperature: 0.7,
      messages: [{ role: 'user', content: dictationPrompt(context, input.count ?? 5) }],
    });
  }

  /** Missao do Speaking Lab: o que o aluno deve dizer. */
  async speakingMission(userId: string, input: { languageCode: string }) {
    const context = await this.buildContext(userId, input.languageCode);
    return this.ai.chatJson<{
      mission: string;
      promptInTarget: string;
      hints: string[];
    }>({
      task: 'speaking.mission',
      userId,
      language: input.languageCode,
      temperature: 0.9,
      messages: [{ role: 'user', content: speakingMissionPrompt(context) }],
    });
  }

  /**
   * Speaking Lab: avalia a transcricao da fala, registra os erros e guarda a
   * nota como Assessment -- o mesmo caminho do Writing Lab, para que fala e
   * escrita alimentem as subcompetencias CEFR pela mesma porta.
   */
  async evaluateSpeaking(
    userId: string,
    input: { languageCode: string; mission: string; transcript: string },
  ) {
    const context = await this.buildContext(userId, input.languageCode);
    const languageId = await this.languageId(input.languageCode);

    const result = await this.ai.chatJson<{
      scores: { grammar: number; vocabulary: number; fluency: number; taskCompletion: number };
      corrected: string;
      feedback: string;
      topErrors: Array<{
        category: string;
        description: string;
        explanation?: string;
        severity?: number;
      }>;
    }>({
      task: 'speaking.evaluate',
      userId,
      language: input.languageCode,
      temperature: 0.2,
      messages: [
        { role: 'user', content: speakingPrompt(context, input.mission, input.transcript) },
      ],
    });

    if (result.topErrors?.length) {
      await this.errors.recordMany(
        userId,
        languageId,
        result.topErrors.filter((e) => VALID_CATEGORIES.has(e.category)).map((e) => ({
          category: e.category as ErrorCategory,
          description: e.description,
          explanation: e.explanation,
          severity: e.severity,
        })),
        { source: 'speaking', userText: input.transcript, correctedText: result.corrected },
      );
    }

    const average =
      (result.scores.grammar +
        result.scores.vocabulary +
        result.scores.fluency +
        result.scores.taskCompletion) /
      4;

    await this.prisma.assessment.create({
      data: {
        userId,
        languageId,
        skill: 'speaking',
        score: average,
        estimatedLevel: context.level as never,
        detail: result.scores as unknown as object,
      },
    });

    return { ...result, average: Math.round(average) };
  }
}
