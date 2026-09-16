import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CefrLevel, ErrorCategory, VocabStatus } from '@prisma/client';
import { AiRouterService } from '../../infrastructure/ai/ai-router.service';
import {
  conceptTranslationPrompt,
  ConceptContext,
  ConceptTarget,
  extractTermsPrompt,
  LearnerContext,
  ProductionAttempt,
  quadrupleProductionPrompt,
} from '../../infrastructure/ai/prompts';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ErrorsService } from '../errors/errors.service';

/**
 * Peso da revisao nova na forca do significado.
 *
 * Baixo de proposito. `meaningStrength` e evidencia acumulada em varios
 * idiomas de que o conceito entrou; um tropeco na forma de um deles nao pode
 * derrubar essa evidencia, senao a distincao entre "nao sei o que e" e "nao
 * lembro a forma" -- a razao de existir desta camada -- desaparece no primeiro
 * dia ruim.
 */
const MEANING_WEIGHT = 0.25;

/** A partir de onde o significado conta como sabido, e o andaime e liberado. */
const MEANING_KNOWN = 0.6;

/** Teto do texto colado, para uma chamada de extracao nao virar um livro. */
const MAX_CAPTURE_CHARS = 6000;

/** Teto de termos por captura. Acima disso a fila de revisao vira um castigo. */
const MAX_CAPTURE_TERMS = 12;

const VALID_ERROR_CATEGORIES = new Set(Object.values(ErrorCategory) as string[]);

/** Escada CEFR, para comparar niveis sem espalhar a ordem pelo codigo. */
const LEVELS: CefrLevel[] = [
  CefrLevel.A1,
  CefrLevel.A2,
  CefrLevel.B1,
  CefrLevel.B2,
  CefrLevel.C1,
  CefrLevel.C2,
];

export function levelIndex(level: string): number {
  const index = LEVELS.indexOf(level as CefrLevel);
  return index === -1 ? 0 : index;
}

/** O menor de dois niveis CEFR. */
export function minLevel(a: string, b: string): CefrLevel {
  return levelIndex(a) <= levelIndex(b) ? (a as CefrLevel) : (b as CefrLevel);
}

/**
 * Conceitos: a unidade de aprendizado do produto.
 *
 * A regra que este service existe para garantir e uma so: o que o aluno
 * aprende hoje em um idioma, ele aprende hoje nos outros tres. Nada de
 * "trabalho" entrar so em ingles e "Arbeit" aparecer tres semanas depois como
 * palavra estranha -- os quatro entram juntos, pendurados no mesmo significado
 * em portugues, e e isso que faz uma lingua sustentar a memoria das outras.
 *
 * Como a regra e mantida:
 *
 * 1. Toda porta de entrada de vocabulario (palavra salva a mao, termo vindo do
 *    listening, sugestao do tutor) passa por `learn`, nunca direto na tabela.
 * 2. `learn` acha ou cria o conceito, COMPLETA o que falta nos outros idiomas
 *    -- com IA quando preciso -- e so entao matricula o aluno, nos quatro de
 *    uma vez.
 * 3. Se a IA nao estiver disponivel, o termo entra assim mesmo no idioma dele e
 *    o conceito fica marcado como incompleto; a proxima chamada tenta de novo.
 *    Degradar e melhor que travar o aluno, mas nunca silenciosamente: conceito
 *    incompleto nao vira aula do dia (ver `dailyConcepts`).
 */

export interface ConceptEntry {
  languageCode: string;
  languageName: string;
  term: string;
  meaning: string;
  example: string | null;
  translation: string | null;
  /** Presente quando o aluno ja tem este termo na propria colecao. */
  status: VocabStatus | null;
  nextReview: Date | null;
}

export interface ConceptCard {
  id: string;
  slug: string;
  gloss: string;
  note: string | null;
  level: CefrLevel;
  entries: ConceptEntry[];
  /**
   * 0-100: o quanto o SIGNIFICADO ja firmou, atraves de todos os idiomas.
   * Alto com um card fraco significa "sei o que e, nao lembro a forma".
   */
  meaningStrength: number;
  /** Idioma em que o conceito esta mais firme -- o candidato a andaime. */
  anchorLanguageCode: string | null;
}

interface GeneratedEntries {
  entries: Array<{
    languageCode: string;
    term: string;
    meaning: string;
    example?: string;
    translation?: string;
  }>;
}

interface ProductionError {
  category: string;
  description: string;
  explanation?: string;
  severity?: number;
  sourceLanguage?: string | null;
}

interface GeneratedProduction {
  results: Array<{
    languageCode: string;
    ok: boolean;
    score: number;
    corrected?: string;
    feedback?: string;
    errors?: ProductionError[];
  }>;
  insight?: string;
}

interface GeneratedTerms {
  terms: Array<{
    term: string;
    meaning: string;
    example?: string;
    translation?: string;
    level?: string;
  }>;
}

@Injectable()
export class ConceptsService {
  private readonly logger = new Logger(ConceptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiRouterService,
    private readonly errors: ErrorsService,
  ) {}

  /** Codigos dos idiomas que o aluno estuda, na ordem de prioridade dele. */
  async studyCodes(userId: string): Promise<string[]> {
    return (await this.profile(userId)).map((l) => l.code);
  }

  /**
   * Idiomas do aluno com o nivel dele em cada um.
   *
   * O nivel por idioma e o que o produto vinha ignorando: quem e B2 em ingles e
   * A1 em russo nao pode receber a realizacao russa de um conceito C1 -- ela
   * sairia correta e inutil. Tudo que gera ou escolhe conteudo passa por aqui.
   */
  async profile(userId: string): Promise<ConceptTarget[]> {
    const rows = await this.prisma.userLanguage.findMany({
      where: { userId },
      include: { language: { select: { code: true, name: true } } },
      orderBy: { priority: 'asc' },
    });

    return rows.map((r) => ({
      code: r.language.code,
      name: r.language.name,
      level: r.currentLevel,
    }));
  }

  /**
   * O teto de dificuldade que cabe em TODOS os idiomas do aluno.
   *
   * E o nivel do idioma mais fraco, e nao a media, porque um conceito so entra
   * na sessao quando serve aos quatro: se ele nao couber no russo A1, o bloco
   * de russo daquele dia recebe um conceito que o aluno nao tem como usar, e a
   * promessa de "o mesmo conceito nos quatro idiomas" se quebra justamente no
   * idioma mais fragil.
   */
  async ceiling(userId: string): Promise<CefrLevel> {
    const profile = await this.profile(userId);
    if (profile.length === 0) return CefrLevel.A1;

    return profile.reduce<CefrLevel>(
      (lowest, language) => minLevel(lowest, language.level),
      CefrLevel.C2,
    );
  }

  /**
   * Porta unica de entrada de vocabulario novo.
   *
   * Devolve o conceito ja completo (quando possivel) e ja matriculado nos
   * idiomas do aluno.
   */
  async learn(
    userId: string,
    input: {
      languageCode: string;
      term: string;
      meaning: string;
      example?: string;
      translation?: string;
      level?: CefrLevel;
      source?: string;
    },
  ): Promise<ConceptCard> {
    const language = await this.prisma.language.findUnique({
      where: { code: input.languageCode },
    });
    if (!language) throw new NotFoundException(`Idioma "${input.languageCode}" nao encontrado.`);

    const term = input.term.trim();
    const level = input.level ?? CefrLevel.A1;

    const existing = await this.prisma.vocabulary.findUnique({
      where: { languageId_term: { languageId: language.id, term } },
    });

    // O significado em portugues e a identidade do conceito. Dois termos com o
    // mesmo significado sao o MESMO conceito -- e e exatamente essa fusao que
    // faz "work" e "Arbeit" virarem uma linha so em vez de duas paralelas.
    const slug = conceptSlug(input.meaning);

    const concept =
      (existing?.conceptId
        ? await this.prisma.concept.findUnique({ where: { id: existing.conceptId } })
        : null) ??
      (await this.prisma.concept.upsert({
        where: { slug },
        create: { slug, gloss: input.meaning.trim(), level, source: input.source ?? 'user' },
        update: {},
      }));

    await this.prisma.vocabulary.upsert({
      where: { languageId_term: { languageId: language.id, term } },
      create: {
        languageId: language.id,
        conceptId: concept.id,
        term,
        meaning: input.meaning,
        example: input.example,
        translation: input.translation,
        level,
        source: input.source ?? 'user',
      },
      update: { conceptId: concept.id },
    });

    const profile = await this.profile(userId);
    await this.complete(concept.id, profile, userId);
    await this.enroll(userId, concept.id);

    const card = await this.card(concept.id, userId, input.languageCode);
    // O conceito acabou de ser criado nesta transacao; so sumiria numa corrida
    // de exclusao. Se acontecer, um 404 e mais honesto que devolver null.
    if (!card) throw new NotFoundException('Conceito nao encontrado apos a criacao.');
    return card;
  }

  /**
   * Completa um conceito nos idiomas que faltam, gerando as realizacoes que
   * ainda nao existem. Nao lanca quando a IA falha: o que ja existe segue
   * valendo, e a proxima passagem tenta de novo.
   */
  async complete(conceptId: string, targets: ConceptTarget[], userId?: string): Promise<void> {
    const concept = await this.prisma.concept.findUnique({
      where: { id: conceptId },
      include: { entries: { include: { language: true } } },
    });
    if (!concept) return;

    const have = new Set(concept.entries.map((e) => e.language.code));
    const missing = targets.filter((target) => !have.has(target.code));
    if (missing.length === 0) return;

    if (!this.ai.hasProvider()) {
      this.logger.warn(
        `Conceito "${concept.slug}" incompleto (falta ${missing
          .map((m) => m.code)
          .join(', ')}) e sem provider de IA para fechar.`,
      );
      return;
    }

    const ctx: ConceptContext = {
      gloss: concept.gloss,
      note: concept.note,
      known: concept.entries.map((e) => ({
        languageCode: e.language.code,
        term: e.term,
        example: e.example,
      })),
    };

    let generated: GeneratedEntries;
    try {
      generated = await this.ai.chatJson<GeneratedEntries>({
        task: 'concept.translate',
        json: true,
        userId,
        messages: [{ role: 'user', content: conceptTranslationPrompt(ctx, missing) }],
      });
    } catch (err) {
      this.logger.warn(
        `Nao consegui completar o conceito "${concept.slug}": ${(err as Error).message}`,
      );
      return;
    }

    const codes = missing.map((m) => m.code);
    const languages = await this.prisma.language.findMany({ where: { code: { in: codes } } });
    const byCode = new Map(languages.map((l) => [l.code, l.id]));
    const levelByCode = new Map(missing.map((m) => [m.code, m.level]));

    for (const entry of generated.entries ?? []) {
      const languageId = byCode.get(entry?.languageCode);
      // So aceita idioma que estava faltando de verdade: modelo distraido as
      // vezes devolve de novo o idioma que ja tinha, e sobrescrever a
      // realizacao curada do seed pela gerada seria uma troca ruim.
      if (!languageId || !entry.term?.trim() || !entry.meaning?.trim()) continue;

      // A realizacao guarda o nivel do IDIOMA, nao o do conceito: e o mesmo
      // significado em pontos diferentes da escada, e e assim que ele volta a
      // aparecer no bloco certo de cada idioma.
      const level = (levelByCode.get(entry.languageCode) as CefrLevel) ?? concept.level;
      const term = entry.term.trim();

      /*
       * Uma realizacao que ja pertence a OUTRO conceito nao e tomada.
       *
       * Isto custou um bug real: "to look forward to" gerou "sich freuen auf"
       * em alemao, e o conceito "estar animado com algo futuro" -- que ja tinha
       * esse termo vindo do seed -- o reclamou pelo update. O primeiro conceito
       * ficou so com o ingles, em silencio, DEPOIS de ter sido reportado como
       * completo.
       *
       * A colisao costuma significar que os dois conceitos sao o mesmo
       * significado, mas fundi-los aqui seria decidir sozinho uma coisa que
       * polissemia desmente ("pasta" de arquivo e de comer). Entao o certo e
       * nao mexer e avisar: o conceito fica incompleto, fora da aula do dia, e
       * a proxima passada tenta outro termo.
       */
      const taken = await this.prisma.vocabulary.findUnique({
        where: { languageId_term: { languageId, term } },
        select: { conceptId: true },
      });

      if (taken?.conceptId && taken.conceptId !== concept.id) {
        this.logger.warn(
          `"${term}" (${entry.languageCode}) ja e de outro conceito; "${concept.slug}" segue sem ${entry.languageCode}.`,
        );
        continue;
      }

      await this.prisma.vocabulary.upsert({
        where: { languageId_term: { languageId, term } },
        create: {
          languageId,
          conceptId: concept.id,
          term,
          meaning: entry.meaning.trim(),
          example: entry.example?.trim() || null,
          translation: entry.translation?.trim() || null,
          level,
          source: 'ai',
        },
        update: { conceptId: concept.id },
      });
    }
  }

  /**
   * Matricula o aluno em TODAS as realizacoes do conceito, nos idiomas que ele
   * estuda. Idempotente: chamar de novo nao duplica nem reagenda o que ja esta
   * em revisao.
   */
  async enroll(userId: string, conceptId: string): Promise<number> {
    const codes = await this.studyCodes(userId);
    const entries = await this.prisma.vocabulary.findMany({
      where: { conceptId, language: { code: { in: codes } } },
      select: { id: true },
    });

    if (entries.length === 0) return 0;

    const created = await this.prisma.userVocabulary.createMany({
      data: entries.map((entry) => ({ userId, vocabularyId: entry.id })),
      skipDuplicates: true,
    });

    return created.count;
  }

  /**
   * Os conceitos do dia, iguais para todos os idiomas.
   *
   * A escolha e deliberadamente feita no nivel do CONCEITO, nunca no do termo:
   * e o que garante que o bloco de ingles e o de russo de hoje ensinem as
   * mesmas coisas. Ordena pelo card mais urgente de cada conceito -- o conceito
   * cuja realizacao em algum idioma vence primeiro vem primeiro.
   */
  async dailyConceptIds(userId: string, limit: number): Promise<string[]> {
    const profile = await this.profile(userId);
    const codes = profile.map((l) => l.code);

    const enrolled = await this.prisma.userVocabulary.findMany({
      where: {
        userId,
        status: { not: VocabStatus.MASTERED },
        vocabulary: { conceptId: { not: null } },
      },
      select: { nextReview: true, vocabulary: { select: { conceptId: true } } },
      orderBy: { nextReview: 'asc' },
      take: 400,
    });

    const ordered: string[] = [];
    for (const row of enrolled) {
      const id = row.vocabulary.conceptId!;
      if (!ordered.includes(id)) ordered.push(id);
    }

    // So entra na aula do dia o conceito que existe nos quatro idiomas. Um
    // conceito manco viraria exatamente o que esta mudanca veio corrigir: uma
    // palavra aprendida num idioma so.
    const complete = await this.completeOnes(ordered, codes);
    const chosen = complete.slice(0, limit);
    if (chosen.length >= limit) return chosen;

    /*
     * Faltou conceito: puxa dos que o aluno ainda nao tem e matricula nos
     * quatro idiomas de uma vez -- e o momento em que a regra do produto
     * acontece de fato.
     *
     * O teto de nivel e o do idioma MAIS FRACO, e nao o do idioma do bloco.
     * Sem ele, um conceito C1 do ingles entraria e sairia como uma frase russa
     * que o aluno A1 nao tem como usar: conteudo correto e inutil, exatamente o
     * tipo de coisa que faz o aluno abandonar o idioma mais dificil.
     */
    const ceiling = await this.ceiling(userId);
    const allowed = LEVELS.slice(0, levelIndex(ceiling) + 1);

    const fresh = await this.prisma.concept.findMany({
      where: {
        id: { notIn: ordered.length ? ordered : ['-'] },
        level: { in: allowed },
        entries: { some: { language: { code: { in: codes } } } },
      },
      orderBy: [{ level: 'asc' }, { createdAt: 'asc' }],
      take: (limit - chosen.length) * 3,
      select: { id: true },
    });

    for (const concept of fresh) {
      if (chosen.length >= limit) break;
      await this.complete(concept.id, profile, userId);
      const missing = await this.missingCodes(concept.id, codes);
      if (missing.length > 0) continue;
      await this.enroll(userId, concept.id);
      chosen.push(concept.id);
    }

    return chosen;
  }

  /** A aula de vocabulario de hoje, vista a partir de um idioma. */
  async lesson(userId: string, languageCode: string, limit = 5): Promise<ConceptCard[]> {
    const codes = await this.studyCodes(userId);
    if (!codes.includes(languageCode)) {
      throw new NotFoundException(`Voce nao esta estudando o idioma "${languageCode}".`);
    }

    const ids = await this.dailyConceptIds(userId, limit);
    const cards = await Promise.all(ids.map((id) => this.card(id, userId, languageCode)));
    return cards.filter((card): card is ConceptCard => card !== null);
  }

  /** Termos do idioma nos conceitos de hoje -- contexto para a aula de estrutura. */
  async dailyTerms(userId: string, languageCode: string, limit = 5): Promise<string[]> {
    const cards = await this.lesson(userId, languageCode, limit);
    return cards
      .map((card) => card.entries.find((e) => e.languageCode === languageCode)?.term)
      .filter((term): term is string => Boolean(term));
  }

  /**
   * Um conceito montado para a tela: o termo do idioma pedido primeiro, os
   * outros logo abaixo. Ver as quatro linhas juntas e o ponto da mudanca --
   * o aluno nunca ve uma palavra sozinha.
   */
  async card(conceptId: string, userId: string, first?: string): Promise<ConceptCard | null> {
    const concept = await this.prisma.concept.findUnique({
      where: { id: conceptId },
      include: { entries: { include: { language: true } } },
    });
    if (!concept) return null;

    const codes = await this.studyCodes(userId);
    const [mine, progress] = await Promise.all([
      this.prisma.userVocabulary.findMany({
        where: { userId, vocabulary: { conceptId } },
        select: { vocabularyId: true, status: true, nextReview: true },
      }),
      this.prisma.conceptProgress.findUnique({
        where: { userId_conceptId: { userId, conceptId } },
        include: { concept: false },
      }),
    ]);

    const anchor = progress?.anchorLanguageId
      ? await this.prisma.language.findUnique({ where: { id: progress.anchorLanguageId } })
      : null;
    const byVocabulary = new Map(mine.map((m) => [m.vocabularyId, m]));

    const entries = concept.entries
      .filter((entry) => codes.includes(entry.language.code))
      .map<ConceptEntry>((entry) => {
        const own = byVocabulary.get(entry.id);
        return {
          languageCode: entry.language.code,
          languageName: entry.language.name,
          term: entry.term,
          meaning: entry.meaning,
          example: entry.example,
          translation: entry.translation,
          status: own?.status ?? null,
          nextReview: own?.nextReview ?? null,
        };
      })
      .sort((a, b) => {
        if (a.languageCode === first) return -1;
        if (b.languageCode === first) return 1;
        return codes.indexOf(a.languageCode) - codes.indexOf(b.languageCode);
      });

    return {
      id: concept.id,
      slug: concept.slug,
      gloss: concept.gloss,
      note: concept.note,
      level: concept.level,
      entries,
      meaningStrength: Math.round((progress?.meaningStrength ?? 0) * 100),
      anchorLanguageCode: anchor?.code ?? null,
    };
  }


  // -------------------------------------------------------------------------
  // Progresso do conceito, acima das formas
  // -------------------------------------------------------------------------

  /**
   * Registra uma revisao no nivel do CONCEITO.
   *
   * O SRS por card continua medindo cada palavra em cada idioma -- isso nao
   * muda. O que esta camada acrescenta e a distincao que o card sozinho nao
   * consegue fazer: "nao sei o que isso significa" e "sei o significado, nao
   * consigo puxar a forma russa" sao falhas opostas, e ate agora as duas
   * chegavam ao motor como o mesmo "errou".
   *
   * `meaningStrength` e media movel sobre acertos em QUALQUER idioma. Ela sobe
   * devagar e cai devagar de proposito: um tropeco na forma de um idioma nao
   * pode derrubar a evidencia, acumulada em varios idiomas, de que o
   * significado entrou.
   */
  async recordReview(userId: string, conceptId: string, languageId: string, correct: boolean) {
    const key = { userId_conceptId: { userId, conceptId } };
    const current = await this.prisma.conceptProgress.findUnique({ where: key });
    const score = correct ? 1 : 0;

    const meaningStrength = current
      ? current.meaningStrength * (1 - MEANING_WEIGHT) + score * MEANING_WEIGHT
      : score;

    /*
     * A ancora so muda quando o aluno ACERTA: ela e o idioma que serve de
     * andaime, e um idioma em que ele acabou de errar nao sustenta nada. Sem
     * esta condicao a ancora acompanharia a ultima revisao qualquer, que e o
     * oposto do que a palavra "ancora" promete.
     */
    const anchorLanguageId = correct ? languageId : (current?.anchorLanguageId ?? null);

    return this.prisma.conceptProgress.upsert({
      where: key,
      create: {
        userId,
        conceptId,
        meaningStrength,
        reviews: 1,
        correct: score,
        anchorLanguageId,
      },
      update: {
        meaningStrength,
        reviews: { increment: 1 },
        correct: { increment: score },
        anchorLanguageId,
        lastReviewAt: new Date(),
      },
    });
  }

  /**
   * O andaime para revisar um card fraco: a mesma coisa no idioma que o aluno
   * domina.
   *
   * So devolve alguma coisa quando o significado ESTA firme e a forma daquele
   * idioma nao. E a unica situacao em que a dica ajuda em vez de atrapalhar:
   * se o conceito ainda nao entrou, mostrar a palavra alema seria entregar a
   * resposta de um problema que o aluno nem formulou; se a forma ja esta
   * firme, seria tirar dele justamente o esforco de recuperacao que consolida.
   */
  async scaffold(
    userId: string,
    conceptId: string,
    languageCode: string,
  ): Promise<{ languageCode: string; languageName: string; term: string } | null> {
    const progress = await this.prisma.conceptProgress.findUnique({
      where: { userId_conceptId: { userId, conceptId } },
    });

    if (!progress || progress.meaningStrength < MEANING_KNOWN) return null;
    if (!progress.anchorLanguageId) return null;

    const anchor = await this.prisma.vocabulary.findFirst({
      where: { conceptId, languageId: progress.anchorLanguageId },
      include: { language: true },
    });

    // A ancora nao pode ser o proprio idioma que esta sendo revisado: seria
    // mostrar a resposta.
    if (!anchor || anchor.language.code === languageCode) return null;

    return {
      languageCode: anchor.language.code,
      languageName: anchor.language.name,
      term: anchor.term,
    };
  }

  // -------------------------------------------------------------------------
  // Producao quadrupla
  // -------------------------------------------------------------------------

  /**
   * O conceito da vez para o exercicio de producao.
   *
   * Escolhe entre os conceitos cujo SIGNIFICADO ja firmou: producao livre e o
   * teste mais duro do produto, e aplica-lo a um conceito que o aluno acabou de
   * ver mede a memoria de curto prazo, nao a aquisicao. Dos elegiveis, vem o
   * que faz mais tempo que nao aparece.
   */
  async productionMission(userId: string) {
    const profile = await this.profile(userId);
    if (profile.length < 2) {
      throw new NotFoundException('A producao quadrupla precisa de pelo menos dois idiomas.');
    }

    const ready = await this.prisma.conceptProgress.findMany({
      where: { userId, meaningStrength: { gte: MEANING_KNOWN } },
      orderBy: { lastReviewAt: 'asc' },
      take: 40,
      select: { conceptId: true },
    });

    const codes = profile.map((l) => l.code);
    const complete = await this.completeOnes(
      ready.map((r) => r.conceptId),
      codes,
    );

    if (complete.length === 0) {
      throw new NotFoundException(
        'Nenhum conceito firme o bastante ainda. Estude mais alguns dias e a producao abre.',
      );
    }

    const card = await this.card(complete[0], userId);
    if (!card) throw new NotFoundException('Conceito nao encontrado.');

    return {
      conceptId: card.id,
      gloss: card.gloss,
      note: card.note,
      meaningStrength: card.meaningStrength,
      /*
       * O termo vai visivel e a FRASE nao. O aluno nao esta sendo testado em
       * lembrar a palavra -- isso o flashcard ja faz -- e sim em construir a
       * frase em volta dela: a ordem, o caso, a preposicao, o que cada lingua
       * obriga. Esconder o termo transformaria isto noutro exercicio de
       * vocabulario.
       */
      targets: card.entries.map((entry) => ({
        languageCode: entry.languageCode,
        languageName: entry.languageName,
        term: entry.term,
        meaning: entry.meaning,
      })),
    };
  }

  /**
   * Avalia a mesma frase escrita em todos os idiomas, numa chamada so.
   *
   * Uma chamada, e nao uma por idioma, porque o erro que mais interessa aqui so
   * e visivel de cima: a frase alema saindo com a ordem russa, a espanhola
   * copiando a estrutura inglesa. Avaliadas isoladamente, cada uma seria "erro
   * de ordem das palavras" e a causa se perderia.
   */
  async evaluateProduction(
    userId: string,
    conceptId: string,
    sentences: Array<{ languageCode: string; sentence: string }>,
  ) {
    const card = await this.card(conceptId, userId);
    if (!card) throw new NotFoundException('Conceito nao encontrado.');

    const profile = await this.profile(userId);
    const levelByCode = new Map(profile.map((l) => [l.code, l.level]));
    const written = new Map(sentences.map((s) => [s.languageCode, s.sentence ?? '']));

    const attempts: ProductionAttempt[] = card.entries.map((entry) => ({
      languageCode: entry.languageCode,
      languageName: entry.languageName,
      level: levelByCode.get(entry.languageCode) ?? 'A1',
      sentence: written.get(entry.languageCode) ?? '',
      term: entry.term,
    }));

    if (attempts.every((a) => !a.sentence.trim())) {
      throw new NotFoundException('Escreva ao menos uma frase antes de enviar.');
    }

    const result = await this.ai.chatJson<GeneratedProduction>({
      task: 'production.evaluate',
      json: true,
      userId,
      // Quatro correcoes completas numa resposta so, com frase corrigida,
      // feedback e erros de cada idioma. Nao cabe no teto padrao.
      maxTokens: 3000,
      messages: [{ role: 'user', content: quadrupleProductionPrompt(card.gloss, attempts) }],
    });

    const languages = await this.prisma.language.findMany();
    const idByCode = new Map(languages.map((l) => [l.code, l.id]));

    const results = (result.results ?? []).filter((r) => idByCode.has(r?.languageCode));

    // Os erros viram dado do perfil, com a origem da interferencia junto -- e o
    // que liga este exercicio ao resto do produto em vez de deixa-lo como um
    // teste isolado que nao ensina nada depois.
    for (const item of results) {
      const languageId = idByCode.get(item.languageCode)!;
      const errors = (item.errors ?? []).filter((e) => VALID_ERROR_CATEGORIES.has(e?.category));
      if (errors.length === 0) continue;

      await this.errors.recordMany(
        userId,
        languageId,
        errors.map((e) => ({
          category: e.category as ErrorCategory,
          description: e.description,
          explanation: e.explanation,
          severity: e.severity,
          sourceLanguage: e.sourceLanguage,
        })),
        {
          source: 'production',
          userText: written.get(item.languageCode) ?? '',
          correctedText: item.corrected,
        },
      );
    }

    const scored = results.filter((r) => typeof r.score === 'number');
    const average = scored.length
      ? Math.round(scored.reduce((sum, r) => sum + r.score, 0) / scored.length)
      : 0;

    return {
      conceptId: card.id,
      gloss: card.gloss,
      score: average,
      insight: result.insight ?? null,
      results: results.map((item) => ({
        languageCode: item.languageCode,
        languageName:
          card.entries.find((e) => e.languageCode === item.languageCode)?.languageName ??
          item.languageCode,
        ok: Boolean(item.ok),
        score: typeof item.score === 'number' ? item.score : 0,
        corrected: item.corrected ?? '',
        feedback: item.feedback ?? '',
        errors: item.errors ?? [],
      })),
    };
  }

  // -------------------------------------------------------------------------
  // Captura de texto
  // -------------------------------------------------------------------------

  /**
   * Extrai conceitos de um texto colado pelo aluno.
   *
   * O valor nao esta na extracao, esta no que ela alimenta: cada termo aceito
   * entra pelo `learn`, ou seja, nasce ja nos quatro idiomas. Um artigo lido em
   * ingles vira vocabulario de russo tambem -- que e a unica forma de um texto
   * real alimentar quatro cursos ao mesmo tempo.
   *
   * Os termos que o aluno ja tem sao descartados aqui, e nao no prompt: pedir
   * ao modelo para evitar repeticao funciona mal e custa tokens, enquanto o
   * banco responde isso com certeza.
   */
  async capture(
    userId: string,
    input: { languageCode: string; text: string; count?: number },
  ): Promise<{ learned: ConceptCard[]; skipped: string[] }> {
    const profile = await this.profile(userId);
    const language = profile.find((l) => l.code === input.languageCode);
    if (!language) {
      throw new NotFoundException(`Voce nao esta estudando o idioma "${input.languageCode}".`);
    }

    const text = input.text.trim().slice(0, MAX_CAPTURE_CHARS);
    if (text.length < 40) {
      throw new NotFoundException('Cole um texto um pouco maior para valer a extracao.');
    }

    const count = Math.min(Math.max(input.count ?? 6, 1), MAX_CAPTURE_TERMS);

    const known = await this.prisma.userVocabulary.findMany({
      where: { userId, vocabulary: { language: { code: input.languageCode } } },
      include: { vocabulary: { select: { term: true } } },
      take: 500,
    });
    const knownTerms = new Set(known.map((k) => k.vocabulary.term.trim().toLowerCase()));

    const ctx: LearnerContext = {
      languageName: language.name,
      languageCode: language.code,
      level: language.level,
      recentErrors: [],
      recentVocabulary: [...knownTerms].slice(0, 40),
    };

    const result = await this.ai.chatJson<GeneratedTerms>({
      task: 'concept.extract',
      json: true,
      userId,
      language: input.languageCode,
      messages: [{ role: 'user', content: extractTermsPrompt(ctx, text, count) }],
    });

    const learned: ConceptCard[] = [];
    const skipped: string[] = [];

    for (const term of result.terms ?? []) {
      if (!term?.term?.trim() || !term.meaning?.trim()) continue;

      if (knownTerms.has(term.term.trim().toLowerCase())) {
        skipped.push(term.term.trim());
        continue;
      }

      // Cada termo passa pela porta unica: e ela que completa nos outros
      // idiomas e matricula nos quatro. Escrever direto na tabela aqui seria
      // recriar exatamente o problema que os conceitos vieram resolver.
      const card = await this.learn(userId, {
        languageCode: input.languageCode,
        term: term.term.trim(),
        meaning: term.meaning.trim(),
        example: term.example?.trim(),
        translation: term.translation?.trim(),
        level: (LEVELS.includes(term.level as CefrLevel) ? term.level : language.level) as CefrLevel,
        source: 'capture',
      });

      learned.push(card);
      knownTerms.add(term.term.trim().toLowerCase());
    }

    return { learned, skipped };
  }

  /** Quantos conceitos do aluno ainda nao existem em todos os idiomas dele. */
  async gaps(userId: string): Promise<{ complete: number; incomplete: number }> {
    const codes = await this.studyCodes(userId);
    const rows = await this.prisma.userVocabulary.findMany({
      where: { userId, vocabulary: { conceptId: { not: null } } },
      select: { vocabulary: { select: { conceptId: true } } },
    });

    const ids = [...new Set(rows.map((r) => r.vocabulary.conceptId!))];
    const complete = await this.completeOnes(ids, codes);
    return { complete: complete.length, incomplete: ids.length - complete.length };
  }

  /** Dos conceitos dados, quais existem em todos os idiomas -- na ordem recebida. */
  private async completeOnes(ids: string[], codes: string[]): Promise<string[]> {
    if (ids.length === 0) return [];

    const entries = await this.prisma.vocabulary.findMany({
      where: { conceptId: { in: ids }, language: { code: { in: codes } } },
      select: { conceptId: true, language: { select: { code: true } } },
    });

    const byConcept = new Map<string, Set<string>>();
    for (const entry of entries) {
      const set = byConcept.get(entry.conceptId!) ?? new Set<string>();
      set.add(entry.language.code);
      byConcept.set(entry.conceptId!, set);
    }

    return ids.filter((id) => {
      const have = byConcept.get(id);
      return Boolean(have) && codes.every((code) => have!.has(code));
    });
  }

  private async missingCodes(conceptId: string, codes: string[]): Promise<string[]> {
    const entries = await this.prisma.vocabulary.findMany({
      where: { conceptId, language: { code: { in: codes } } },
      select: { language: { select: { code: true } } },
    });
    const have = new Set(entries.map((e) => e.language.code));
    return codes.filter((code) => !have.has(code));
  }
}

/**
 * Chave do conceito a partir do significado em portugues.
 *
 * E o que decide se dois termos sao o mesmo conceito, entao precisa ser
 * estavel: minusculas, sem acento, sem parenteses explicativos (que carregam
 * avisos de construcao, nao o significado) e sem artigo inicial.
 */
export function conceptSlug(meaning: string): string {
  return meaning
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(o|a|os|as|um|uma)\s+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
