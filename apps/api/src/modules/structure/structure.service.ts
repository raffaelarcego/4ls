import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sentencePatternPrompt, SentencePatternContext } from '../../infrastructure/ai/prompts';
import { AiRouterService } from '../../infrastructure/ai/ai-router.service';
import { URGENT_TIMEOUT_MS } from '../../infrastructure/ai/ai.types';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ConceptsService } from '../concepts/concepts.service';
import { ErrorsService } from '../errors/errors.service';
import {
  findPattern,
  patternsFor,
  progressTopicId,
  SentencePattern,
} from './sentence-patterns.catalog';

/**
 * Quantos padroes DISTINTOS manter prontos a frente do aluno.
 *
 * Largura, e nao profundidade -- e a correcao de um defeito que quebrava a
 * sessao toda vez que ele avancava. O pool guardava tres copias do MESMO
 * padrao, mas `pickPattern` poe padrao nunca estudado na frente de qualquer um
 * ja visto: no instante em que ele terminava o padrao preparado, a escolha
 * pulava para o proximo, com pool zero, e o bloco morria com 503. As outras
 * duas copias so serviriam depois do catalogo inteiro visto.
 */
const POOL_AHEAD = 3;

/**
 * Copias do mesmo padrao, para quando o catalogo do nivel ja estiver todo
 * preparado. So ai a profundidade serve para alguma coisa: com tudo visto, a
 * escolha volta a padroes ja estudados e tres versoes evitam que ele decore os
 * exemplos.
 */
const POOL_DEPTH = 3;

/** Exercicios de montagem por aula. */
const DRILLS_PER_LESSON = 5;

/** Peso do resultado novo na media movel de dominio do padrao. */
const MASTERY_WEIGHT = 0.3;

export interface SentencePart {
  text: string;
  role: string;
}

export interface PatternExample {
  sentence: string;
  translation: string;
  parts: SentencePart[];
  note?: string;
}

export interface PatternPitfall {
  wrong: string;
  right: string;
  why: string;
}

export interface PatternDrill {
  gloss: string;
  scrambled: string[];
  answer: string;
  explanation: string;
}

interface GeneratedLesson {
  title: string;
  formula: string;
  explanation: string;
  steps: string[];
  examples: PatternExample[];
  pitfalls: PatternPitfall[];
  drills: PatternDrill[];
}

/**
 * Aulas de formacao de frase.
 *
 * O bloco de vocabulario ensina o que as palavras significam; este ensina como
 * montar a frase com elas. Sao coisas diferentes, e o produto so entregava a
 * primeira -- por isso o aluno sabia "Arbeit" e ainda assim montava a frase
 * alema com a ordem do portugues.
 *
 * O assunto de cada aula sai do catalogo curado, nunca do modelo, e o pool
 * guarda o que ja foi gerado: conteudo de estrutura e o que mais se repete no
 * estudo, entao paga-se a IA uma vez e usa-se por meses.
 */
@Injectable()
export class StructureService {
  private readonly logger = new Logger(StructureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiRouterService,
    private readonly concepts: ConceptsService,
    private readonly errors: ErrorsService,
  ) {}

  /**
   * A aula de formacao de frase de hoje para um idioma.
   *
   * O padrao escolhido e o menos dominado entre os que cabem no nivel do
   * aluno. Nao e rotacao cega: se a ordem do verbo alemao ainda nao firmou,
   * ela volta -- e o ponto que trava todas as frases daquele idioma.
   *
   * Pool vazio nao e erro: a aula e gerada na hora, como sempre foi. O que
   * mudou foi a FILA de providers dessa geracao -- ver `serve()`.
   */
  async lesson(userId: string, languageCode: string) {
    const userLanguage = await this.prisma.userLanguage.findFirst({
      where: { userId, language: { code: languageCode } },
      include: { language: true },
    });
    if (!userLanguage) {
      throw new NotFoundException(`Voce nao esta estudando o idioma "${languageCode}".`);
    }

    const candidates = patternsFor(languageCode, userLanguage.currentLevel);
    if (candidates.length === 0) {
      throw new NotFoundException(
        `Ainda nao ha aula de formacao de frase para ${languageCode} no nivel ${userLanguage.currentLevel}.`,
      );
    }

    const ranked = await this.rankPatterns(userId, languageCode, candidates);
    const { pattern, content } = await this.serve(userId, ranked, userLanguage.currentLevel);

    const progress = await this.prisma.grammarProgress.findUnique({
      where: {
        userId_topicId_languageCode: {
          userId,
          topicId: progressTopicId(pattern.id),
          languageCode,
        },
      },
    });

    return {
      patternId: pattern.id,
      languageCode,
      languageName: userLanguage.language.name,
      level: userLanguage.currentLevel,
      question: pattern.question,
      /** A regra curada. Vai para a tela junto com o texto gerado. */
      behavior: pattern.behavior,
      contrast: pattern.contrast,
      mastery: Math.round(progress?.mastery ?? 0),
      attempts: progress?.attempts ?? 0,
      ...content,
    };
  }

  /**
   * Os padroes em ordem de necessidade: o menos dominado primeiro, empate
   * desfeito pelo que faz mais tempo.
   *
   * Devolve a lista INTEIRA, e nao so o primeiro, porque duas coisas precisam
   * dela: a sessao, que desce a lista ate achar um padrao preparado, e o
   * `warm()`, que prepara os proximos da fila.
   */
  private async rankPatterns(
    userId: string,
    languageCode: string,
    candidates: SentencePattern[],
  ): Promise<SentencePattern[]> {
    const progress = await this.prisma.grammarProgress.findMany({
      where: {
        userId,
        languageCode,
        topicId: { in: candidates.map((p) => progressTopicId(p.id)) },
      },
    });
    const byTopic = new Map(progress.map((p) => [p.topicId, p]));

    const ranked = [...candidates].sort((a, b) => {
      const pa = byTopic.get(progressTopicId(a.id));
      const pb = byTopic.get(progressTopicId(b.id));

      // Padrao nunca estudado vem antes de qualquer um ja visto: a aula que
      // ele nunca teve vale mais que revisitar a que ele ja tem 40%.
      if (!pa && pb) return -1;
      if (pa && !pb) return 1;
      if (!pa && !pb) return 0;

      if (Math.round(pa!.mastery) !== Math.round(pb!.mastery)) return pa!.mastery - pb!.mastery;
      return pa!.lastStudiedAt.getTime() - pb!.lastStudiedAt.getTime();
    });

    return ranked;
  }

  /**
   * A aula que vai para a tela, por ordem de preferencia.
   *
   * 1. Do pool, se o padrao do dia ja tem aula pronta -- instantaneo.
   * 2. Gerada na hora, em chamada urgente. E o comportamento historico do
   *    produto, e ele funcionava; o que o quebrou foi a fila padrao de
   *    providers comecar pela MiMo, que leva 75-200s e estoura os 60s da
   *    funcao na Vercel. Urgente vai pelo modelo forte de menor latencia
   *    (21-29s medidos), com corte antes do teto da plataforma.
   * 3. Se ate a geracao falhar -- provider fora do ar --, desce a fila e serve
   *    o melhor padrao ja preparado. Uma aula menos ideal ensina mais que uma
   *    tela de erro.
   */
  private async serve(userId: string, ranked: SentencePattern[], level: string) {
    const ideal = ranked[0];

    const ready = await this.fromPool(ideal, level);
    if (ready) return { pattern: ideal, content: ready };

    try {
      return { pattern: ideal, content: await this.generateNow(userId, ideal, level) };
    } catch (error) {
      this.logger.warn(
        `Geracao urgente de "${ideal.id}"/${level} falhou: ${(error as Error).message}. ` +
          'Procurando um padrao ja preparado.',
      );
    }

    const prepared = await this.preparedIds(ranked, level);
    for (const pattern of ranked.slice(1)) {
      if (!prepared.has(pattern.id)) continue;
      const content = await this.fromPool(pattern, level);
      if (content) return { pattern, content };
    }

    throw new ServiceUnavailableException(
      `Nao consegui montar a aula de estrutura de ${ideal.languageCode} agora. Tente de novo em um minuto.`,
    );
  }

  /** Gera a aula na hora e guarda no pool -- o aluno paga a espera uma vez. */
  private async generateNow(userId: string, pattern: SentencePattern, level: string) {
    const generated = await this.generate(userId, pattern, level, true);

    const saved = await this.prisma.sentencePattern.create({
      data: {
        languageCode: pattern.languageCode,
        level,
        patternId: pattern.id,
        title: generated.title,
        question: pattern.question,
        formula: generated.formula,
        explanation: generated.explanation,
        steps: generated.steps as unknown as object,
        examples: generated.examples as unknown as object,
        pitfalls: generated.pitfalls as unknown as object,
        drills: generated.drills as unknown as object,
        timesUsed: 1,
        lastUsedAt: new Date(),
      },
    });

    return serialize(saved);
  }

  /** Quais destes padroes ja tem pelo menos uma aula no pool. */
  private async preparedIds(patterns: SentencePattern[], level: string): Promise<Set<string>> {
    if (patterns.length === 0) return new Set();

    const rows = await this.prisma.sentencePattern.findMany({
      where: {
        languageCode: patterns[0].languageCode,
        level,
        patternId: { in: patterns.map((p) => p.id) },
      },
      select: { patternId: true },
      distinct: ['patternId'],
    });

    return new Set(rows.map((r) => r.patternId));
  }

  /**
   * A aula pronta, do pool -- ou `null` quando ainda nao ha nenhuma.
   *
   * Devolver `null` em vez de lancar e o que deixa `serve()` decidir o que
   * fazer com a ausencia: gerar na hora e o caminho normal, e erro so no fim
   * da fila de alternativas.
   *
   * Basta UMA no pool para servir; antes so reaproveitava com o pool cheio
   * (tres) e gerava nas duas primeiras vezes -- ou seja, justamente quando o
   * aluno estava esperando.
   */
  private async fromPool(pattern: SentencePattern, level: string) {
    const where = { languageCode: pattern.languageCode, level, patternId: pattern.id };

    const reused = await this.prisma.sentencePattern.findFirst({
      where,
      orderBy: [{ timesUsed: 'asc' }, { lastUsedAt: 'asc' }],
    });

    if (!reused) return null;

    await this.prisma.sentencePattern
      .update({
        where: { id: reused.id },
        data: { timesUsed: { increment: 1 }, lastUsedAt: new Date() },
      })
      .catch(() => undefined);

    return serialize(reused);
  }

  /**
   * Prepara os proximos padroes de que o aluno vai precisar neste idioma.
   *
   * Largura primeiro: garante UMA aula para cada um dos proximos `ahead`
   * padroes da fila. So quando o catalogo do nivel inteiro ja tem aula e que
   * vale aprofundar o primeiro colocado ate `POOL_DEPTH` -- antes disso a
   * escolha do dia nunca volta a um padrao ja visto, e as copias extras ficam
   * paradas no banco enquanto o padrao seguinte quebra a sessao.
   *
   * Roda fora do horario de estudo (script/cron), onde dois minutos por aula
   * nao incomodam ninguem. Gera so o que falta: e idempotente e barato quando
   * o pool ja esta cheio.
   */
  async warm(userId: string, languageCode: string, ahead = POOL_AHEAD): Promise<number> {
    const userLanguage = await this.prisma.userLanguage.findFirst({
      where: { userId, language: { code: languageCode } },
    });
    if (!userLanguage) return 0;

    const level = userLanguage.currentLevel;
    const candidates = patternsFor(languageCode, level);
    if (candidates.length === 0) return 0;

    const ranked = await this.rankPatterns(userId, languageCode, candidates);
    const prepared = await this.preparedIds(ranked, level);

    const missing = ranked.filter((p) => !prepared.has(p.id));
    let created = 0;

    for (const pattern of missing.slice(0, ahead)) {
      created += await this.fill(userId, pattern, level, 1);
    }

    // Catalogo do nivel inteiro coberto: agora sim a profundidade serve, porque
    // a escolha do dia passou a devolver padroes ja estudados.
    if (missing.length === 0) {
      created += await this.fill(userId, ranked[0], level, POOL_DEPTH);
    }

    return created;
  }

  /** Gera aulas do padrao ate o pool dele chegar a `target`. */
  private async fill(
    userId: string,
    pattern: SentencePattern,
    level: string,
    target: number,
  ): Promise<number> {
    const where = { languageCode: pattern.languageCode, level, patternId: pattern.id };
    const existing = await this.prisma.sentencePattern.count({ where });
    let created = 0;

    for (let i = existing; i < target; i += 1) {
      const generated = await this.generate(userId, pattern, level);
      await this.prisma.sentencePattern.create({
        data: {
          ...where,
          title: generated.title,
          question: pattern.question,
          formula: generated.formula,
          explanation: generated.explanation,
          steps: generated.steps as unknown as object,
          examples: generated.examples as unknown as object,
          pitfalls: generated.pitfalls as unknown as object,
          drills: generated.drills as unknown as object,
        },
      });
      created += 1;
      this.logger.log(`Aula de estrutura preparada: ${pattern.id}/${level} (${i + 1}/${target}).`);
    }

    return created;
  }

  private async generate(
    userId: string,
    pattern: SentencePattern,
    level: string,
    urgent = false,
  ): Promise<GeneratedLesson> {
    const languageName = await this.languageName(pattern.languageCode);

    // As frases da aula usam as palavras do dia: e o que amarra os dois blocos
    // da sessao em vez de deixar a estrutura pairando sobre vocabulario avulso.
    const [terms, recentErrors] = await Promise.all([
      this.concepts.dailyTerms(userId, pattern.languageCode).catch(() => [] as string[]),
      this.errors.summaryForPrompt(userId, pattern.languageCode).catch(() => [] as string[]),
    ]);

    const ctx: SentencePatternContext = {
      languageName,
      languageCode: pattern.languageCode,
      level,
      patternTitle: pattern.title,
      patternQuestion: pattern.question,
      patternBehavior: pattern.behavior,
      contrast: pattern.contrast,
      terms,
      recentErrors,
    };

    const result = await this.ai.chatJson<GeneratedLesson>({
      task: 'structure.generate',
      json: true,
      userId,
      language: pattern.languageCode,
      /*
       * A aula inteira sai numa resposta so -- formula, passos, tres exemplos
       * desmontados peca a peca, armadilhas e cinco exercicios --, e o teto
       * padrao de 1200 tokens a corta no meio. O sintoma engana: o JSON chega
       * truncado e o erro fala de sintaxe, nao de tamanho.
       *
       * O cirilico piora tudo, porque rende bem menos caractere por token que
       * o alfabeto latino: a mesma aula em russo ocupa quase o dobro.
       */
      maxTokens: 4000,
      urgent,
      timeoutMs: urgent ? URGENT_TIMEOUT_MS : undefined,
      messages: [{ role: 'user', content: sentencePatternPrompt(ctx, DRILLS_PER_LESSON) }],
    });

    const examples = (result.examples ?? []).filter(usableExample);
    const drills = (result.drills ?? []).filter(usableDrill);

    if (examples.length === 0) {
      throw new Error('A IA nao devolveu nenhum exemplo utilizavel para a aula de estrutura.');
    }

    const discarded =
      (result.examples ?? []).length - examples.length + ((result.drills ?? []).length - drills.length);
    if (discarded > 0) {
      this.logger.warn(`${discarded} itens descartados na aula ${pattern.id}/${level}.`);
    }

    return {
      title: result.title?.trim() || pattern.title,
      formula: result.formula?.trim() || pattern.behavior,
      explanation: result.explanation?.trim() || pattern.behavior,
      steps: (result.steps ?? []).filter((s) => typeof s === 'string' && s.trim()),
      examples,
      pitfalls: (result.pitfalls ?? []).filter(
        (p) => p?.wrong?.trim() && p?.right?.trim() && p.wrong.trim() !== p.right.trim(),
      ),
      drills,
    };
  }

  /**
   * Registra o resultado de uma rodada de montagem.
   *
   * Reusa grammar_progress: dominio de estrutura e dominio de gramatica, e
   * duplicar a tabela so para mudar o nome da chave nao ajudaria ninguem. O
   * prefixo "structure:" no topicId mantem os dois catalogos separados.
   */
  async record(
    userId: string,
    patternId: string,
    languageCode: string,
    correct: number,
    total: number,
  ) {
    const pattern = findPattern(patternId);
    if (!pattern) throw new NotFoundException(`Padrao "${patternId}" nao existe.`);
    if (total <= 0) throw new NotFoundException('Rodada sem exercicios.');

    const score = Math.round((correct / total) * 100);
    const key = {
      userId_topicId_languageCode: {
        userId,
        topicId: progressTopicId(patternId),
        languageCode,
      },
    };

    const current = await this.prisma.grammarProgress.findUnique({ where: key });
    const mastery = current
      ? current.mastery * (1 - MASTERY_WEIGHT) + score * MASTERY_WEIGHT
      : score;

    const saved = await this.prisma.grammarProgress.upsert({
      where: key,
      create: {
        userId,
        topicId: progressTopicId(patternId),
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

  private async languageName(code: string): Promise<string> {
    const language = await this.prisma.language.findUnique({ where: { code } });
    return language?.name ?? code;
  }
}

function serialize(row: {
  title: string;
  formula: string;
  explanation: string;
  steps: unknown;
  examples: unknown;
  pitfalls: unknown;
  drills: unknown;
}) {
  return {
    title: row.title,
    formula: row.formula,
    explanation: row.explanation,
    steps: (row.steps ?? []) as string[],
    examples: (row.examples ?? []) as PatternExample[],
    pitfalls: (row.pitfalls ?? []) as PatternPitfall[],
    drills: (row.drills ?? []) as PatternDrill[],
  };
}

/**
 * Um exemplo so ensina se as pecas remontarem a frase.
 *
 * Isto nao e paranoia de validacao: a tela exibe a frase FATIADA, com um rotulo
 * por peca, e e a fatia que ensina a posicao. Se as pecas nao baterem com a
 * frase, o aluno ve um desmonte que nao corresponde ao que esta escrito -- pior
 * que nao ver desmonte nenhum. Como a aula entra num pool e e reusada por
 * meses, um exemplo torto aqui e repetido muitas vezes.
 */
export function usableExample(example: PatternExample | undefined): boolean {
  if (!example?.sentence?.trim() || !example.translation?.trim()) return false;
  if (!Array.isArray(example.parts) || example.parts.length < 2) return false;
  if (example.parts.some((p) => !p?.text?.trim() || !p?.role?.trim())) return false;

  return compact(example.parts.map((p) => p.text).join(' ')) === compact(example.sentence);
}

/**
 * Um exercicio de montagem so e corrigivel se as pecas embaralhadas forem
 * exatamente as da resposta -- uma peca a mais torna o exercicio impossivel, e
 * uma a menos o torna ambiguo.
 *
 * A comparacao e por multiconjunto de caracteres, e nao por concatenacao: as
 * pecas chegam FORA de ordem por definicao, entao juntar e comparar com a
 * resposta reprovaria justamente os exercicios corretos. O que precisa bater e
 * o material -- as mesmas letras, nem uma a mais.
 */
export function usableDrill(drill: PatternDrill | undefined): boolean {
  if (!drill?.answer?.trim() || !drill.gloss?.trim()) return false;
  if (!Array.isArray(drill.scrambled) || drill.scrambled.length < 2) return false;
  if (drill.scrambled.some((piece) => typeof piece !== 'string' || !piece.trim())) return false;

  return letters(drill.scrambled.join('')) === letters(drill.answer);
}

/** Os caracteres da frase, ordenados -- a "impressao digital" do material. */
function letters(text: string): string {
  return compact(text).split('').sort().join('');
}

/**
 * Normaliza para comparar pecas com frase: as pecas nao carregam a pontuacao
 * nem a maiuscula da frase montada, e cobrar isso descartaria exemplos bons.
 */
function compact(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:"']/g, '')
    .replace(/\s+/g, '')
    .trim();
}
