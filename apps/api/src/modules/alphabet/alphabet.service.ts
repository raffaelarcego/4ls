import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  alphabetTopicId,
  AlphabetLesson,
  CYRILLIC_LESSONS,
  CyrillicLetter,
  findAlphabetLesson,
  lettersUpTo,
} from './cyrillic.catalog';

/** Peso do resultado novo na media movel -- o mesmo de estrutura. */
const MASTERY_WEIGHT = 0.3;

/**
 * A partir de quanto a licao conta como vencida.
 *
 * Alto de proposito: ler uma letra errada nao e um deslize de nivel, e a base
 * de tudo que vem depois. Quem acerta 70% do alfabeto ainda tropeca em uma
 * palavra a cada tres.
 */
const MASTERY_THRESHOLD = 80;

/**
 * As trilhas de alfabeto existentes, por idioma.
 *
 * So o russo tem: ingles, espanhol e alemao ja se leem com o alfabeto que o
 * aluno usa desde crianca, e uma "aula de alfabeto latino" para um brasileiro
 * seria perda de tempo de estudo.
 */
const TRACKS: Record<string, AlphabetLesson[]> = {
  ru: CYRILLIC_LESSONS,
};

export interface AlphabetSelection {
  lesson: AlphabetLesson;
  /** Posicao 1-based, para a tela dizer "2 de 8". */
  index: number;
  complete: boolean;
}

/**
 * Qual licao servir, dado o dominio ja registrado de cada uma.
 *
 * Sem ranqueamento e sem rotacao: a trilha e uma ESCADA. A licao 3 le palavras
 * com as letras da 1 e da 2, entao pular a 2 porque a 3 esta "mais atrasada"
 * entregaria uma aula ilegivel. Por isso a regra e a primeira nao vencida, e so
 * ela.
 *
 * Pura por fora do banco para poder ser testada sozinha.
 */
export function selectAlphabetLesson(
  lessons: AlphabetLesson[],
  masteryByLessonId: Record<string, number>,
): AlphabetSelection {
  const index = lessons.findIndex((l) => (masteryByLessonId[l.id] ?? 0) < MASTERY_THRESHOLD);

  // Trilha inteira vencida: fica na ultima, sinalizada como concluida. Devolver
  // "nada" deixaria a tela sem conteudo justamente para quem terminou.
  if (index < 0) {
    return { lesson: lessons[lessons.length - 1], index: lessons.length, complete: true };
  }

  return { lesson: lessons[index], index: index + 1, complete: false };
}

/**
 * A trilha de alfabeto.
 *
 * O aluno relatou ver as letras russas, ouvir a pronuncia e nao conseguir ligar
 * as duas coisas -- o app tratava A1 como "ja sei ler o alfabeto". Enquanto essa
 * ponte nao existe, ensinar ordem de frase e construir no ar.
 *
 * Este caminho NAO usa IA, e isso e decisao, nao economia: o conteudo e curado
 * e precisa estar certo (uma ancora de som errada ensina a pronuncia errada por
 * meses), e manter a trilha fora da geracao a mantem longe do estouro de 60s da
 * funcao na Vercel que ja derrubou o bloco de estrutura.
 */
@Injectable()
export class AlphabetService {
  constructor(private readonly prisma: PrismaService) {}

  /** A licao de alfabeto de hoje para um idioma. */
  async lesson(userId: string, languageCode: string) {
    const lessons = this.track(languageCode);

    const userLanguage = await this.prisma.userLanguage.findFirst({
      where: { userId, language: { code: languageCode } },
      include: { language: true },
    });
    if (!userLanguage) {
      throw new NotFoundException(`Voce nao esta estudando o idioma "${languageCode}".`);
    }

    const { lesson, index, complete } = selectAlphabetLesson(
      lessons,
      await this.masteryByLesson(userId, languageCode, lessons),
    );

    const progress = await this.prisma.grammarProgress.findUnique({
      where: {
        userId_topicId_languageCode: {
          userId,
          topicId: alphabetTopicId(lesson.id),
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
      letters: lesson.letters,
      words: lesson.words,
      review: this.previousLetters(lesson),
      mastery: Math.round(progress?.mastery ?? 0),
      complete,
    };
  }

  /**
   * As letras das licoes ANTERIORES.
   *
   * Servem de distrator no exercicio: perguntar "qual destas e o som /r/" com
   * cinco letras que o aluno nunca viu nao testa nada -- ele elimina por
   * exclusao. Com as letras ja vistas junto, a resposta exige mesmo saber.
   */
  private previousLetters(lesson: AlphabetLesson): CyrillicLetter[] {
    const upToHere = lettersUpTo(lesson.id);
    return upToHere.slice(0, upToHere.length - lesson.letters.length);
  }

  /**
   * O idioma ainda precisa aprender a ler antes de estudar frase?
   *
   * O planejador da sessao chama isto todo dia, por idioma: enquanto for
   * verdade, o bloco diario de estrutura daquele idioma vira alfabeto.
   */
  async needsAlphabet(userId: string, languageCode: string): Promise<boolean> {
    const lessons = TRACKS[languageCode];
    if (!lessons?.length) return false;

    const mastery = await this.masteryByLesson(userId, languageCode, lessons);
    return !selectAlphabetLesson(lessons, mastery).complete;
  }

  /**
   * Registra o resultado de uma rodada de leitura.
   *
   * Reusa grammar_progress com o prefixo "alphabet:", pela mesma razao que
   * estrutura usa "structure:": e progresso por topico, e criar uma tabela nova
   * so para trocar o nome da chave nao ajudaria ninguem.
   */
  async record(
    userId: string,
    lessonId: string,
    languageCode: string,
    correct: number,
    total: number,
  ) {
    const lesson = findAlphabetLesson(lessonId);
    if (!lesson) throw new NotFoundException(`Licao de alfabeto "${lessonId}" nao existe.`);
    if (total <= 0) throw new NotFoundException('Rodada sem exercicios.');

    const score = Math.round((correct / total) * 100);
    const key = {
      userId_topicId_languageCode: {
        userId,
        topicId: alphabetTopicId(lessonId),
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
        topicId: alphabetTopicId(lessonId),
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

  private track(languageCode: string): AlphabetLesson[] {
    const lessons = TRACKS[languageCode];
    if (!lessons?.length) {
      throw new NotFoundException(
        `O idioma "${languageCode}" não tem trilha de alfabeto — ele usa o alfabeto latino, que você já lê.`,
      );
    }
    return lessons;
  }

  private async masteryByLesson(
    userId: string,
    languageCode: string,
    lessons: AlphabetLesson[],
  ): Promise<Record<string, number>> {
    const rows = await this.prisma.grammarProgress.findMany({
      where: {
        userId,
        languageCode,
        topicId: { in: lessons.map((l) => alphabetTopicId(l.id)) },
      },
    });

    return Object.fromEntries(
      lessons.map((l) => [
        l.id,
        rows.find((r) => r.topicId === alphabetTopicId(l.id))?.mastery ?? 0,
      ]),
    );
  }
}
