import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { findTrap, trapTopicId } from './traps.catalog';
import { buildRound, ErrorRow, ROUND_SIZE, sourcesFor, TrapItem } from './traps.selection';

/** Peso do resultado novo na media movel. Igual aos outros blocos. */
const MASTERY_WEIGHT = 0.3;

/**
 * Dominio a partir do qual a armadilha para de pegar -- e o erro dele fecha.
 *
 * Dois acertos nao bastam, e por isso o limiar anda junto com `MIN_ATTEMPTS`:
 * reconhecer a forma certa entre duas na tela e bem mais facil que produzi-la
 * falando, entao fechar o erro no primeiro acerto declararia resolvido o que so
 * foi reconhecido uma vez.
 */
const RESOLVE_MASTERY = 80;
const MIN_ATTEMPTS = 3;

/**
 * Armadilhas cruzadas: escolher a forma certa com a errada do lado.
 *
 * O Error Intelligence ja sabia qual idioma contamina qual, e o painel de
 * interferencia ja dizia o que estudar. So que ele parava no diagnostico -- e
 * aula sobre interferencia nao desfaz interferencia. O que desfaz e escolher a
 * forma certa muitas vezes, com a importada do lado, ate a primeira que vem a
 * cabeca deixar de ser a errada.
 *
 * A fonte principal nao e conteudo novo: sao os erros DELE. `errors.userText`
 * guarda a frase que ele escreveu e `errors.correctedText` a correcao -- um par
 * minimo perfeito, ja no banco, sem custo de IA nenhum. O catalogo entra para
 * completar a rodada e para cobrir os pares que ele ainda nao teve chance de
 * errar.
 *
 * E este bloco fecha um ciclo que o produto vinha prometendo pela metade: o
 * erro vira exercicio, e acertar o exercicio varias vezes FECHA o erro. Ate
 * aqui, `resolved` so mudava se alguem clicasse.
 */
@Injectable()
export class TrapsService {
  private readonly logger = new Logger(TrapsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * A rodada de hoje num idioma.
   *
   * Nao gera nada e nao chama IA: tudo sai do que ja existe -- os erros dele e
   * o catalogo curado. E o unico bloco de conteudo do app que funciona com a
   * chave de IA em branco.
   */
  async lesson(userId: string, languageCode: string) {
    const userLanguage = await this.prisma.userLanguage.findFirst({
      where: { userId, language: { code: languageCode } },
      include: { language: true },
    });
    if (!userLanguage) {
      throw new NotFoundException(`Voce nao esta estudando o idioma "${languageCode}".`);
    }

    const errors = await this.errorRows(userId, languageCode);
    const items = buildRound({
      languageCode,
      level: userLanguage.currentLevel as string,
      errors,
      sources: sourcesFor(errors, languageCode),
    });

    return {
      languageCode,
      languageName: userLanguage.language.name,
      level: userLanguage.currentLevel as string,
      /** Quantos itens saíram de erros que ele mesmo cometeu. */
      fromOwnErrors: items.filter((i) => i.own).length,
      items: items.map((item) => ({
        id: item.id,
        sourceCode: item.sourceCode,
        gloss: item.gloss ?? null,
        /*
         * As duas alternativas vao embaralhadas daqui, e nao da tela: com ordem
         * fixa, a certa cairia sempre no mesmo lugar e a rodada viraria um
         * exercicio de posicao.
         */
        options: coinFlip() ? [item.right, item.wrong] : [item.wrong, item.right],
        answer: item.right,
        why: item.why,
        own: item.own,
      })),
    };
  }

  /**
   * Registra a rodada, armadilha a armadilha.
   *
   * Duas coisas acontecem aqui, e a segunda e o fecho do ciclo:
   *
   * 1. O dominio da armadilha entra em `grammar_progress`, como todo o resto.
   * 2. Quando a armadilha veio de um erro DELE, o resultado volta para o erro:
   *    acertar varias vezes o resolve, errar conta como mais uma ocorrencia. O
   *    erro deixa de ser um registro morto e passa a ter como fechar.
   */
  async record(
    userId: string,
    languageCode: string,
    results: Array<{ id: string; correct: boolean }>,
  ) {
    if (results.length === 0) throw new NotFoundException('Rodada sem exercicios.');

    let resolved = 0;

    for (const result of results) {
      const mastery = await this.touchProgress(userId, languageCode, result);

      // Id que nao esta no catalogo e id de erro dele -- e so esses voltam para
      // o Error Intelligence.
      if (findTrap(result.id)) continue;

      if (!result.correct) {
        await this.prisma.errorRecord
          .updateMany({
            where: { id: result.id, userId, resolved: false },
            data: { occurrenceCount: { increment: 1 }, lastOccurrence: new Date() },
          })
          .catch(() => undefined);
        continue;
      }

      if (mastery.value >= RESOLVE_MASTERY && mastery.attempts >= MIN_ATTEMPTS) {
        const closed = await this.prisma.errorRecord
          .updateMany({
            where: { id: result.id, userId, resolved: false },
            data: { resolved: true },
          })
          .catch(() => ({ count: 0 }));

        if (closed.count > 0) {
          resolved += 1;
          this.logger.log(`Erro ${result.id} fechado pelo bloco de armadilhas.`);
        }
      }
    }

    const correct = results.filter((r) => r.correct).length;

    return {
      score: Math.round((correct / results.length) * 100),
      /** Quantos erros abertos foram fechados por esta rodada. */
      resolved,
    };
  }

  /** Quantos erros de interferencia abertos existem, por idioma. */
  async interferenceCountByLanguage(userId: string): Promise<Record<string, number>> {
    const rows = await this.prisma.errorRecord.findMany({
      where: { userId, resolved: false, sourceLanguageId: { not: null } },
      include: { language: { select: { code: true } } },
    });

    const out: Record<string, number> = {};
    for (const row of rows) {
      out[row.language.code] = (out[row.language.code] ?? 0) + row.occurrenceCount;
    }
    return out;
  }

  private async touchProgress(
    userId: string,
    languageCode: string,
    result: { id: string; correct: boolean },
  ) {
    const score = result.correct ? 100 : 0;
    const key = {
      userId_topicId_languageCode: {
        userId,
        topicId: trapTopicId(result.id),
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
        topicId: trapTopicId(result.id),
        languageCode,
        mastery,
        attempts: 1,
        correct: result.correct ? 1 : 0,
      },
      update: {
        mastery,
        attempts: { increment: 1 },
        correct: { increment: result.correct ? 1 : 0 },
        lastStudiedAt: new Date(),
      },
    });

    return { value: saved.mastery, attempts: saved.attempts };
  }

  /**
   * Os erros abertos que podem virar par minimo.
   *
   * Pede mais do que a rodada usa: boa parte dos erros nao tem as duas frases
   * guardadas -- correcao de tutor curta, erro extraido de fala --, e sem folga
   * a rodada encolheria sem motivo aparente.
   */
  private async errorRows(userId: string, languageCode: string): Promise<ErrorRow[]> {
    const rows = await this.prisma.errorRecord.findMany({
      where: {
        userId,
        resolved: false,
        language: { code: languageCode },
        userText: { not: null },
        correctedText: { not: null },
      },
      include: {
        language: { select: { code: true } },
        sourceLanguage: { select: { code: true } },
      },
      orderBy: [{ occurrenceCount: 'desc' }, { lastOccurrence: 'desc' }],
      take: ROUND_SIZE * 3,
    });

    return rows.map((row) => ({
      id: row.id,
      languageCode: row.language.code,
      sourceCode: row.sourceLanguage?.code ?? null,
      description: row.description,
      explanation: row.explanation,
      userText: row.userText,
      correctedText: row.correctedText,
      occurrenceCount: row.occurrenceCount,
    }));
  }
}

/** Metade das vezes. Existe como funcao so para a intencao ficar legivel. */
function coinFlip(): boolean {
  return Math.random() < 0.5;
}

export type { TrapItem };
