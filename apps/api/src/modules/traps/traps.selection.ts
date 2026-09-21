import { Trap, trapsForLanguage, trapsForPair } from './traps.catalog';

/**
 * Como a rodada de armadilhas e montada, isolado do banco.
 *
 * A regra que manda: os erros DELE vem primeiro. Um par minimo escrito com a
 * frase que ele de fato escreveu vale mais que qualquer armadilha de catalogo,
 * por dois motivos que nao se compensam com conteudo melhor -- ela ja provou
 * que o pega, e ela esta na memoria dele. O catalogo entra depois, para
 * completar a rodada e para cobrir os pares que ele ainda nao teve chance de
 * errar.
 */

export interface TrapItem {
  /** `<uuid>` quando vem de um erro dele; o id do catalogo quando nao. */
  id: string;
  languageCode: string;
  sourceCode: string;
  /** A ideia em portugues. O erro proprio nem sempre tem uma. */
  gloss?: string;
  right: string;
  wrong: string;
  why: string;
  /** Veio de um erro que ele cometeu de verdade. */
  own: boolean;
}

/** Uma linha de `errors` que pode virar par minimo. */
export interface ErrorRow {
  id: string;
  languageCode: string;
  sourceCode: string | null;
  description: string;
  explanation: string | null;
  userText: string | null;
  correctedText: string | null;
  occurrenceCount: number;
}

/**
 * Quantos itens a rodada tem. Curta de proposito: o bloco e de desambiguacao,
 * nao de aula -- vinte pares seguidos viram teste de paciencia, e o efeito que
 * se quer (a forma certa vir primeiro a cabeca) vem da repeticao entre os dias,
 * nao dentro da mesma tela.
 */
export const ROUND_SIZE = 8;

/**
 * Um erro so vira par minimo se tiver as DUAS frases.
 *
 * Sem `userText` nao ha o que oferecer como alternativa errada, e inventar uma
 * a partir da descricao seria escrever a armadilha no lugar dele -- justamente o
 * que da a este item o valor que ele tem. Sem `correctedText` nao ha gabarito.
 * As duas iguais significam que a correcao nao mudou nada, e ai nao ha escolha
 * a fazer.
 */
export function fromError(row: ErrorRow): TrapItem | null {
  const right = row.correctedText?.trim();
  const wrong = row.userText?.trim();

  if (!right || !wrong) return null;
  if (right === wrong) return null;

  return {
    id: row.id,
    languageCode: row.languageCode,
    // Erro sem origem identificada ainda vale como armadilha: o par minimo e
    // dele, e a origem so muda o texto da explicacao.
    sourceCode: row.sourceCode ?? 'pt',
    right,
    wrong,
    why: row.explanation?.trim() || row.description,
    own: true,
  };
}

export function fromTrap(trap: Trap): TrapItem {
  return {
    id: trap.id,
    languageCode: trap.languageCode,
    sourceCode: trap.sourceCode,
    gloss: trap.gloss,
    right: trap.right,
    wrong: trap.wrong,
    why: trap.why,
    own: false,
  };
}

/**
 * A rodada de hoje.
 *
 * Tres camadas, nesta ordem:
 *
 * 1. OS ERROS DELE, do mais recorrente ao menos. Sao os que ja provaram que
 *    pegam.
 * 2. O CATALOGO DOS PARES QUE APARECEM nos erros dele. Se o espanhol esta
 *    entrando no ingles, as armadilhas es -> en valem mais que as de qualquer
 *    outro par -- mesmo as que ele ainda nao errou.
 * 3. O CATALOGO DO IDIOMA, para completar. Quase sempre sao as do portugues,
 *    que e a origem de longe mais comum.
 *
 * Deduplicado pela frase certa: o mesmo par minimo vindo do erro dele e do
 * catalogo apareceria duas vezes na mesma tela, com a segunda entregando a
 * resposta da primeira.
 */
export function buildRound(input: {
  languageCode: string;
  level: string;
  errors: ErrorRow[];
  /** Origens que os erros dele acusam, da mais frequente a menos. */
  sources: string[];
  limit?: number;
}): TrapItem[] {
  const limit = input.limit ?? ROUND_SIZE;

  const own = input.errors
    .filter((e) => e.languageCode === input.languageCode)
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
    .map(fromError)
    .filter((item): item is TrapItem => item !== null);

  const fromPairs = input.sources.flatMap((source) =>
    trapsForPair(input.languageCode, source, input.level).map(fromTrap),
  );

  const rest = trapsForLanguage(input.languageCode, input.level).map(fromTrap);

  const out: TrapItem[] = [];
  const seen = new Set<string>();

  for (const item of [...own, ...fromPairs, ...rest]) {
    const key = normalize(item.right);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }

  return out;
}

/**
 * As origens que mais atrapalham este idioma, da mais frequente a menos.
 *
 * E o que liga o catalogo ao diagnostico: sem isto, a rodada serviria
 * armadilhas do portugues a quem esta errando por causa do espanhol.
 */
export function sourcesFor(errors: ErrorRow[], languageCode: string): string[] {
  const counts = new Map<string, number>();

  for (const error of errors) {
    if (error.languageCode !== languageCode) continue;
    const source = error.sourceCode ?? 'pt';
    counts.set(source, (counts.get(source) ?? 0) + error.occurrenceCount);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => code);
}

/** Acento, caixa e pontuacao nao distinguem duas frases iguais. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,!?;:"'¿¡]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
