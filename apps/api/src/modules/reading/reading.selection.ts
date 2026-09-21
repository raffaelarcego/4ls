import { ReadingLevel, ReadingTopic, readingTopicId, readingTopicsUpTo } from './reading.catalog';

/**
 * A escolha do texto de hoje, isolada do banco.
 *
 * Fica aqui, pura, porque e a unica parte do modulo com regra de verdade -- o
 * resto e leitura de pool e upsert de progresso. E a regra aqui nao e a mesma
 * dos outros blocos, de proposito: os outros escolhem o assunto MENOS DOMINADO,
 * este escolhe o texto que o aluno ja leu NOUTRO idioma e ainda nao leu neste.
 *
 * A inversao e o modulo inteiro. Ler a mesma historia quatro vezes, uma por
 * idioma, e o que da o andaime: quando ela chega em russo ele ja sabe o que
 * esta escrito ali, e ler sabendo o conteudo e o que permite ler acima do
 * proprio nivel sem travar. Um texto novo em cada idioma seria quatro leituras
 * isoladas -- exatamente o que o bloco fazia antes e nao ensinava nada sobre as
 * diferencas entre as quatro linguas.
 */

/** Uma linha de `grammar_progress` que interessa a escolha. */
export interface ReadingProgressRow {
  /** Ja sem o prefixo `reading:`. */
  topicId: string;
  languageCode: string;
  mastery: number;
  lastStudiedAt: Date;
}

const LEVEL_ORDER: ReadingLevel[] = ['A1', 'A2', 'B1'];

/**
 * O nivel-teto do texto: o MENOR entre os idiomas matriculados.
 *
 * Mesma razao da can-do: o texto precisa ser a mesma historia nos quatro, e um
 * texto puxado pelo ingles B2 nao tem versao russa de A1 que conte a mesma
 * coisa -- teria de cortar metade dos acontecimentos, e ai deixa de ser o mesmo
 * texto. O que varia por idioma e o TAMANHO DA FRASE, nao a historia; quem
 * cuida disso e a geracao, que recebe o nivel de cada idioma.
 *
 * Niveis acima de B1 sao rebaixados a B1: o catalogo para ali, e um teto fora
 * da escala nao deve zerar a leitura do dia.
 */
export function lowestReadingLevel(levels: string[]): ReadingLevel {
  if (levels.length === 0) return 'A1';

  let ceiling = LEVEL_ORDER.length - 1;

  for (const level of levels) {
    const index = LEVEL_ORDER.indexOf(level as ReadingLevel);
    const normalized = index === -1 ? (level < 'A1' ? 0 : LEVEL_ORDER.length - 1) : index;
    if (normalized < ceiling) ceiling = normalized;
  }

  return LEVEL_ORDER[ceiling];
}

/** Os textos legiveis hoje, dado o idioma mais atrasado do aluno. */
export function readingCandidates(levels: string[]): ReadingTopic[] {
  return readingTopicsUpTo(lowestReadingLevel(levels));
}

/** Em quais idiomas este texto ja foi lido. */
export function readInLanguages(topicId: string, rows: ReadingProgressRow[]): string[] {
  return rows.filter((r) => r.topicId === topicId).map((r) => r.languageCode);
}

/**
 * O texto de hoje neste idioma.
 *
 * A ordem de preferencia, e cada degrau tem uma razao:
 *
 * 1. Nao repetir o texto NESTE idioma. Reler o mesmo texto na mesma lingua e a
 *    unica combinacao que nao ensina nada de novo.
 * 2. Entre os que sobram, o ja lido em MAIS outros idiomas. E o que fecha a
 *    volta: a historia que ele ja viu em tres linguas chega na quarta como
 *    contraste pronto, e nao como texto novo.
 * 3. Empate: o lido mais RECENTEMENTE noutro idioma. O andaime e memoria do
 *    conteudo, e memoria fresca segura mais.
 * 4. Nada lido em lugar nenhum: a ordem do catalogo, que sobe de dificuldade.
 *
 * Com o catalogo esgotado neste idioma, o texto volta -- o mais antigo primeiro.
 * Reler depois de meses e leitura legitima, e um bloco vazio seria pior.
 */
export function pickReadingTopic(
  candidates: ReadingTopic[],
  rows: ReadingProgressRow[],
  languageCode: string,
): ReadingTopic | undefined {
  if (candidates.length === 0) return undefined;

  const order = new Map(candidates.map((topic, index) => [topic.id, index]));
  const here = new Map<string, number>();
  const elsewhereAt = new Map<string, number>();
  const elsewhereCount = new Map<string, number>();

  for (const row of rows) {
    if (row.languageCode === languageCode) {
      here.set(row.topicId, Math.max(here.get(row.topicId) ?? 0, row.lastStudiedAt.getTime()));
      continue;
    }
    elsewhereCount.set(row.topicId, (elsewhereCount.get(row.topicId) ?? 0) + 1);
    elsewhereAt.set(
      row.topicId,
      Math.max(elsewhereAt.get(row.topicId) ?? 0, row.lastStudiedAt.getTime()),
    );
  }

  const fresh = candidates.filter((topic) => !here.has(topic.id));

  // Catalogo esgotado neste idioma: volta o mais antigo, e nao o mais coberto.
  if (fresh.length === 0) {
    return [...candidates].sort((a, b) => (here.get(a.id) ?? 0) - (here.get(b.id) ?? 0))[0];
  }

  return fresh.sort((a, b) => {
    const coverage = (elsewhereCount.get(b.id) ?? 0) - (elsewhereCount.get(a.id) ?? 0);
    if (coverage !== 0) return coverage;

    const recency = (elsewhereAt.get(b.id) ?? 0) - (elsewhereAt.get(a.id) ?? 0);
    if (recency !== 0) return recency;

    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  })[0];
}

/** As linhas de `grammar_progress` dos textos, ja sem o prefixo do topico. */
export function toReadingRows(
  rows: Array<{ topicId: string; languageCode: string; mastery: number; lastStudiedAt: Date }>,
): ReadingProgressRow[] {
  return rows
    .filter((r) => r.topicId.startsWith('reading:'))
    .map((r) => ({
      topicId: r.topicId.slice('reading:'.length),
      languageCode: r.languageCode,
      mastery: r.mastery,
      lastStudiedAt: r.lastStudiedAt,
    }));
}

/** Os topicos de progresso de um conjunto de textos, para consultar de uma vez. */
export function readingTopicIdsFor(candidates: ReadingTopic[]): string[] {
  return candidates.map((topic) => readingTopicId(topic.id));
}
