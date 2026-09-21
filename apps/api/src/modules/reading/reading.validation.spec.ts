import { describe, expect, it } from 'vitest';
import { alignedPassage, ReadingVersion, usableVersion } from './reading.service';

/**
 * O texto entra num pool e e lido QUATRO vezes, uma por idioma, ao longo de
 * semanas. Um defeito que passe daqui nao aparece uma vez: aparece em todas as
 * leituras daquela historia. E o pior deles -- o desalinhamento -- nao tem
 * aparencia de defeito: a tela continua mostrando quatro frases lado a lado,
 * so que elas deixam de dizer a mesma coisa.
 */

const CODES = ['en', 'es', 'de', 'ru'];
const EXPECTED = 6;

function sentences(count: number, prefix = 'frase') {
  return Array.from({ length: count }, (_, i) => ({
    text: `${prefix} ${i + 1}`,
    romanization: null,
    translation: `tradução ${i + 1}`,
  }));
}

function version(overrides: Partial<ReadingVersion> = {}): ReadingVersion {
  return {
    languageCode: 'en',
    title: 'The late morning',
    sentences: sentences(EXPECTED),
    glossary: [{ term: 'rush', meaning: 'correria' }],
    questions: [
      {
        prompt: 'Which bus did she take?',
        options: ['the wrong one', 'the right one', 'none'],
        answer: 'the wrong one',
        explanation: 'Está na frase 4.',
      },
    ],
    ...overrides,
  };
}

function passage(): ReadingVersion[] {
  return CODES.map((languageCode) => version({ languageCode }));
}

describe('versão utilizável', () => {
  it('aceita a versão completa', () => {
    expect(usableVersion(version(), EXPECTED)).toBe(true);
  });

  it('aceita o texto um pouco mais curto que o pedido', () => {
    // O que nao se negocia e o alinhamento, nao o numero exato: recusar um
    // texto de 5 frases quando se pediram 6 jogaria fora a geracao mais cara do
    // modulo por um detalhe que o aluno nunca perceberia.
    expect(usableVersion(version({ sentences: sentences(5) }), EXPECTED)).toBe(true);
  });

  it('recusa o texto que voltou pela metade', () => {
    expect(usableVersion(version({ sentences: sentences(2) }), EXPECTED)).toBe(false);
  });

  it('recusa a frase sem tradução', () => {
    // A traducao e o que ele abre quando trava. Sem ela, o texto acima do nivel
    // vira parede -- que e exatamente o que o andaime veio evitar.
    const torta = version({
      sentences: sentences(EXPECTED).map((s, i) => (i === 2 ? { ...s, translation: ' ' } : s)),
    });

    expect(usableVersion(torta, EXPECTED)).toBe(false);
  });

  it('recusa a versão sem perguntas', () => {
    // Sem pergunta nao ha nota, e o bloco voltaria a ser autoavaliado.
    expect(usableVersion(version({ questions: [] }), EXPECTED)).toBe(false);
  });

  it('recusa a pergunta cuja resposta não está entre as alternativas', () => {
    const torta = version({
      questions: [
        {
          prompt: 'Which bus did she take?',
          options: ['the right one', 'none'],
          answer: 'the wrong one',
          explanation: 'Está na frase 4.',
        },
      ],
    });

    expect(usableVersion(torta, EXPECTED)).toBe(false);
  });
});

describe('texto alinhado nos quatro idiomas', () => {
  it('aceita as quatro versões com o mesmo número de frases', () => {
    expect(alignedPassage(passage(), CODES, EXPECTED)).toBe(true);
  });

  it('recusa o texto que veio em três idiomas', () => {
    const faltando = passage().filter((v) => v.languageCode !== 'ru');
    expect(alignedPassage(faltando, CODES, EXPECTED)).toBe(false);
  });

  /**
   * O defeito que este teste pega e o unico que se disfarca de conteudo bom: o
   * alemao juntou duas frases numa, entao da frase 3 em diante a tela mostra a
   * frase alema errada ao lado da inglesa -- com a mesma aparencia de certo.
   */
  it('recusa a versão que juntou duas frases numa', () => {
    const desalinhado = passage().map((v) =>
      v.languageCode === 'de' ? { ...v, sentences: sentences(EXPECTED - 1) } : v,
    );

    expect(alignedPassage(desalinhado, CODES, EXPECTED)).toBe(false);
  });

  it('recusa o conjunto vazio', () => {
    expect(alignedPassage([], CODES, EXPECTED)).toBe(false);
  });
});
