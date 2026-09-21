import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  findFoundationLesson,
  FOUNDATION_TRACKS,
  FoundationLesson,
  FoundationPiece,
  foundationTopicId,
  piecesUpTo,
} from './foundation.catalog';

/** Peso do resultado novo na media movel -- o mesmo de alfabeto e estrutura. */
const MASTERY_WEIGHT = 0.3;

/**
 * A partir de quanto a licao conta como vencida.
 *
 * 75, e nao os 80 do alfabeto. A diferenca e deliberada: ler uma letra errada
 * corrompe toda palavra que vem depois, entao ali o rigor se paga. Aqui o que se
 * mede e montagem de frase, e a frase volta a aparecer o tempo todo nos blocos
 * seguintes -- segurar o aluno num degrau por causa de um erro de terminacao
 * custaria mais do que deixar a exposicao posterior consertar.
 */
const MASTERY_THRESHOLD = 75;

/**
 * Depois de quantos dias uma licao ja vencida volta para revisao.
 *
 * A trilha tinha um buraco: passando de 75%, a licao sumia para sempre. O aluno
 * aprendia `nicht` na licao 3 e ela nunca mais era cobrada de proposito -- so
 * por acaso, se reaparecesse dentro de uma frase depois.
 *
 * O conserto NAO foi jogar as pecas no baralho de revisao. Cartao de
 * reconhecimento ("o que quer dizer `bin`?") testa a coisa que nunca foi
 * dificil; o que custa e saber ONDE a peca entra, e isso so o exercicio de
 * montar frase cobra. Entao quem volta e a propria licao, e so a fase de
 * treino dela.
 *
 * Dez dias porque a licao volta uma vez e reseta o relogio: o bloco de
 * fundamentos ocupa a vaga de estrutura, e uma revisao a cada dez dias custa um
 * dia em dez daquela vaga. Mais curto que isso e a aula de estrutura que passa
 * a ser a sacrificada.
 */
const STALE_DAYS = 10;

export type FoundationMode = 'learn' | 'review';

export interface FoundationSelection {
  lesson: FoundationLesson;
  /** Posicao 1-based, para a tela dizer "3 de 8". */
  index: number;
  /** Toda a trilha ja foi vencida ao menos uma vez. */
  complete: boolean;
  /**
   * `learn` = licao ainda nao vencida, com as pecas e as frases antes do
   * treino. `review` = licao ja vencida voltando, so o treino.
   */
  mode: FoundationMode;
  /**
   * Este idioma precisa de um bloco de fundamentos HOJE.
   *
   * Separado de `complete` porque as duas perguntas sao diferentes: com a
   * trilha fechada e nada vencendo, nao ha bloco a servir -- e a vaga volta
   * para a aula de estrutura, que e onde ela deve estar.
   */
  due: boolean;
}

/**
 * Qual licao servir, dado o dominio e a data do ultimo estudo de cada uma.
 *
 * Duas regras, nesta ordem:
 *
 * 1. APRENDER vem antes de revisar. A trilha e uma ESCADA -- a licao 7 monta
 *    frases com o "не" da 4 e o "здесь" da 3 --, entao a primeira nao vencida
 *    e sempre a proxima, e pular um degrau entregaria uma aula com pecas que o
 *    aluno nunca viu.
 * 2. Fechada a trilha, volta a licao MAIS ANTIGA, se ela ja passou do prazo.
 *    Mais antiga e nao a de menor nota: nota baixa que acabou de ser treinada
 *    ainda esta fresca, e o que o esquecimento come e o tempo.
 *
 * Se uma revisao derrubar a nota abaixo de 75, a regra 1 volta a valer sozinha
 * no dia seguinte e o aluno refaz a licao inteira -- pecas, frases e treino.
 * Isso e efeito desejado, nao acidente: nota que caiu significa que a licao
 * nao estava firme.
 */
export function selectFoundationLesson(
  lessons: FoundationLesson[],
  masteryByLessonId: Record<string, number>,
  lastStudiedByLessonId: Record<string, Date | null> = {},
  now: Date = new Date(),
): FoundationSelection {
  const pending = lessons.findIndex((l) => (masteryByLessonId[l.id] ?? 0) < MASTERY_THRESHOLD);

  if (pending >= 0) {
    return {
      lesson: lessons[pending],
      index: pending + 1,
      complete: false,
      mode: 'learn',
      due: true,
    };
  }

  // Trilha fechada: a mais antiga primeiro. Licao sem data conta como a mais
  // antiga possivel -- ela venceu antes de o registro existir.
  const oldest = lessons.reduce((worst, lesson) => {
    const a = lastStudiedByLessonId[lesson.id]?.getTime() ?? 0;
    const b = lastStudiedByLessonId[worst.id]?.getTime() ?? 0;
    return a < b ? lesson : worst;
  }, lessons[0]);

  const studiedAt = lastStudiedByLessonId[oldest.id]?.getTime() ?? 0;
  const days = (now.getTime() - studiedAt) / 86_400_000;

  return {
    lesson: oldest,
    index: lessons.indexOf(oldest) + 1,
    complete: true,
    mode: 'review',
    due: days >= STALE_DAYS,
  };
}

/**
 * A trilha de fundamentos.
 *
 * O aluno relatou nao conseguir aprender alemao nem russo porque nao sabe NADA
 * dos dois: "eu nao conseguiria aprender ingles se, antes das aulas, eu nao
 * soubesse o que significa o verbo to be". O alfabeto resolveu metade do
 * problema no russo -- ele passou a ler os caracteres --, mas continuava sem a
 * outra metade, que e como as pecas viram frase. E no alemao nao havia nada:
 * o app o jogava direto numa can-do A1 que ja pressupoe pronome, verbo e ordem.
 *
 * Como o alfabeto, NAO passa por IA. Pela mesma razao escrita la: o conteudo
 * precisa estar certo, e a trilha nao pode depender de uma chamada de rede que
 * ja derrubou o bloco de estrutura no limite de 60s da Vercel.
 */
@Injectable()
export class FoundationService {
  constructor(private readonly prisma: PrismaService) {}

  /** A licao de fundamentos de hoje para um idioma. */
  async lesson(userId: string, languageCode: string) {
    const lessons = this.track(languageCode);

    const userLanguage = await this.prisma.userLanguage.findFirst({
      where: { userId, language: { code: languageCode } },
      include: { language: true },
    });
    if (!userLanguage) {
      throw new NotFoundException(`Voce nao esta estudando o idioma "${languageCode}".`);
    }

    const rows = await this.progressRows(userId, languageCode, lessons);
    const { lesson, index, complete, mode } = selectFoundationLesson(
      lessons,
      masteryOf(lessons, rows),
      lastStudiedOf(lessons, rows),
    );

    const progress = await this.prisma.grammarProgress.findUnique({
      where: {
        userId_topicId_languageCode: {
          userId,
          topicId: foundationTopicId(lesson.id),
          languageCode,
        },
      },
    });

    return {
      lessonId: lesson.id,
      languageCode,
      languageName: userLanguage.language.name,
      index,
      total: lessons.length,
      title: lesson.title,
      goal: lesson.goal,
      rule: lesson.rule,
      pieces: lesson.pieces,
      sentences: lesson.sentences,
      /**
       * As pecas ja vistas, para o treino ter distratores plausiveis. Perguntar
       * "o que quer dizer `nicht`" com tres alternativas que o aluno nunca viu
       * nao testa nada: ele elimina por estranheza, nao por saber.
       */
      review: this.reviewPieces(languageCode, lesson),
      mastery: Math.round(progress?.mastery ?? 0),
      complete,
      /**
       * `review` faz a tela abrir direto no treino.
       *
       * Reapresentar as pecas e as frases de uma licao que ja esta em 80% seria
       * pedir ao aluno que leia de novo o que ele ja sabe antes de provar que
       * sabe -- e o caminho mais curto para ele passar a pular o bloco.
       */
      mode,
    };
  }

  private reviewPieces(languageCode: string, lesson: FoundationLesson): FoundationPiece[] {
    // As mais recentes primeiro: distrator bom e o que ele viu ha pouco e ainda
    // confunde, nao a palavra da primeira aula que ja assentou.
    return piecesUpTo(languageCode, lesson.id).reverse().slice(0, 12);
  }

  /**
   * O idioma ainda precisa dos fundamentos antes de estudar frase de verdade?
   *
   * O planejador da sessao chama isto todo dia, por idioma. Ele so olha para
   * esta resposta DEPOIS do alfabeto: no russo, quem ainda nao le os caracteres
   * nao tem o que fazer numa aula que monta frases em cirilico.
   */
  async needsFoundation(userId: string, languageCode: string): Promise<boolean> {
    const lessons = FOUNDATION_TRACKS[languageCode];
    if (!lessons?.length) return false;

    const rows = await this.progressRows(userId, languageCode, lessons);
    // `due`, e nao `!complete`: com a trilha fechada e nada vencendo, nao ha
    // bloco a servir, e a vaga volta para a aula de estrutura.
    return selectFoundationLesson(
      lessons,
      masteryOf(lessons, rows),
      lastStudiedOf(lessons, rows),
    ).due;
  }

  /** Registra o resultado de uma rodada de treino. */
  async record(
    userId: string,
    lessonId: string,
    languageCode: string,
    correct: number,
    total: number,
  ) {
    const lesson = findFoundationLesson(languageCode, lessonId);
    if (!lesson) {
      throw new NotFoundException(
        `Licao de fundamentos "${lessonId}" nao existe em "${languageCode}".`,
      );
    }
    if (total <= 0) throw new NotFoundException('Rodada sem exercicios.');

    const score = Math.round((correct / total) * 100);
    const key = {
      userId_topicId_languageCode: {
        userId,
        topicId: foundationTopicId(lessonId),
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
        topicId: foundationTopicId(lessonId),
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

  private track(languageCode: string): FoundationLesson[] {
    const lessons = FOUNDATION_TRACKS[languageCode];
    if (!lessons?.length) {
      throw new NotFoundException(
        `O idioma "${languageCode}" não tem trilha de fundamentos — nele você já monta frase.`,
      );
    }
    return lessons;
  }

  /** As linhas de progresso das licoes deste idioma, de uma vez so. */
  private async progressRows(userId: string, languageCode: string, lessons: FoundationLesson[]) {
    return this.prisma.grammarProgress.findMany({
      where: {
        userId,
        languageCode,
        topicId: { in: lessons.map((l) => foundationTopicId(l.id)) },
      },
      select: { topicId: true, mastery: true, lastStudiedAt: true },
    });
  }
}

/** Linha de `grammar_progress` reduzida ao que a selecao precisa. */
interface ProgressRow {
  topicId: string;
  mastery: number;
  lastStudiedAt: Date | null;
}

function rowFor(lesson: FoundationLesson, rows: ProgressRow[]): ProgressRow | undefined {
  return rows.find((r) => r.topicId === foundationTopicId(lesson.id));
}

export function masteryOf(
  lessons: FoundationLesson[],
  rows: ProgressRow[],
): Record<string, number> {
  return Object.fromEntries(lessons.map((l) => [l.id, rowFor(l, rows)?.mastery ?? 0]));
}

export function lastStudiedOf(
  lessons: FoundationLesson[],
  rows: ProgressRow[],
): Record<string, Date | null> {
  return Object.fromEntries(lessons.map((l) => [l.id, rowFor(l, rows)?.lastStudiedAt ?? null]));
}
