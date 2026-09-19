import { describe, expect, it } from 'vitest';
import {
  CanDoRealization,
  CanDoSentence,
  usableRealization,
  usableSentence,
} from './can-do.service';

/**
 * A aula entra num pool e e reusada por meses: uma frase torta que passe aqui e
 * mostrada muitas vezes. E a tela nao esconde o defeito -- ela exibe as quatro
 * realizacoes alinhadas pelas mesmas colunas, que e a unica coisa que ela faz.
 */

const COLUMNS = ['O QUÊ', 'ESTAR', 'ONDE'];
const CODES = ['en', 'es', 'de', 'ru'];

function realization(overrides: Partial<CanDoRealization> = {}): CanDoRealization {
  return {
    languageCode: 'de',
    sentence: 'Das Buch ist in der Küche.',
    parts: [
      { text: 'Das Buch', column: 'O QUÊ' },
      { text: 'ist', column: 'ESTAR' },
      { text: 'in der Küche', column: 'ONDE' },
    ],
    note: 'Lugar parado pede dativo.',
    ...overrides,
  };
}

function sentence(overrides: Partial<CanDoSentence> = {}): CanDoSentence {
  return {
    gloss: 'O livro está na cozinha.',
    realizations: [
      realization({ languageCode: 'en', sentence: 'The book is in the kitchen.', parts: [
        { text: 'The book', column: 'O QUÊ' },
        { text: 'is', column: 'ESTAR' },
        { text: 'in the kitchen', column: 'ONDE' },
      ] }),
      realization({ languageCode: 'es', sentence: 'El libro está en la cocina.', parts: [
        { text: 'El libro', column: 'O QUÊ' },
        { text: 'está', column: 'ESTAR' },
        { text: 'en la cocina', column: 'ONDE' },
      ] }),
      realization(),
      realization({ languageCode: 'ru', sentence: 'Книга на кухне.', parts: [
        { text: 'Книга', column: 'O QUÊ' },
        { text: 'на кухне', column: 'ONDE' },
      ] }),
    ],
    ...overrides,
  };
}

describe('realizacao utilizavel', () => {
  it('aceita a frase cujas pecas a remontam', () => {
    expect(usableRealization(realization(), COLUMNS)).toBe(true);
  });

  it('aceita coluna com outra caixa ou sem acento', () => {
    // O modelo devolve "o que" onde a can-do escreveu "O QUÊ"; isso e a mesma
    // coluna, e reprovar por acento jogaria fora aula boa.
    const ok = realization({
      parts: [
        { text: 'Das Buch', column: 'o que' },
        { text: 'ist', column: 'estar' },
        { text: 'in der Küche', column: 'Onde' },
      ],
    });

    expect(usableRealization(ok, COLUMNS)).toBe(true);
  });

  it('recusa peca que nao esta na frase', () => {
    const torta = realization({
      parts: [
        { text: 'Das Buch', column: 'O QUÊ' },
        { text: 'liegt', column: 'ESTAR' },
        { text: 'in der Küche', column: 'ONDE' },
      ],
    });

    expect(usableRealization(torta, COLUMNS)).toBe(false);
  });

  it('recusa coluna inventada, que quebra o alinhamento entre os idiomas', () => {
    const torta = realization({
      parts: [
        { text: 'Das Buch', column: 'SUJEITO' },
        { text: 'ist', column: 'ESTAR' },
        { text: 'in der Küche', column: 'ONDE' },
      ],
    });

    expect(usableRealization(torta, COLUMNS)).toBe(false);
  });

  it('aceita a coluna ausente quando o idioma nao tem contraparte', () => {
    // O russo nao tem verbo "ser" no presente: a celula vazia e a licao.
    const russo = realization({
      languageCode: 'ru',
      sentence: 'Книга на кухне.',
      parts: [
        { text: 'Книга', column: 'O QUÊ' },
        { text: 'на кухне', column: 'ONDE' },
      ],
    });

    expect(usableRealization(russo, COLUMNS)).toBe(true);
  });
});

describe('frase-modelo utilizavel', () => {
  it('aceita a frase presente nos quatro idiomas', () => {
    expect(usableSentence(sentence(), COLUMNS, CODES)).toBe(true);
  });

  it('recusa a frase que veio em tres idiomas', () => {
    // Nao e "quase boa": o aluno abre a tela para comparar quatro colunas e
    // encontra tres. E o fracasso exato que este modulo veio resolver.
    const faltando = sentence({
      realizations: sentence().realizations.filter((r) => r.languageCode !== 'ru'),
    });

    expect(usableSentence(faltando, COLUMNS, CODES)).toBe(false);
  });

  it('recusa a frase sem a ideia em portugues', () => {
    expect(usableSentence(sentence({ gloss: '  ' }), COLUMNS, CODES)).toBe(false);
  });

  it('reprova o conjunto quando um so idioma esta torto', () => {
    const comTorto = sentence({
      realizations: sentence().realizations.map((r) =>
        r.languageCode === 'es' ? { ...r, sentence: 'El libro está en el salón.' } : r,
      ),
    });

    expect(usableSentence(comTorto, COLUMNS, CODES)).toBe(false);
  });
});
