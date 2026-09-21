/**
 * Como o shadowing e corrigido.
 *
 * O aluno ouve uma frase e a repete em voz alta; o reconhecimento de fala
 * devolve o que ele disse. Comparar as duas e o exercicio inteiro -- e essa
 * comparacao e mais delicada do que parece.
 *
 * COMPARAR POSICAO A POSICAO NAO SERVE, e e o que o ditado faz. La o aluno
 * DIGITA, entao a palavra 3 do que ele escreveu corresponde mesmo a palavra 3
 * do gabarito. Aqui nao: se ele engolir um artigo, ou se o reconhecedor ouvir
 * uma palavra a mais, tudo dali para a frente desalinha e uma repeticao quase
 * perfeita vira 20%. Isso nao seria so uma nota injusta -- e uma nota que
 * ENSINA ERRADO, porque a tela marcaria em vermelho palavras que ele falou
 * certo.
 *
 * Por isso o alinhamento e por subsequencia comum mais longa: acha o maior
 * conjunto de palavras que aparece nas duas na mesma ordem, e so o que sobra
 * conta como falha. Uma palavra a mais no meio custa uma palavra, nao a frase.
 *
 * Vive no backend, e nao na tela, por um motivo so: e aqui que da para testar.
 * A nota que sai daqui move a competencia de fala do aluno, e uma regra de nota
 * sem teste e uma regra que ninguem conferiu.
 */

export interface WordScore {
  /** A palavra da frase original, como ela se escreve. */
  expected: string;
  /** Ela apareceu no que ele falou, na ordem certa? */
  ok: boolean;
}

export interface AttemptScore {
  /** 0-100: quanto da frase ele de fato repetiu. */
  score: number;
  /** Palavras da frase que sairam, sobre o total. */
  matched: number;
  total: number;
  /**
   * Palavras que o reconhecedor ouviu e que nao estao na frase.
   *
   * Nao descontam nota -- descontar puniria duas vezes o mesmo tropeco e ainda
   * puniria o aluno pelo ruido do reconhecedor. Aparecem na tela porque dizem
   * outra coisa: quando sao muitas, quase sempre e o microfone ou o idioma do
   * reconhecedor, nao a fala dele.
   */
  extra: string[];
  words: WordScore[];
}

/**
 * Quantas palavras uma frase de shadowing pode ter.
 *
 * Shadowing e repetir enquanto a frase ainda esta na memoria de trabalho -- e
 * ela nao segura mais que isso. Frase longa demais deixa de treinar ritmo e
 * passa a treinar memoria, que e outro exercicio; frase de duas palavras nao
 * tem ritmo nenhum a treinar.
 */
export const MIN_WORDS = 3;
export const MAX_WORDS = 14;

/** A frase serve para repetir em voz alta? */
export function usableSentence(text: string | undefined): boolean {
  if (!text?.trim()) return false;
  const words = tokenize(text);
  return words.length >= MIN_WORDS && words.length <= MAX_WORDS;
}

/**
 * Compara o que ele falou com a frase, alinhando por subsequencia comum.
 *
 * O `listens` NAO entra na nota, e essa e uma decisao de produto: descontar por
 * reouvir ensinaria o aluno a nao reouvir, e reouvir e exatamente como se faz
 * shadowing. Ele e devolvido para a tela mostrar, porque dez repeticoes numa
 * frase dizem algo sobre a frase -- nao sobre o aluno.
 */
export function scoreAttempt(target: string, transcript: string): AttemptScore {
  const expected = tokenize(target);
  const heard = tokenize(transcript);

  const expectedKeys = expected.map(normalizeWord);
  const heardKeys = heard.map(normalizeWord);

  const matchedIndexes = longestCommonSubsequence(expectedKeys, heardKeys);
  const matchedExpected = new Set(matchedIndexes.map(([i]) => i));
  const matchedHeard = new Set(matchedIndexes.map(([, j]) => j));

  const words: WordScore[] = expected.map((word, i) => ({
    expected: word,
    ok: matchedExpected.has(i),
  }));

  const extra = heard.filter((_, j) => !matchedHeard.has(j));
  const total = expected.length;
  const matched = matchedExpected.size;

  return {
    score: total === 0 ? 0 : Math.round((matched / total) * 100),
    matched,
    total,
    extra,
    words,
  };
}

/**
 * Os pares (i, j) da maior subsequencia comum.
 *
 * As frases tem no maximo algumas dezenas de palavras, entao a tabela
 * quadratica e irrelevante -- e ela e a unica forma simples de saber QUAIS
 * palavras casaram, que e o que a tela precisa para pintar cada uma.
 */
function longestCommonSubsequence(a: string[], b: string[]): Array<[number, number]> {
  const rows = a.length;
  const cols = b.length;

  const table: number[][] = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i][j] =
        a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;

  while (i < rows && j < cols) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return pairs;
}

export function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * Como duas palavras contam como a mesma.
 *
 * O reconhecedor devolve sem pontuacao, com a caixa que quiser e as vezes sem
 * os acentos -- nada disso e erro de fala, e cobrar qualquer um deles reprovaria
 * repeticoes corretas. O que NAO se ignora e a letra: "kann" e "kann" nao sao
 * "kennen", e e ai que esta o que o exercicio mede.
 */
export function normalizeWord(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,!?;:¿¡"'»«—–-]/g, '')
    .trim();
}
