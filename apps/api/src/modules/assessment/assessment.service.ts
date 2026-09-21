import { Injectable, Logger } from '@nestjs/common';
import { CefrLevel } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { findCanDo } from '../cando/can-do.catalog';
import {
  assessableCanDos,
  AssessmentItem,
  interleaveByLanguage,
  scoreByLanguage,
  toCanDoProgress,
} from './assessment.selection';

/**
 * De quantos em quantos dias a prova volta.
 *
 * Mensal. Ela cobra material com tres semanas de descanso, entao um intervalo
 * curto nao teria o que cobrar -- e, pior, transformaria a prova em mais um
 * bloco de treino, que e exatamente o que ela NAO pode ser.
 */
const INTERVAL_DAYS = 30;

/** Uma frase guardada, ja fatiada nas colunas da can-do. */
interface StoredRealization {
  languageCode: string;
  sentence: string;
  parts?: Array<{ text: string; column: string }>;
}

interface StoredSentence {
  gloss: string;
  realizations: StoredRealization[];
}

/**
 * A avaliacao periodica.
 *
 * O unico bloco do app que MEDE em vez de ensinar, e por isso o unico sem
 * dica, sem regra na tela e sem segunda tentativa. Ele existe porque todo o
 * resto se media por autoavaliacao, e as notas dessa autoavaliacao sao o que
 * decide a sessao do dia seguinte.
 *
 * Nao usa IA, e aqui isso nao e so preferencia de custo: uma nota dada por
 * modelo varia entre execucoes, e uma medida que muda sozinha nao serve para
 * comparar Setembro com Outubro. Ordenar pedacos de frase tem gabarito.
 */
@Injectable()
export class AssessmentService {
  private readonly logger = new Logger(AssessmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Faz um mes ou mais desde a ultima prova? */
  async isDue(userId: string): Promise<boolean> {
    const since = new Date();
    since.setDate(since.getDate() - INTERVAL_DAYS);

    const recent = await this.prisma.assessment.findFirst({
      where: { userId, skill: 'grammar', createdAt: { gte: since } },
      select: { id: true },
    });

    if (recent) return false;

    // Sem material descansado nao ha prova: marcar como devida faria o bloco
    // abrir vazio, e um bloco vazio ensina o aluno a pular o proximo.
    return (await this.buildExam(userId)).items.length > 0;
  }

  /**
   * A prova de hoje.
   *
   * Monta a partir do conteudo JA GERADO das can-dos (`can_do_lessons`), e nao
   * de uma geracao nova: a prova precisa cobrar exatamente as frases que o
   * aluno viu, e gerar de novo produziria frases diferentes para a mesma
   * funcao -- o que mediria improviso, nao retencao.
   */
  async buildExam(userId: string) {
    const enrolled = await this.prisma.userLanguage.findMany({
      where: { userId },
      include: { language: true },
    });
    const codes = new Set(enrolled.map((ul) => ul.language.code));

    const rows = await this.prisma.grammarProgress.findMany({
      where: { userId, topicId: { startsWith: 'cando:' } },
      select: { topicId: true, languageCode: true, mastery: true, lastStudiedAt: true },
    });

    const canDoIds = assessableCanDos(toCanDoProgress(rows), new Date());
    if (canDoIds.length === 0) return { items: [], canDoIds: [] as string[] };

    const lessons = await this.prisma.canDoLesson.findMany({
      where: { canDoId: { in: canDoIds } },
      orderBy: { lastUsedAt: 'desc' },
    });

    const items: AssessmentItem[] = [];

    for (const canDoId of canDoIds) {
      // A mais recentemente usada: e a versao que o aluno de fato viu.
      const lesson = lessons.find((l) => l.canDoId === canDoId);
      if (!lesson) continue;

      const sentences = (lesson.sentences ?? []) as unknown as StoredSentence[];
      const first = sentences[0];
      if (!first) continue;

      for (const realization of first.realizations ?? []) {
        if (!codes.has(realization.languageCode)) continue;
        const parts = realization.parts ?? [];
        // Frase de um pedaco so nao tem ordem a testar, e frase sem pedacos
        // nao tem gabarito -- as duas sairiam como acerto de graca.
        if (parts.length < 2) continue;

        items.push({
          canDoId,
          languageCode: realization.languageCode,
          gloss: first.gloss,
          sentence: realization.sentence,
          parts,
        });
      }
    }

    return { items: interleaveByLanguage(items), canDoIds };
  }

  /**
   * Registra o resultado.
   *
   * Grava uma linha de `assessments` por idioma, e so depois move as notas de
   * competencia. A ordem importa para o historico: a linha e o registro
   * permanente da medida naquele dia, e e dela que sai qualquer grafico de
   * "estou melhorando?" -- a nota de competencia e uma media movel e nao
   * guarda o passado.
   */
  async record(
    userId: string,
    results: Array<{ languageCode: string; correct: boolean }>,
  ) {
    const scores = scoreByLanguage(results);

    const enrolled = await this.prisma.userLanguage.findMany({
      where: { userId },
      include: { language: true },
    });

    for (const [code, score] of Object.entries(scores)) {
      const ul = enrolled.find((e) => e.language.code === code);
      if (!ul) continue;

      await this.prisma.assessment.create({
        data: {
          userId,
          languageId: ul.languageId,
          skill: 'grammar',
          score,
          /*
           * O nivel declarado, e nao um nivel estimado a partir desta nota.
           *
           * A prova mede RETENCAO de um punhado de frases; transformar isso
           * numa estimativa de CEFR seria precisao inventada. O que vale aqui
           * e a serie historica da nota no mesmo nivel.
           */
          estimatedLevel: ul.currentLevel as CefrLevel,
          detail: { items: results.filter((r) => r.languageCode === code).length },
        },
      });

      /*
       * A nota entra na competencia com peso ALTO -- 0.5 contra os 0.2 de um
       * bloco comum. Ela e a unica medida objetiva e com material descansado
       * que o sistema tem; deixa-la pesar igual a uma autoavaliacao de fim de
       * bloco seria construir o contrapeso e nao usa-lo.
       */
      const current = ul.grammar ?? 0;
      const next = current === 0 ? score : current * 0.5 + score * 0.5;
      await this.prisma.userLanguage.update({
        where: { id: ul.id },
        data: { grammar: Math.round(next * 10) / 10 },
      });
    }

    return { scores };
  }

  /** O enunciado da can-do, para a tela dizer o que esta sendo cobrado. */
  questionFor(canDoId: string): string {
    return findCanDo(canDoId)?.question ?? 'Função já estudada';
  }
}
