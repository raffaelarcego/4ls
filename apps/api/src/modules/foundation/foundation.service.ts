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

export interface FoundationSelection {
  lesson: FoundationLesson;
  /** Posicao 1-based, para a tela dizer "3 de 8". */
  index: number;
  complete: boolean;
}

/**
 * Qual licao servir, dado o dominio ja registrado de cada uma.
 *
 * Identica em espirito a `selectAlphabetLesson`, e pelo mesmo motivo: a trilha e
 * uma ESCADA. A licao 7 monta frases com o "не" da 4 e o "здесь" da 3, entao
 * pular um degrau porque o de tras esta mais atrasado entregaria uma aula com
 * pecas que o aluno nunca viu. Primeira nao vencida, e so ela.
 */
export function selectFoundationLesson(
  lessons: FoundationLesson[],
  masteryByLessonId: Record<string, number>,
): FoundationSelection {
  const index = lessons.findIndex((l) => (masteryByLessonId[l.id] ?? 0) < MASTERY_THRESHOLD);

  // Trilha inteira vencida: fica na ultima, sinalizada como concluida -- mesma
  // razao do alfabeto, devolver "nada" deixaria a tela vazia para quem terminou.
  if (index < 0) {
    return { lesson: lessons[lessons.length - 1], index: lessons.length, complete: true };
  }

  return { lesson: lessons[index], index: index + 1, complete: false };
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

    const { lesson, index, complete } = selectFoundationLesson(
      lessons,
      await this.masteryByLesson(userId, languageCode, lessons),
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

    const mastery = await this.masteryByLesson(userId, languageCode, lessons);
    return !selectFoundationLesson(lessons, mastery).complete;
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

  private async masteryByLesson(
    userId: string,
    languageCode: string,
    lessons: FoundationLesson[],
  ): Promise<Record<string, number>> {
    const rows = await this.prisma.grammarProgress.findMany({
      where: {
        userId,
        languageCode,
        topicId: { in: lessons.map((l) => foundationTopicId(l.id)) },
      },
    });

    return Object.fromEntries(
      lessons.map((l) => [
        l.id,
        rows.find((r) => r.topicId === foundationTopicId(l.id))?.mastery ?? 0,
      ]),
    );
  }
}
