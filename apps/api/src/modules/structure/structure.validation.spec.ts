import { describe, expect, it } from 'vitest';
import { PatternDrill, PatternExample, usableDrill, usableExample } from './structure.service';

/**
 * Estes filtros existem porque a aula entra num pool e e reusada por meses: um
 * exemplo torto que passe aqui e mostrado muitas vezes. E a tela nao esconde o
 * defeito -- ela exibe justamente o desmonte da frase, peca por peca.
 */

function example(overrides: Partial<PatternExample> = {}): PatternExample {
  return {
    sentence: 'Heute gehe ich ins Kino.',
    translation: 'Hoje eu vou ao cinema.',
    parts: [
      { text: 'Heute', role: 'advérbio de tempo' },
      { text: 'gehe', role: 'verbo conjugado (2ª posição)' },
      { text: 'ich', role: 'sujeito' },
      { text: 'ins Kino', role: 'complemento de lugar' },
    ],
    ...overrides,
  };
}

function drill(overrides: Partial<PatternDrill> = {}): PatternDrill {
  return {
    gloss: 'Amanhã eu vou trabalhar.',
    scrambled: ['arbeite', 'Morgen', 'ich'],
    answer: 'Morgen arbeite ich',
    explanation: 'O verbo defende a segunda posição.',
    ...overrides,
  };
}

describe('usableExample', () => {
  it('aceita o exemplo cujas pecas remontam a frase', () => {
    expect(usableExample(example())).toBe(true);
  });

  it('ignora pontuacao e maiuscula na comparacao', () => {
    // As pecas chegam sem o ponto final da frase montada; cobrar isso
    // descartaria exemplos perfeitamente bons.
    expect(usableExample(example({ sentence: 'heute gehe ich ins Kino' }))).toBe(true);
  });

  it('recusa quando falta uma peca', () => {
    expect(
      usableExample(
        example({
          parts: [
            { text: 'Heute', role: 'tempo' },
            { text: 'gehe', role: 'verbo' },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('recusa quando uma peca nao esta na frase', () => {
    expect(
      usableExample(
        example({
          parts: [
            { text: 'Morgen', role: 'tempo' },
            { text: 'gehe', role: 'verbo' },
            { text: 'ich', role: 'sujeito' },
            { text: 'ins Kino', role: 'lugar' },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('recusa peca sem rotulo -- o rotulo e o que ensina a funcao', () => {
    expect(
      usableExample(
        example({
          parts: [
            { text: 'Heute', role: '' },
            { text: 'gehe ich ins Kino', role: 'resto' },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('recusa exemplo sem traducao', () => {
    expect(usableExample(example({ translation: '' }))).toBe(false);
  });
});

describe('usableDrill', () => {
  it('aceita pecas embaralhadas que dao exatamente a resposta', () => {
    expect(usableDrill(drill())).toBe(true);
  });

  it('aceita qualquer embaralhamento -- a ordem das pecas e o exercicio', () => {
    expect(usableDrill(drill({ scrambled: ['ich', 'arbeite', 'Morgen'] }))).toBe(true);
  });

  it('recusa peca sobrando, que tornaria o exercicio impossivel', () => {
    expect(usableDrill(drill({ scrambled: ['Morgen', 'arbeite', 'ich', 'heute'] }))).toBe(false);
  });

  it('recusa peca faltando, que tornaria o exercicio ambiguo', () => {
    expect(usableDrill(drill({ scrambled: ['Morgen', 'arbeite'] }))).toBe(false);
  });

  it('recusa exercicio sem enunciado -- o aluno nao saberia o que montar', () => {
    expect(usableDrill(drill({ gloss: '' }))).toBe(false);
  });

  it('recusa peca vazia', () => {
    expect(usableDrill(drill({ scrambled: ['Morgen', '', 'arbeite ich'] }))).toBe(false);
  });
});
