import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  morphologyParadigmPrompt,
  MorphologyParadigmContext,
} from '../../infrastructure/ai/prompts';
import { AiRouterService } from '../../infrastructure/ai/ai-router.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  allSlotsFor,
  findSlot,
  hasMorphology,
  MorphologySlot,
  morphologyTopicId,
  slotsFor,
} from './morphology.catalog';
import {
  masteryBySlot,
  MorphologyProgressRow,
  morphologyTopicIdsFor,
  pickSlot,
  rankTerms,
  toMorphologyRows,
} from './morphology.selection';

/** Peso do resultado novo na media movel de dominio. Igual aos outros blocos. */
const MASTERY_WEIGHT = 0.3;

/**
 * Quantas palavras diferentes manter declinadas por idioma.
 *
 * Aqui o pool tem um papel que ele nao tem nos outros blocos: a terminacao so
 * generaliza vendo-a em palavras DIFERENTES. Quem so treina o dativo de
 * "работа" aprende "работе", nao o dativo.
 */
const POOL_TARGET = 4;

/**
 * Quantas palavras extras treinam o caso do dia, alem da tabela principal.
 *
 * E o que separa "decorar a tabela desta palavra" de "saber o caso": os dois
 * exercicios finais cobram o mesmo caso em palavras que nao estao na tabela
 * aberta na tela.
 */
const EXTRA_WORDS = 2;

export interface ParadigmForm {
  slotId: string;
  form: string;
  romanization?: string | null;
  note?: string | null;
}

export interface ParadigmExample {
  slotId: string;
  sentence: string;
  romanization?: string | null;
  translation: string;
  /** O pedaco a esconder. Identico a forma daquele caso. */
  gap: string;
}

interface GeneratedParadigm {
  term: string;
  gloss: string;
  gender?: string | null;
  pattern: string;
  forms: ParadigmForm[];
  examples: ParadigmExample[];
}

/**
 * Morfologia: a palavra muda de forma conforme a funcao.
 *
 * O produto ensinava a ORDEM das pecas (estrutura, can-do) e o SIGNIFICADO da
 * palavra (conceitos), e nunca ensinou que a palavra muda. Em alemao e russo ela
 * muda em toda frase -- e o aluno montava a ordem certa com a forma errada, que
 * para um nativo soa pior do que a ordem trocada.
 *
 * O catalogo de contrastes ja EXPLICA os casos. Aqui nao se explica: produz-se.
 * A tabela e de uma palavra do vocabulario dele, e o exercicio esconde a forma
 * dentro de uma frase que exige aquele caso. Os distratores sao as outras linhas
 * da propria tabela -- os concorrentes certos, de graca, sem IA para corrigir.
 */
@Injectable()
export class MorphologyService {
  private readonly logger = new Logger(MorphologyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiRouterService,
  ) {}

  /**
   * A aula de casos de hoje, num idioma.
   *
   * So le conteudo pronto, como os outros blocos: quem gera e `warm()`, fora do
   * horario de estudo.
   */
  async lesson(userId: string, languageCode: string) {
    const userLanguage = await this.prisma.userLanguage.findFirst({
      where: { userId, language: { code: languageCode } },
      include: { language: true },
    });
    if (!userLanguage) {
      throw new NotFoundException(`Voce nao esta estudando o idioma "${languageCode}".`);
    }

    if (!hasMorphology(languageCode)) {
      throw new NotFoundException(
        `${userLanguage.language.name} nao marca caso no substantivo -- nao ha tabela a treinar.`,
      );
    }

    const level = userLanguage.currentLevel as string;
    const candidates = slotsFor(languageCode, level);
    const rows = await this.progressRows(userId, languageCode, level);
    const slot = pickSlot(candidates, rows)!;

    const paradigms = await this.fromPool(languageCode, slot, candidates);
    const [main, ...extras] = paradigms;

    return {
      languageCode,
      languageName: userLanguage.language.name,
      level,
      /** O caso em foco hoje -- a linha destacada e o alvo dos exercicios extras. */
      slot: {
        id: slot.id,
        name: slot.name,
        question: slot.question,
        triggers: slot.triggers,
        trap: slot.trap,
      },
      /** Todos os casos do idioma, para a tabela mostrar o mapa inteiro. */
      slots: allSlotsFor(languageCode).map((s) => ({
        id: s.id,
        name: s.name,
        question: s.question,
        /** Fora do nivel dele ainda: aparece na tabela, nao entra no treino. */
        locked: !candidates.some((c) => c.id === s.id),
      })),
      mastery: masteryBySlot(rows),
      word: {
        term: main.term,
        gloss: main.gloss,
        gender: main.gender,
        pattern: main.pattern,
        forms: main.forms,
      },
      drills: buildDrills(main, extras, slot, candidates),
    };
  }

  /**
   * Declina mais palavras do vocabulario dele neste idioma.
   *
   * Roda fora do horario de estudo. Gera so o que falta ate o pool encher, e
   * pula as palavras que ja tem tabela -- idempotente e de graca quando cheio.
   */
  async warm(userId: string, languageCode: string, target = POOL_TARGET): Promise<number> {
    if (!hasMorphology(languageCode)) return 0;

    const userLanguage = await this.prisma.userLanguage.findFirst({
      where: { userId, language: { code: languageCode } },
    });
    if (!userLanguage) return 0;

    const existing = await this.prisma.morphologyParadigm.findMany({
      where: { languageCode },
      select: { term: true },
    });
    if (existing.length >= target) return 0;

    const done = new Set(existing.map((e) => e.term));
    const slots = allSlotsFor(languageCode);
    const level = userLanguage.currentLevel as string;

    /*
     * As palavras vem do vocabulario DELE. Declinar uma palavra que ele nunca
     * viu ensinaria duas coisas ao mesmo tempo -- a palavra e a terminacao --, e
     * a terminacao e a que se perde.
     */
    const learned = await this.prisma.userVocabulary.findMany({
      where: { userId, vocabulary: { language: { code: languageCode } } },
      include: { vocabulary: true },
      take: 60,
    });

    const wanted = rankTerms(
      learned
        .filter((l) => !done.has(l.vocabulary.term))
        .map((l) => ({
          term: l.vocabulary.term,
          meaning: l.vocabulary.meaning,
          conceptId: l.vocabulary.conceptId,
          confidence: l.confidence,
          createdAt: l.vocabulary.createdAt,
        })),
      // Uma folga sobre o que falta: palavra que nao declina e descartada, e
      // sem folga o pool nunca fecharia.
      (target - existing.length) * 2,
    );

    let created = 0;

    for (const candidate of wanted) {
      if (existing.length + created >= target) break;

      try {
        const generated = await this.generate(userId, languageCode, level, candidate, slots);
        await this.prisma.morphologyParadigm.create({
          data: {
            languageCode,
            conceptId: candidate.conceptId,
            term: generated.term,
            gloss: generated.gloss,
            gender: generated.gender ?? null,
            pattern: generated.pattern,
            forms: generated.forms as unknown as object,
            examples: generated.examples as unknown as object,
          },
        });
        created += 1;
        this.logger.log(`Tabela de casos preparada: ${languageCode}/${generated.term}.`);
      } catch (error) {
        // Uma palavra que nao declina (ou que voltou torta) nao pode derrubar as
        // outras: o laco segue para a proxima.
        this.logger.warn(`${languageCode}/${candidate.term}: ${(error as Error).message}`);
      }
    }

    return created;
  }

  /**
   * Registra a rodada, caso a caso.
   *
   * Uma linha de progresso por caso, e nao uma nota da aula: acertar o dativo e
   * errar o instrumental sao fatos diferentes, e e o caso mais fraco que decide
   * a aula de amanha. Uma nota so esconderia exatamente isso.
   */
  async record(
    userId: string,
    languageCode: string,
    results: Array<{ slotId: string; correct: boolean }>,
  ) {
    if (results.length === 0) throw new NotFoundException('Rodada sem exercicios.');

    const bySlot = new Map<string, { correct: number; total: number }>();
    for (const result of results) {
      if (!findSlot(result.slotId)) continue;
      const tally = bySlot.get(result.slotId) ?? { correct: 0, total: 0 };
      tally.total += 1;
      if (result.correct) tally.correct += 1;
      bySlot.set(result.slotId, tally);
    }

    const out: Record<string, number> = {};

    for (const [slotId, tally] of bySlot) {
      const score = Math.round((tally.correct / tally.total) * 100);
      const key = {
        userId_topicId_languageCode: {
          userId,
          topicId: morphologyTopicId(slotId),
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
          topicId: morphologyTopicId(slotId),
          languageCode,
          mastery,
          attempts: tally.total,
          correct: tally.correct,
        },
        update: {
          mastery,
          attempts: { increment: tally.total },
          correct: { increment: tally.correct },
          lastStudiedAt: new Date(),
        },
      });

      out[slotId] = Math.round(saved.mastery);
    }

    const total = results.length;
    const correct = results.filter((r) => r.correct).length;

    return { score: Math.round((correct / total) * 100), mastery: out };
  }

  private async progressRows(
    userId: string,
    languageCode: string,
    level: string,
  ): Promise<MorphologyProgressRow[]> {
    const rows = await this.prisma.grammarProgress.findMany({
      where: {
        userId,
        languageCode,
        topicId: { in: morphologyTopicIdsFor(languageCode, level) },
      },
    });
    return toMorphologyRows(rows);
  }

  /**
   * A tabela principal e as palavras extras do caso do dia.
   *
   * A principal e a menos usada -- e o rodizio que impede o aluno de decorar a
   * tabela de uma palavra so. As extras precisam ter exemplo NO CASO DE HOJE:
   * sem isso elas nao servem ao unico papel que tem, que e mostrar a mesma
   * terminacao noutra palavra.
   */
  private async fromPool(languageCode: string, slot: MorphologySlot, candidates: MorphologySlot[]) {
    const pool = await this.prisma.morphologyParadigm.findMany({
      where: { languageCode },
      orderBy: [{ timesUsed: 'asc' }, { lastUsedAt: 'asc' }],
    });

    const usable = pool.filter((p) => usableStored(p, candidates));

    if (usable.length === 0) {
      throw new ServiceUnavailableException(
        `Nenhuma palavra de ${languageCode} foi declinada ainda. ` +
          'Rode "npm run content:warm -w @4l/api" para preparar as tabelas.',
      );
    }

    const main = usable[0];
    const extras = usable
      .slice(1)
      .filter((p) =>
        ((p.examples ?? []) as unknown as ParadigmExample[]).some((e) => e.slotId === slot.id),
      )
      .slice(0, EXTRA_WORDS);

    await this.prisma.morphologyParadigm
      .updateMany({
        where: { id: { in: [main, ...extras].map((p) => p.id) } },
        data: { timesUsed: { increment: 1 }, lastUsedAt: new Date() },
      })
      .catch(() => undefined);

    return [main, ...extras].map((p) => ({
      term: p.term,
      gloss: p.gloss,
      gender: p.gender,
      pattern: p.pattern,
      forms: (p.forms ?? []) as unknown as ParadigmForm[],
      examples: (p.examples ?? []) as unknown as ParadigmExample[],
    }));
  }

  private async generate(
    userId: string,
    languageCode: string,
    level: string,
    word: { term: string; meaning: string },
    slots: MorphologySlot[],
  ): Promise<GeneratedParadigm> {
    const ctx: MorphologyParadigmContext = {
      languageCode,
      languageName: languageCode === 'ru' ? 'russo' : 'alemão',
      level,
      term: word.term,
      gloss: word.meaning,
      slots: slots.map((s) => ({
        id: s.id,
        name: s.name,
        question: s.question,
        triggers: s.triggers,
      })),
    };

    const result = await this.ai.chatJson<GeneratedParadigm>({
      task: 'morphology.generate',
      json: true,
      userId,
      language: languageCode,
      // Seis casos com forma, nota, frase, romanizacao e traducao -- e o russo
      // rende menos caractere por token. Teto curto trunca o JSON e o erro
      // resultante fala de sintaxe, escondendo que o problema era tamanho.
      maxTokens: 8000,
      messages: [{ role: 'user', content: morphologyParadigmPrompt(ctx) }],
    });

    const slotIds = slots.map((s) => s.id);
    const forms = (result.forms ?? []).filter((f) => f?.form?.trim() && slotIds.includes(f.slotId));

    if (!completeParadigm(forms, slotIds)) {
      throw new Error(`"${word.term}" nao voltou com uma forma por caso -- descartada.`);
    }

    /*
     * Exemplo torto e descartado; forma torta reprova a tabela inteira.
     *
     * A assimetria e deliberada. Um exemplo a menos custa um exercicio. Uma
     * forma errada fica guardada e o aluno a repete em toda frase daquela
     * funcao -- e ele nao tem como desconfiar, porque a tabela e justamente o
     * lugar onde ele vai conferir.
     */
    const examples = (result.examples ?? []).filter((e) => usableExample(e, forms));

    if (examples.length < Math.ceil(slotIds.length * 0.7)) {
      throw new Error(
        `"${word.term}" voltou com ${examples.length} exemplo(s) utilizavel(is) -- descartada.`,
      );
    }

    return {
      term: result.term?.trim() || word.term,
      gloss: result.gloss?.trim() || word.meaning,
      gender: result.gender ?? null,
      pattern: result.pattern?.trim() || 'padrão não informado',
      forms,
      examples,
    };
  }
}

/**
 * Monta os exercicios da rodada.
 *
 * Duas partes, e a segunda e a que faz o caso GENERALIZAR:
 *
 * 1. Um exercicio por caso da tabela principal. Percorrer a tabela inteira e o
 *    que obriga a distinguir um caso do outro -- treinar so o caso do dia
 *    ensinaria a escolher sempre a mesma linha.
 * 2. O caso de hoje, de novo, em palavras que nao estao na tabela aberta. Quem
 *    so treina o dativo de "работа" aprende "работе", nao o dativo.
 *
 * Os distratores sao as outras formas da MESMA palavra: sao os concorrentes
 * reais, e saem de graca -- sem IA, sem gabarito escrito a mao.
 */
export function buildDrills(
  main: { term: string; forms: ParadigmForm[]; examples: ParadigmExample[] },
  extras: Array<{ term: string; forms: ParadigmForm[]; examples: ParadigmExample[] }>,
  focus: MorphologySlot,
  candidates: MorphologySlot[],
): Array<{
  slotId: string;
  term: string;
  sentence: string;
  romanization?: string | null;
  translation: string;
  options: string[];
  answer: string;
}> {
  const allowed = new Set(candidates.map((c) => c.id));

  const fromWord = (word: {
    term: string;
    forms: ParadigmForm[];
    examples: ParadigmExample[];
  }, slotIds: string[]) =>
    slotIds.flatMap((slotId) => {
      const example = word.examples.find((e) => e.slotId === slotId);
      if (!example) return [];

      // As opcoes sao as formas distintas da palavra: duas linhas iguais (o
      // acusativo que copia o nominativo, por exemplo) viram uma alternativa so,
      // senao a questao teria duas respostas certas na tela.
      const options = [...new Set(word.forms.map((f) => f.form))];
      if (options.length < 2) return [];

      return [
        {
          slotId,
          term: word.term,
          sentence: example.sentence.replace(example.gap, '____'),
          romanization: example.romanization ?? null,
          translation: example.translation,
          options,
          answer: example.gap,
        },
      ];
    });

  const table = fromWord(
    main,
    candidates.map((c) => c.id),
  );

  const generalization = extras.flatMap((word) =>
    allowed.has(focus.id) ? fromWord(word, [focus.id]) : [],
  );

  return [...table, ...generalization];
}

/** A tabela so serve com uma forma para CADA caso do idioma. */
export function completeParadigm(forms: ParadigmForm[], slotIds: string[]): boolean {
  if (forms.length === 0) return false;

  const bySlot = new Map(forms.map((f) => [f.slotId, f.form.trim()]));
  if (!slotIds.every((id) => bySlot.get(id))) return false;

  /*
   * Todas as formas iguais e o sinal de que a palavra nao declina -- um verbo,
   * um adverbio, um nome proprio estrangeiro. A tabela existiria sem ensinar
   * nada, e os exercicios teriam a mesma resposta em todas as linhas.
   */
  return new Set(bySlot.values()).size > 1;
}

/**
 * O exemplo so serve se o pedaco escondido for EXATAMENTE a forma daquele caso,
 * e se ele estiver de fato dentro da frase.
 *
 * E a validacao que sustenta o exercicio inteiro. Sem ela: um gap que nao esta
 * na frase produz um enunciado sem lacuna nenhuma; um gap que nao bate com a
 * forma produz uma questao cuja resposta certa nao esta entre as alternativas --
 * e o aluno erra uma questao impossivel e leva isso para o progresso do caso.
 */
export function usableExample(
  example: ParadigmExample | undefined,
  forms: ParadigmForm[],
): boolean {
  if (!example?.sentence?.trim() || !example?.gap?.trim()) return false;
  if (!example.translation?.trim()) return false;
  if (!example.sentence.includes(example.gap)) return false;

  const form = forms.find((f) => f.slotId === example.slotId);
  return Boolean(form) && form!.form.trim() === example.gap.trim();
}

/** Uma tabela guardada ainda serve para a aula de hoje? */
function usableStored(
  paradigm: { forms: unknown; examples: unknown },
  candidates: MorphologySlot[],
): boolean {
  const forms = (paradigm.forms ?? []) as ParadigmForm[];
  const examples = (paradigm.examples ?? []) as ParadigmExample[];
  const ids = candidates.map((c) => c.id);

  // Basta um exercicio possivel entre os casos que o nivel dele ja alcanca.
  return (
    completeParadigm(forms, ids) && examples.some((e) => ids.includes(e.slotId) && e.gap?.trim())
  );
}
