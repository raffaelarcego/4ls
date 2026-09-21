import { MorphologySlot, morphologyTopicId, slotsFor } from './morphology.catalog';

/**
 * Qual caso treinar hoje, isolado do banco.
 *
 * Mesma regra de escolha do bloco de estrutura, e pela mesma razao: o caso
 * MENOS DOMINADO volta, em vez de rodar a lista em ordem. Uma terminacao que
 * ainda nao firmou nao atrapalha uma frase -- atrapalha todas as frases que
 * usam aquela funcao, para sempre. Rotacao cega deixaria o preposicional em 30%
 * enquanto o instrumental, que ele ja acerta, voltaria na mesma frequencia.
 */

/** Uma linha de `grammar_progress` que interessa a escolha. */
export interface MorphologyProgressRow {
  /** Ja sem o prefixo `morph:`. */
  slotId: string;
  languageCode: string;
  mastery: number;
  attempts: number;
  lastStudiedAt: Date;
}

/**
 * O caso de hoje: o menos dominado entre os que cabem no nivel.
 *
 * Nunca treinado vem antes de qualquer um ja visto -- um caso que ele nunca
 * produziu vale mais que revisitar o que esta em 40%. Empate desfeito pelo mais
 * antigo, para dois casos parados nao se revezarem em ordem aleatoria.
 */
export function pickSlot(
  candidates: MorphologySlot[],
  rows: MorphologyProgressRow[],
): MorphologySlot | undefined {
  if (candidates.length === 0) return undefined;

  const seen = new Map(rows.map((r) => [r.slotId, r]));

  return [...candidates].sort((a, b) => {
    const ra = seen.get(a.id);
    const rb = seen.get(b.id);

    if (!ra && rb) return -1;
    if (ra && !rb) return 1;
    if (!ra && !rb) return 0;

    const ma = Math.round(ra!.mastery);
    const mb = Math.round(rb!.mastery);
    if (ma !== mb) return ma - mb;

    return ra!.lastStudiedAt.getTime() - rb!.lastStudiedAt.getTime();
  })[0];
}

/** Quanto ele domina cada caso do idioma, para a tabela mostrar o mapa. */
export function masteryBySlot(rows: MorphologyProgressRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) out[row.slotId] = Math.round(row.mastery);
  return out;
}

/** As linhas de `grammar_progress` dos casos, ja sem o prefixo do topico. */
export function toMorphologyRows(
  rows: Array<{
    topicId: string;
    languageCode: string;
    mastery: number;
    attempts: number;
    lastStudiedAt: Date;
  }>,
): MorphologyProgressRow[] {
  return rows
    .filter((r) => r.topicId.startsWith('morph:'))
    .map((r) => ({
      slotId: r.topicId.slice('morph:'.length),
      languageCode: r.languageCode,
      mastery: r.mastery,
      attempts: r.attempts,
      lastStudiedAt: r.lastStudiedAt,
    }));
}

/** Os topicos de progresso de um idioma, para consultar de uma vez. */
export function morphologyTopicIdsFor(languageCode: string, level: string): string[] {
  return slotsFor(languageCode, level).map((slot) => morphologyTopicId(slot.id));
}

/**
 * Quais palavras valem virar paradigma, dadas as que ele estuda.
 *
 * A tabela so ensina se a palavra for DELE. Declinar "стол" para quem nunca viu
 * "стол" ensina duas coisas ao mesmo tempo -- a palavra e a terminacao -- e a
 * terminacao e a que se perde. Por isso o paradigma sai do vocabulario que ele
 * ja tem, e os mais firmes vem primeiro: a forma nova gruda no que ja esta la.
 */
export function rankTerms<T extends { term: string; confidence: number; createdAt: Date }>(
  terms: T[],
  limit: number,
): T[] {
  return [...terms]
    .sort((a, b) => {
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      return a.createdAt.getTime() - b.createdAt.getTime();
    })
    .slice(0, limit);
}
