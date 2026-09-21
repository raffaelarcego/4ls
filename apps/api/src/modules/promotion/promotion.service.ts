import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CefrLevel, VocabStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { compositeScore } from '../languages/languages.service';
import {
  Cefr,
  Gate,
  gate,
  ITEMS_PER_ROUND,
  MIN_ITEMS,
  PROMOTION_LOST,
  PROMOTION_WON,
  Round,
  RoundTally,
  ROUNDS,
  dampenSkills,
  examScore,
  passed,
  weakestRound,
} from './promotion.rules';

export interface PromotionItem {
  round: Round;
  /** O enunciado. Em portugues na montagem, no idioma nas outras rodadas. */
  prompt: string;
  /** So na montagem: as pecas ja embaralhadas. */
  scrambled?: string[];
  /** Nas rodadas de multipla escolha. */
  options?: string[];
  answer: string;
  explanation?: string;
}

interface StoredRealization {
  languageCode: string;
  sentence: string;
  parts?: Array<{ text: string; column: string }>;
}

interface StoredCanDoSentence {
  gloss: string;
  realizations?: StoredRealization[];
}

interface StoredReadingVersion {
  languageCode: string;
  questions?: Array<{
    prompt: string;
    options: string[];
    answer: string;
    explanation?: string;
  }>;
}

/**
 * O chefe de fase: o exame que promove o idioma de nivel.
 *
 * O CEFR era meio motor -- media as competencias, sugeria a subida e nunca
 * subia. Como o nivel e o teto de todo o conteudo (can-do, leitura, estrutura),
 * o idioma ficava preso onde comecou.
 *
 * Aqui a nota composta deixa de promover e passa a ABRIR o chefe; quem promove
 * e um exame com gabarito. Isso importa porque metade das notas de competencia
 * vem de autoavaliacao de fim de bloco: promover por elas seria endurecer o
 * conteudo a partir de "achei que fui bem".
 *
 * O exame nao gera nada e nao usa IA, pelo mesmo motivo da prova mensal: uma
 * nota dada por modelo varia entre execucoes, e o que decide subir de nivel nao
 * pode variar. Todos os itens saem do que o aluno JA estudou -- as frases das
 * can-dos, as perguntas dos textos que ele leu, as palavras que ele deu por
 * aprendidas.
 */
@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * O estado do chefe em cada idioma, para o painel.
   *
   * Monta o exame so quando ele pode mesmo abrir. O portao decide por
   * desempenho e por espera antes de olhar para o material, entao contar itens
   * dos quatro idiomas a cada abertura do painel seria pagar quatro varreduras
   * de banco para chegar sempre a mesma resposta.
   */
  async status(userId: string) {
    const enrolled = await this.prisma.userLanguage.findMany({
      where: { userId },
      include: { language: true },
      orderBy: { priority: 'asc' },
    });

    const now = new Date();
    const out: Array<Gate & { languageCode: string; languageName: string; currentLevel: string }> =
      [];

    for (const ul of enrolled) {
      const input = {
        currentLevel: ul.currentLevel as string,
        composite: compositeScore(skillsOf(ul)),
        lastFailedAt: await this.lastFailedAt(userId, ul.languageId),
        now,
      };

      // Fingindo material suficiente, o portao responde tudo que nao depende
      // dele. So quando isso devolve "pronto" e que vale contar os itens.
      const preliminary = gate({ ...input, itemCount: MIN_ITEMS });

      const resolved =
        preliminary.state === 'ready'
          ? gate({ ...input, itemCount: (await this.buildExam(userId, ul.language.code)).length })
          : preliminary;

      out.push({
        ...resolved,
        languageCode: ul.language.code,
        languageName: ul.language.name,
        currentLevel: ul.currentLevel as string,
      });
    }

    return out;
  }

  /** O exame de um idioma, se o chefe estiver aberto. */
  async exam(userId: string, languageCode: string) {
    const { userLanguage, open } = await this.requireOpenGate(userId, languageCode);
    const items = await this.buildExam(userId, languageCode);

    return {
      languageCode,
      languageName: userLanguage.language.name,
      currentLevel: userLanguage.currentLevel as string,
      nextLevel: open.nextLevel,
      items,
    };
  }

  /**
   * O resultado do exame.
   *
   * Reconfere o portao antes de gravar qualquer coisa: entre abrir o exame e
   * responde-lo o aluno pode ter perdido o chefe noutra aba, e um POST solto
   * nao pode promover ninguem.
   */
  async attempt(
    userId: string,
    languageCode: string,
    results: Array<{ round: Round; correct: boolean }>,
  ) {
    const { userLanguage, open } = await this.requireOpenGate(userId, languageCode);

    const tallies = tally(results);
    const score = examScore(tallies);
    const won = passed(tallies);
    const target = open.nextLevel;

    if (!target) throw new ForbiddenException('Este idioma já está no topo da escala.');

    /*
     * A linha de `assessments` e o registro permanente da tentativa, e ela vem
     * antes da promocao de proposito: se a atualizacao do nivel falhar, fica a
     * prova de que o exame aconteceu -- o contrario deixaria um nivel novo sem
     * nada que o explique.
     */
    await this.prisma.assessment.create({
      data: {
        userId,
        languageId: userLanguage.languageId,
        skill: won ? PROMOTION_WON : PROMOTION_LOST,
        score,
        estimatedLevel: (won ? target : userLanguage.currentLevel) as CefrLevel,
        detail: {
          passed: won,
          from: userLanguage.currentLevel,
          to: won ? target : userLanguage.currentLevel,
          rounds: tallies,
        } as unknown as object,
      },
    });

    if (won) {
      await this.prisma.userLanguage.update({
        where: { id: userLanguage.id },
        data: {
          currentLevel: target as CefrLevel,
          /*
           * As competencias encolhem junto com a subida. Nao e punicao, e
           * mudanca de regua: 85 de gramatica em A1 nao e 85 em A2. Sem isso a
           * composta continuaria acima do portao e o chefe seguinte abriria
           * amanha.
           */
          ...dampenSkills(skillsOf(userLanguage)),
        },
      });

      this.logger.log(
        `${languageCode}: ${userLanguage.currentLevel} -> ${target} com ${score}% no chefe.`,
      );
    }

    return {
      passed: won,
      score,
      rounds: tallies,
      from: userLanguage.currentLevel as string,
      /** Onde ele ficou. Igual ao anterior quando perdeu. */
      level: won ? target : (userLanguage.currentLevel as string),
      /** A rodada que afundou, quando houve uma. Vira o que treinar. */
      weakest: weakestRound(tallies),
    };
  }

  private async requireOpenGate(userId: string, languageCode: string) {
    const userLanguage = await this.prisma.userLanguage.findFirst({
      where: { userId, language: { code: languageCode } },
      include: { language: true },
    });
    if (!userLanguage) {
      throw new NotFoundException(`Voce nao esta estudando o idioma "${languageCode}".`);
    }

    const open = gate({
      currentLevel: userLanguage.currentLevel as string,
      composite: compositeScore(skillsOf(userLanguage)),
      lastFailedAt: await this.lastFailedAt(userId, userLanguage.languageId),
      itemCount: (await this.buildExam(userId, languageCode)).length,
      now: new Date(),
    });

    if (open.state !== 'ready') throw new ForbiddenException(open.reason);

    return { userLanguage, open };
  }

  private async lastFailedAt(userId: string, languageId: string): Promise<Date | null> {
    const lost = await this.prisma.assessment.findFirst({
      where: { userId, languageId, skill: PROMOTION_LOST },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return lost?.createdAt ?? null;
  }

  /**
   * As tres rodadas do exame.
   *
   * Tudo sai do que ele JA estudou neste idioma, e essa e a regra que segura o
   * exame de pe: cobrar material que ele nunca viu mediria sorte, e gerar
   * conteudo novo na hora mediria improviso. As tres rodadas medem coisas
   * diferentes de proposito -- montar, entender e saber a palavra --, porque o
   * nivel seguinte cobra as tres.
   */
  private async buildExam(userId: string, languageCode: string): Promise<PromotionItem[]> {
    const [sentences, reading, vocabulary] = await Promise.all([
      this.sentenceItems(userId, languageCode),
      this.readingItems(userId, languageCode),
      this.vocabularyItems(userId, languageCode),
    ]);

    // A ordem e a das rodadas: o chefe tem fases, e elas nao se misturam.
    return [...sentences, ...reading, ...vocabulary];
  }

  /** Rodada 1: montar frases das can-dos que ele estudou neste idioma. */
  private async sentenceItems(userId: string, languageCode: string): Promise<PromotionItem[]> {
    const studied = await this.prisma.grammarProgress.findMany({
      where: { userId, languageCode, topicId: { startsWith: 'cando:' } },
      orderBy: { mastery: 'desc' },
      select: { topicId: true },
    });

    const canDoIds = studied.map((s) => s.topicId.slice('cando:'.length));
    if (canDoIds.length === 0) return [];

    const lessons = await this.prisma.canDoLesson.findMany({
      where: { canDoId: { in: canDoIds } },
      orderBy: { lastUsedAt: 'desc' },
    });

    const items: PromotionItem[] = [];
    const seen = new Set<string>();

    for (const lesson of lessons) {
      // Uma frase por can-do: quatro frases da mesma funcao mediriam uma coisa
      // so e ainda dariam ao exame a cara de repeticao.
      if (seen.has(lesson.canDoId)) continue;

      for (const sentence of (lesson.sentences ?? []) as unknown as StoredCanDoSentence[]) {
        const realization = (sentence.realizations ?? []).find(
          (r) => r.languageCode === languageCode,
        );
        const parts = realization?.parts ?? [];
        // Frase de um pedaco so nao tem ordem a testar: sairia como acerto de
        // graca e inflaria a rodada que mais importa.
        if (!realization || parts.length < 2) continue;

        items.push({
          round: 'sentences',
          prompt: sentence.gloss,
          scrambled: shuffle(parts.map((p) => p.text)),
          answer: parts.map((p) => p.text).join(' '),
        });
        seen.add(lesson.canDoId);
        break;
      }

      if (items.length >= ITEMS_PER_ROUND) break;
    }

    return items;
  }

  /** Rodada 2: compreensao dos textos que ele leu neste idioma. */
  private async readingItems(userId: string, languageCode: string): Promise<PromotionItem[]> {
    const read = await this.prisma.grammarProgress.findMany({
      where: { userId, languageCode, topicId: { startsWith: 'reading:' } },
      orderBy: { lastStudiedAt: 'desc' },
      select: { topicId: true },
    });

    const topicIds = read.map((r) => r.topicId.slice('reading:'.length));
    if (topicIds.length === 0) return [];

    const passages = await this.prisma.readingPassage.findMany({
      where: { topicId: { in: topicIds } },
      orderBy: { lastUsedAt: 'desc' },
    });

    const items: PromotionItem[] = [];
    const seen = new Set<string>();

    for (const passage of passages) {
      if (seen.has(passage.topicId)) continue;

      const version = ((passage.versions ?? []) as unknown as StoredReadingVersion[]).find(
        (v) => v.languageCode === languageCode,
      );
      const question = (version?.questions ?? []).find(
        (q) => q?.prompt && Array.isArray(q.options) && q.options.includes(q.answer),
      );
      if (!question) continue;

      items.push({
        round: 'reading',
        prompt: question.prompt,
        options: shuffle(question.options),
        answer: question.answer,
        explanation: question.explanation,
      });
      seen.add(passage.topicId);

      if (items.length >= ITEMS_PER_ROUND) break;
    }

    return items;
  }

  /**
   * Rodada 3: palavras que ele deu por aprendidas.
   *
   * So `REVIEW` e `MASTERED`: cobrar um card novo mede o que ele acabou de ver,
   * e o exame existe para responder outra coisa -- o que ficou.
   */
  private async vocabularyItems(userId: string, languageCode: string): Promise<PromotionItem[]> {
    const learned = await this.prisma.userVocabulary.findMany({
      where: {
        userId,
        status: { in: [VocabStatus.REVIEW, VocabStatus.MASTERED] },
        vocabulary: { language: { code: languageCode } },
      },
      include: { vocabulary: true },
      orderBy: { lastReview: 'asc' },
      take: ITEMS_PER_ROUND * 4,
    });

    // Distratores precisam ser plausiveis e do mesmo idioma: um significado
    // obviamente fora de contexto entrega a resposta sem medir nada.
    const meanings = [...new Set(learned.map((l) => l.vocabulary.meaning))];
    if (meanings.length < 3) return [];

    const items: PromotionItem[] = [];

    for (const entry of shuffle(learned).slice(0, ITEMS_PER_ROUND)) {
      const answer = entry.vocabulary.meaning;
      const distractors = shuffle(meanings.filter((m) => m !== answer)).slice(0, 2);
      if (distractors.length < 2) continue;

      items.push({
        round: 'vocabulary',
        prompt: entry.vocabulary.term,
        options: shuffle([answer, ...distractors]),
        answer,
        explanation: entry.vocabulary.example ?? undefined,
      });
    }

    return items;
  }
}

/** As competencias de uma linha de `user_languages`, no formato dos pesos. */
function skillsOf(ul: {
  listening: number;
  reading: number;
  writing: number;
  speaking: number;
  vocabScore: number;
  grammar: number;
}): Record<string, number> {
  return {
    listening: ul.listening,
    reading: ul.reading,
    writing: ul.writing,
    speaking: ul.speaking,
    vocabScore: ul.vocabScore,
    grammar: ul.grammar,
  };
}

/** Os acertos por rodada, na ordem das rodadas. */
export function tally(results: Array<{ round: Round; correct: boolean }>): RoundTally[] {
  return ROUNDS.map((round) => {
    const mine = results.filter((r) => r.round === round);
    return {
      round,
      correct: mine.filter((r) => r.correct).length,
      total: mine.length,
    };
  }).filter((t) => t.total > 0);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export type { Cefr };
