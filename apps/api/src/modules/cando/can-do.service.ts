import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  canDoLessonPrompt,
  CanDoLessonContext,
  CanDoLessonTarget,
} from '../../infrastructure/ai/prompts';
import { AiRouterService } from '../../infrastructure/ai/ai-router.service';
import { URGENT_TIMEOUT_MS } from '../../infrastructure/ai/ai.types';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CanDo, findCanDo, canDoTopicId } from './can-do.catalog';
import {
  canDoCandidates,
  canDoMastery,
  lowestCanDoLevel,
  rankCanDos,
  toProgressRows,
  topicIdsFor,
} from './can-do.selection';

/**
 * Quantas can-dos DISTINTAS manter prontas a frente do aluno. Mesma correcao
 * do bloco de estrutura: `rankCanDos` poe can-do nunca estudada na frente de
 * qualquer uma ja vista, entao tres copias da primeira nao impedem que a
 * SEGUNDA chegue vazia no dia seguinte -- que era o defeito.
 */
const POOL_AHEAD = 3;

/**
 * Copias da mesma can-do, para quando o catalogo do nivel ja estiver todo
 * preparado. So ai a escolha volta a can-dos ja vistas e a variacao importa.
 */
const POOL_DEPTH = 3;

/** Frases-modelo por aula. Tres ideias, cada uma realizada nos quatro idiomas. */
const SENTENCES_PER_LESSON = 3;

/** Peso do resultado novo na media movel de dominio. Igual ao de estrutura. */
const MASTERY_WEIGHT = 0.3;

export interface CanDoPart {
  text: string;
  /** A coluna da tabela de montagem a que esta peca pertence. */
  column: string;
}

export interface CanDoRealization {
  languageCode: string;
  sentence: string;
  romanization?: string | null;
  parts: CanDoPart[];
  note?: string;
}

export interface CanDoSentence {
  /** A ideia, em portugues. E ela que e a mesma nos quatro idiomas. */
  gloss: string;
  realizations: CanDoRealization[];
}

interface GeneratedCanDoLesson {
  sentences: CanDoSentence[];
  contrast: string;
}

/**
 * A aula de can-do: a mesma coisa dita nos quatro idiomas.
 *
 * Este modulo existe por causa da exigencia central do aluno -- aprender no
 * mesmo dia as MESMAS coisas nos quatro idiomas, para saber exatamente como
 * fazer algo em cada um. O bloco de estrutura nao entregava isso: ele e
 * organizado por regra de um idioma, entao no mesmo dia chegavam quatro aulas
 * sobre assuntos sem relacao, e nao havia o que comparar.
 *
 * Aqui a unidade e a funcao comunicativa, dita em portugues, e as quatro
 * realizacoes saem juntas. O assunto vem do catalogo do codigo; a IA so escreve
 * as frases.
 */
@Injectable()
export class CanDoService {
  private readonly logger = new Logger(CanDoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiRouterService,
  ) {}

  /**
   * A can-do de hoje, realizada nos quatro idiomas.
   *
   * Pool vazio nao e erro: a aula e gerada na hora. Ela e a operacao mais cara
   * do produto -- quatro idiomas numa resposta so, com cirilico dentro --, e e
   * por isso que a geracao urgente vai pelo provider de menor latencia: 24-29s
   * medidos, dentro dos 60s da funcao na Vercel. Ver `serve()`.
   */
  async today(userId: string) {
    const { languages, level } = await this.learner(userId);
    const candidates = canDoCandidates(languages.map((l) => l.level));

    if (candidates.length === 0) {
      throw new NotFoundException(`Ainda nao ha can-do para o nivel ${level}.`);
    }

    const rows = await this.progressRows(userId, candidates);
    const ranked = rankCanDos(candidates, rows, languages.length);
    const { canDo, content } = await this.serve(userId, ranked, level, languages);

    return {
      canDoId: canDo.id,
      question: canDo.question,
      goal: canDo.goal,
      level,
      /** As colunas sao as mesmas nos quatro idiomas: a ordem e que muda. */
      columns: canDo.columns,
      notes: canDo.notes,
      languages: languages.map((l) => ({
        code: l.code,
        name: l.name,
        level: l.level,
        mastery: Math.round(
          rows.find((r) => r.canDoId === canDo.id && r.languageCode === l.code)?.mastery ?? 0,
        ),
      })),
      /** O dominio agregado: so fecha quando fecha nos quatro. */
      mastery: Math.round(canDoMastery(canDo.id, rows, languages.length)),
      ...content,
    };
  }

  /**
   * A aula que vai para a tela, por ordem de preferencia: do pool, gerada na
   * hora, ou -- so se a geracao falhar -- a melhor can-do ja preparada.
   * Mesmo desenho do bloco de estrutura, e pela mesma razao.
   */
  private async serve(
    userId: string,
    ranked: CanDo[],
    level: string,
    languages: Array<{ code: string; name: string; level: string }>,
  ) {
    if (ranked.length === 0) {
      throw new NotFoundException(`Ainda nao ha can-do para o nivel ${level}.`);
    }

    const ideal = ranked[0];

    const ready = await this.fromPool(ideal, level);
    if (ready) return { canDo: ideal, content: ready };

    try {
      return { canDo: ideal, content: await this.generateNow(userId, ideal, level, languages) };
    } catch (error) {
      this.logger.warn(
        `Geracao urgente da can-do "${ideal.id}"/${level} falhou: ${(error as Error).message}. ` +
          'Procurando uma can-do ja preparada.',
      );
    }

    const prepared = await this.preparedIds(ranked, level);
    for (const canDo of ranked.slice(1)) {
      if (!prepared.has(canDo.id)) continue;
      const content = await this.fromPool(canDo, level);
      if (content) return { canDo, content };
    }

    throw new ServiceUnavailableException(
      `Nao consegui montar a aula de "${ideal.question}" nos quatro idiomas agora. ` +
        'Tente de novo em um minuto.',
    );
  }

  /** Gera a aula na hora e guarda no pool -- o aluno paga a espera uma vez. */
  private async generateNow(
    userId: string,
    canDo: CanDo,
    level: string,
    languages: Array<{ code: string; name: string; level: string }>,
  ) {
    const generated = await this.generate(userId, canDo, languages, true);

    const saved = await this.prisma.canDoLesson.create({
      data: {
        canDoId: canDo.id,
        level,
        question: canDo.question,
        columns: canDo.columns as unknown as object,
        sentences: generated.sentences as unknown as object,
        contrast: generated.contrast,
        timesUsed: 1,
        lastUsedAt: new Date(),
      },
    });

    return {
      sentences: (saved.sentences ?? []) as unknown as CanDoSentence[],
      contrast: saved.contrast,
    };
  }

  /** Quais destas can-dos ja tem pelo menos uma aula no pool. */
  private async preparedIds(canDos: CanDo[], level: string): Promise<Set<string>> {
    if (canDos.length === 0) return new Set();

    const rows = await this.prisma.canDoLesson.findMany({
      where: { level, canDoId: { in: canDos.map((c) => c.id) } },
      select: { canDoId: true },
      distinct: ['canDoId'],
    });

    return new Set(rows.map((r) => r.canDoId));
  }

  /**
   * Prepara as proximas can-dos de que o aluno vai precisar.
   *
   * Largura primeiro, pela mesma razao do bloco de estrutura: UMA aula para
   * cada uma das proximas `ahead` can-dos da fila, e so com o catalogo do
   * nivel inteiro coberto e que vale aprofundar a primeira ate `POOL_DEPTH`.
   *
   * Roda fora do horario de estudo (script/cron), onde alguns minutos por aula
   * nao incomodam ninguem. Gera so o que falta: idempotente e de graca quando o
   * pool ja esta cheio.
   */
  async warm(userId: string, ahead = POOL_AHEAD): Promise<number> {
    const { languages, level } = await this.learner(userId).catch(() => ({
      languages: [],
      level: 'A1' as const,
    }));
    if (languages.length === 0) return 0;

    const candidates = canDoCandidates(languages.map((l) => l.level));
    if (candidates.length === 0) return 0;

    const rows = await this.progressRows(userId, candidates);
    const ranked = rankCanDos(candidates, rows, languages.length);
    const prepared = await this.preparedIds(ranked, level);

    const missing = ranked.filter((c) => !prepared.has(c.id));
    let created = 0;

    for (const canDo of missing.slice(0, ahead)) {
      created += await this.fill(userId, canDo, level, languages, 1);
    }

    if (missing.length === 0) {
      created += await this.fill(userId, ranked[0], level, languages, POOL_DEPTH);
    }

    return created;
  }

  /** Gera aulas da can-do ate o pool dela chegar a `target`. */
  private async fill(
    userId: string,
    canDo: CanDo,
    level: string,
    languages: Array<{ code: string; name: string; level: string }>,
    target: number,
  ): Promise<number> {
    const where = { canDoId: canDo.id, level };
    const existing = await this.prisma.canDoLesson.count({ where });
    let created = 0;

    for (let i = existing; i < target; i += 1) {
      const generated = await this.generate(userId, canDo, languages);
      await this.prisma.canDoLesson.create({
        data: {
          ...where,
          question: canDo.question,
          columns: canDo.columns as unknown as object,
          sentences: generated.sentences as unknown as object,
          contrast: generated.contrast,
        },
      });
      created += 1;
      this.logger.log(`Aula de can-do preparada: ${canDo.id}/${level} (${i + 1}/${target}).`);
    }

    return created;
  }

  /**
   * Registra uma rodada num idioma.
   *
   * O progresso e POR IDIOMA mesmo sendo a mesma can-do: ele pode ja montar a
   * frase em espanhol e ainda errar a russa, e um numero so esconderia
   * exatamente o idioma que precisa voltar. O agregado se calcula na leitura.
   */
  async record(
    userId: string,
    canDoId: string,
    languageCode: string,
    correct: number,
    total: number,
  ) {
    const canDo = findCanDo(canDoId);
    if (!canDo) throw new NotFoundException(`Can-do "${canDoId}" nao existe.`);
    if (total <= 0) throw new NotFoundException('Rodada sem exercicios.');

    const score = Math.round((correct / total) * 100);
    const key = {
      userId_topicId_languageCode: {
        userId,
        topicId: canDoTopicId(canDoId),
        languageCode,
      },
    };

    const current = await this.prisma.grammarProgress.findUnique({ where: key });
    const mastery = current ? current.mastery * (1 - MASTERY_WEIGHT) + score * MASTERY_WEIGHT : score;

    const saved = await this.prisma.grammarProgress.upsert({
      where: key,
      create: {
        userId,
        topicId: canDoTopicId(canDoId),
        languageCode,
        mastery,
        attempts: total,
        correct,
      },
      update: {
        mastery,
        attempts: { increment: total },
        correct: { increment: correct },
        lastStudiedAt: new Date(),
      },
    });

    return { score, mastery: Math.round(saved.mastery) };
  }

  /** Os idiomas matriculados e o nivel-teto que eles impoem a can-do do dia. */
  private async learner(userId: string) {
    const userLanguages = await this.prisma.userLanguage.findMany({
      where: { userId },
      include: { language: true },
      orderBy: { priority: 'asc' },
    });

    if (userLanguages.length === 0) {
      throw new NotFoundException('Voce ainda nao esta estudando nenhum idioma.');
    }

    const languages = userLanguages.map((ul) => ({
      code: ul.language.code,
      name: ul.language.name,
      level: ul.currentLevel as string,
    }));

    return { languages, level: lowestCanDoLevel(languages.map((l) => l.level)) };
  }

  private async progressRows(userId: string, candidates: CanDo[]) {
    const rows = await this.prisma.grammarProgress.findMany({
      where: { userId, topicId: { in: topicIdsFor(candidates) } },
    });
    return toProgressRows(rows);
  }

  /**
   * A aula pronta, do pool.
   *
   * Basta UMA para servir. `null` quando nao ha nenhuma -- quem decide o que
   * fazer com a ausencia e `serve()`.
   */
  private async fromPool(canDo: CanDo, level: string) {
    const reused = await this.prisma.canDoLesson.findFirst({
      where: { canDoId: canDo.id, level },
      orderBy: [{ timesUsed: 'asc' }, { lastUsedAt: 'asc' }],
    });

    if (!reused) return null;

    await this.prisma.canDoLesson
      .update({
        where: { id: reused.id },
        data: { timesUsed: { increment: 1 }, lastUsedAt: new Date() },
      })
      .catch(() => undefined);

    return {
      sentences: (reused.sentences ?? []) as unknown as CanDoSentence[],
      contrast: reused.contrast,
    };
  }

  private async generate(
    userId: string,
    canDo: CanDo,
    languages: Array<{ code: string; name: string; level: string }>,
    urgent = false,
  ): Promise<GeneratedCanDoLesson> {
    const targets: CanDoLessonTarget[] = languages.map((l) => {
      const note = canDo.notes.find((n) => n.languageCode === l.code);
      return {
        code: l.code,
        name: l.name,
        level: l.level,
        note: note?.note ?? '',
        trap: note?.trap,
      };
    });

    const ctx: CanDoLessonContext = {
      question: canDo.question,
      goal: canDo.goal,
      columns: canDo.columns,
      targets,
    };

    const result = await this.ai.chatJson<GeneratedCanDoLesson>({
      task: 'cando.generate',
      json: true,
      userId,
      /*
       * Teto alto de proposito. A aula de estrutura de UM idioma ja precisa de
       * 4000 tokens, e aqui saem tres frases realizadas em quatro idiomas, cada
       * uma fatiada peca a peca, mais o paragrafo de contraste. O russo custa
       * perto do dobro por caractere, porque o cirilico rende menos caractere
       * por token. Com teto curto o JSON chega truncado e o erro fala de
       * sintaxe, escondendo que o problema era tamanho.
       */
      maxTokens: 12000,
      urgent,
      timeoutMs: urgent ? URGENT_TIMEOUT_MS : undefined,
      messages: [{ role: 'user', content: canDoLessonPrompt(ctx, SENTENCES_PER_LESSON) }],
    });

    const codes = languages.map((l) => l.code);
    const sentences = (result.sentences ?? []).filter((s) =>
      usableSentence(s, canDo.columns, codes),
    );

    if (sentences.length === 0) {
      throw new Error('A IA nao devolveu nenhuma frase utilizavel nos quatro idiomas.');
    }

    const discarded = (result.sentences ?? []).length - sentences.length;
    if (discarded > 0) {
      this.logger.warn(`${discarded} frase(s) descartada(s) na can-do ${canDo.id}.`);
    }

    return {
      sentences,
      contrast: result.contrast?.trim() || canDo.goal,
    };
  }
}

/**
 * Uma frase-modelo so serve se ela existir nos QUATRO idiomas.
 *
 * Esta e a validacao mais importante do modulo, e ela e severa de proposito:
 * uma frase que veio em tres idiomas nao e "quase boa", e o fracasso exato do
 * produto -- o aluno abre a tela para comparar quatro colunas e encontra tres.
 * Como a aula entra num pool e e reusada por meses, deixar passar uma frase
 * torta aqui a repete muitas vezes.
 */
export function usableSentence(
  sentence: CanDoSentence | undefined,
  columns: string[],
  codes: string[],
): boolean {
  if (!sentence?.gloss?.trim()) return false;
  if (!Array.isArray(sentence.realizations)) return false;

  const byCode = new Map(sentence.realizations.map((r) => [r?.languageCode, r]));
  return codes.every((code) => usableRealization(byCode.get(code), columns));
}

/**
 * Uma realizacao so ensina se as pecas remontarem a frase e se cada peca
 * apontar para uma coluna real.
 *
 * A tela mostra a frase FATIADA sob as colunas compartilhadas, e e a fatia que
 * ensina: ver a mesma coluna em posicoes diferentes entre os idiomas mostra a
 * regra de ordem sem enuncia-la. Peca com coluna inventada quebra o alinhamento
 * entre as quatro linhas, que e a unica coisa que esta tela faz.
 */
export function usableRealization(
  realization: CanDoRealization | undefined,
  columns: string[],
): boolean {
  if (!realization?.sentence?.trim()) return false;
  if (!Array.isArray(realization.parts) || realization.parts.length < 2) return false;
  if (realization.parts.some((p) => !p?.text?.trim() || !p?.column?.trim())) return false;

  const known = new Set(columns.map(normalizeColumn));
  if (realization.parts.some((p) => !known.has(normalizeColumn(p.column)))) return false;

  return compact(realization.parts.map((p) => p.text).join(' ')) === compact(realization.sentence);
}

/** Acento e caixa nao distinguem coluna: "O QUÊ" e "o que" sao a mesma. */
function normalizeColumn(column: string): string {
  return column
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Normaliza para comparar pecas com frase: as pecas nao carregam a pontuacao
 * nem a maiuscula da frase montada, e cobrar isso descartaria frases boas.
 */
function compact(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:"'¿¡«»—-]/g, '')
    .replace(/\s+/g, '')
    .trim();
}
