import { CanDo, CanDoLevel, canDosUpTo, canDoTopicId } from './can-do.catalog';

/**
 * A escolha da can-do do dia, isolada do banco.
 *
 * Fica aqui, pura, porque e a unica parte do modulo que tem regra de verdade --
 * o resto e leitura de pool e upsert de progresso. Testar isto sem subir Prisma
 * e o que permite descrever em teste as decisoes que o produto promete: que o
 * teto e o idioma mais atrasado e que a can-do so conta como dominada quando
 * esta dominada nos quatro idiomas.
 */

/** Uma linha de `grammar_progress` que interessa a escolha. */
export interface CanDoProgressRow {
  /** Ja sem o prefixo `cando:`. */
  canDoId: string;
  languageCode: string;
  mastery: number;
  lastStudiedAt: Date;
}

const LEVEL_ORDER: CanDoLevel[] = ['A1', 'A2', 'B1'];

/**
 * O nivel-teto do dia: o MENOR entre os idiomas matriculados.
 *
 * Uma can-do so entra se der para ensina-la nos quatro ao mesmo tempo. Puxar
 * pelo ingles B2 daria uma aula que o russo A1 nao consegue acompanhar, e o
 * aluno ficaria com tres realizacoes e um buraco -- que e exatamente o problema
 * que este modulo veio resolver.
 *
 * Niveis acima de B1 sao rebaixados a B1 em vez de ignorados: o catalogo para
 * em B1, e um teto fora da escala nao deve zerar a escolha do dia.
 */
export function lowestCanDoLevel(levels: string[]): CanDoLevel {
  // Sem idioma matriculado nao ha teto a calcular, e prometer B1 daria a aula
  // mais dificil do catalogo a quem nao declarou nada.
  if (levels.length === 0) return 'A1';

  let ceiling = LEVEL_ORDER.length - 1;

  for (const level of levels) {
    const index = LEVEL_ORDER.indexOf(level as CanDoLevel);
    // Nivel desconhecido (A0, C1...) acima da escala vira B1; abaixo dela, A1.
    const normalized = index === -1 ? (level < 'A1' ? 0 : LEVEL_ORDER.length - 1) : index;
    if (normalized < ceiling) ceiling = normalized;
  }

  return LEVEL_ORDER[ceiling];
}

/** As can-dos ensinaveis hoje, dado o idioma mais atrasado do aluno. */
export function canDoCandidates(levels: string[]): CanDo[] {
  return canDosUpTo(lowestCanDoLevel(levels));
}

/**
 * Quanto desta can-do ele domina, de 0 a 100, olhando os quatro idiomas juntos.
 *
 * Divide pelo numero de idiomas MATRICULADOS, e nao pelo numero de linhas de
 * progresso: uma can-do treinada so em ingles e espanhol nao esta meio
 * dominada, esta pela metade. Tratar o idioma sem linha como zero e o que faz a
 * can-do voltar ate fechar nos quatro -- que e a promessa do produto.
 */
export function canDoMastery(
  canDoId: string,
  rows: CanDoProgressRow[],
  languageCount: number,
): number {
  if (languageCount <= 0) return 0;

  const mine = rows.filter((r) => r.canDoId === canDoId);
  if (mine.length === 0) return 0;

  return mine.reduce((sum, r) => sum + r.mastery, 0) / languageCount;
}

/**
 * A can-do de hoje: a menos dominada entre as que cabem no nivel.
 *
 * Nao e rotacao cega, pela mesma razao do bloco de estrutura: se "como digo
 * onde algo esta" ainda nao firmou, ela volta. Nunca estudada vem antes de
 * qualquer uma ja vista -- a funcao que ele nunca praticou vale mais que
 * revisitar a que ja esta em 40%. Empate desfeito pela mais antiga.
 */
export function pickCanDo(
  candidates: CanDo[],
  rows: CanDoProgressRow[],
  languageCount: number,
): CanDo | undefined {
  return rankCanDos(candidates, rows, languageCount)[0];
}

/**
 * A mesma fila de `pickCanDo`, inteira.
 *
 * Existe porque duas coisas precisam da fila, e nao so do primeiro colocado: a
 * sessao, que desce ate achar uma can-do com aula pronta em vez de morrer com
 * 503, e o `warm()`, que prepara as proximas da fila em vez de tres copias da
 * primeira.
 */
export function rankCanDos(
  candidates: CanDo[],
  rows: CanDoProgressRow[],
  languageCount: number,
): CanDo[] {
  if (candidates.length === 0) return [];

  const seen = new Set(rows.map((r) => r.canDoId));
  const lastStudied = new Map<string, number>();
  for (const row of rows) {
    const current = lastStudied.get(row.canDoId) ?? 0;
    lastStudied.set(row.canDoId, Math.max(current, row.lastStudiedAt.getTime()));
  }

  return [...candidates].sort((a, b) => {
    const sa = seen.has(a.id);
    const sb = seen.has(b.id);
    if (!sa && sb) return -1;
    if (sa && !sb) return 1;
    if (!sa && !sb) return 0;

    const ma = Math.round(canDoMastery(a.id, rows, languageCount));
    const mb = Math.round(canDoMastery(b.id, rows, languageCount));
    if (ma !== mb) return ma - mb;

    return (lastStudied.get(a.id) ?? 0) - (lastStudied.get(b.id) ?? 0);
  });
}

/** As linhas de `grammar_progress` das can-dos, ja sem o prefixo do topico. */
export function toProgressRows(
  rows: Array<{ topicId: string; languageCode: string; mastery: number; lastStudiedAt: Date }>,
): CanDoProgressRow[] {
  return rows
    .filter((r) => r.topicId.startsWith('cando:'))
    .map((r) => ({
      canDoId: r.topicId.slice('cando:'.length),
      languageCode: r.languageCode,
      mastery: r.mastery,
      lastStudiedAt: r.lastStudiedAt,
    }));
}

/** Os topicos de progresso de um conjunto de can-dos, para consultar de uma vez. */
export function topicIdsFor(candidates: CanDo[]): string[] {
  return candidates.map((c) => canDoTopicId(c.id));
}
