import { describe, expect, it } from 'vitest';
import {
  MAX_WORDS,
  normalizeWord,
  scoreAttempt,
  usableSentence,
} from './shadowing.scoring';

describe('frase que serve para repetir', () => {
  it('aceita a frase de tamanho de memória de trabalho', () => {
    expect(usableSentence('Morgen gehe ich ins Kino.')).toBe(true);
  });

  /**
   * Frase longa deixa de treinar ritmo e passa a treinar memoria, que e outro
   * exercicio; frase de duas palavras nao tem ritmo nenhum a treinar.
   */
  it('recusa a frase curta demais', () => {
    expect(usableSentence('Guten Tag.')).toBe(false);
  });

  it('recusa a frase longa demais', () => {
    const longa = Array.from({ length: MAX_WORDS + 1 }, () => 'wort').join(' ');
    expect(usableSentence(longa)).toBe(false);
  });

  it('recusa frase vazia', () => {
    expect(usableSentence('   ')).toBe(false);
  });
});

describe('nota da repetição', () => {
  it('dá 100 à repetição exata', () => {
    const result = scoreAttempt('Morgen gehe ich ins Kino.', 'Morgen gehe ich ins Kino');
    expect(result.score).toBe(100);
    expect(result.words.every((w) => w.ok)).toBe(true);
  });

  /**
   * O reconhecedor devolve sem pontuacao, com a caixa que quiser e as vezes sem
   * acento -- nada disso e erro de fala.
   */
  it('ignora pontuação, caixa e acento', () => {
    const result = scoreAttempt('¿Dónde está la cocina?', 'donde esta la cocina');
    expect(result.score).toBe(100);
  });

  /**
   * O caso que a comparacao posicao a posicao do ditado erra feio: uma palavra
   * engolida no comeco desalinharia TUDO dali para a frente, e uma repeticao
   * quase perfeita viraria 20%.
   */
  it('uma palavra engolida custa uma palavra, não a frase', () => {
    const result = scoreAttempt('Ich gehe heute ins Kino', 'Ich gehe ins Kino');

    expect(result.matched).toBe(4);
    expect(result.total).toBe(5);
    expect(result.score).toBe(80);
    expect(result.words.find((w) => w.expected === 'heute')?.ok).toBe(false);
  });

  it('uma palavra a mais no meio não derruba o resto', () => {
    const result = scoreAttempt('Ich gehe ins Kino', 'Ich gehe dann ins Kino');

    expect(result.score).toBe(100);
    expect(result.extra).toEqual(['dann']);
  });

  /**
   * Palavra sobrando nao desconta: descontaria duas vezes o mesmo tropeco e
   * ainda puniria o aluno pelo ruido do reconhecedor.
   */
  it('palavra sobrando aparece, mas não tira nota', () => {
    const result = scoreAttempt('Ich gehe ins Kino', 'Ich gehe ins Kino ähm ja');

    expect(result.score).toBe(100);
    expect(result.extra).toEqual(['ähm', 'ja']);
  });

  it('marca cada palavra para a tela pintar', () => {
    const result = scoreAttempt('Я иду в кино', 'Я иду кино');

    expect(result.words.map((w) => w.ok)).toEqual([true, true, false, true]);
  });

  it('silêncio dá zero, sem quebrar', () => {
    const result = scoreAttempt('Ich gehe ins Kino', '');

    expect(result.score).toBe(0);
    expect(result.words.every((w) => !w.ok)).toBe(true);
  });

  /**
   * A ordem importa: dizer as palavras certas na ordem errada nao e repetir a
   * frase, e o ritmo -- que e o que o bloco treina -- e justamente a ordem.
   */
  it('não dá nota cheia a palavras fora de ordem', () => {
    const result = scoreAttempt('Ich gehe ins Kino', 'Kino ins gehe Ich');
    expect(result.score).toBeLessThan(100);
  });
});

describe('normalização de palavra', () => {
  it('iguala o que só difere em caixa, acento e pontuação', () => {
    expect(normalizeWord('Küche,')).toBe(normalizeWord('kuche'));
  });

  /** O que NAO se ignora e a letra: e ai que esta o que o exercicio mede. */
  it('mantém palavras diferentes diferentes', () => {
    expect(normalizeWord('kann')).not.toBe(normalizeWord('kennen'));
  });
});
