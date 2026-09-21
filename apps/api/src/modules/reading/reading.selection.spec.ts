import { describe, expect, it } from 'vitest';
import { ReadingTopic } from './reading.catalog';
import {
  lowestReadingLevel,
  pickReadingTopic,
  readInLanguages,
  readingCandidates,
  ReadingProgressRow,
  toReadingRows,
} from './reading.selection';

function topic(id: string, level: ReadingTopic['level'] = 'A1'): ReadingTopic {
  return {
    id,
    title: id,
    premise: 'premissa',
    focus: 'foco',
    genre: 'historia',
    level,
  };
}

function row(
  topicId: string,
  languageCode: string,
  daysAgo = 1,
  mastery = 70,
): ReadingProgressRow {
  const lastStudiedAt = new Date('2026-09-21T00:00:00Z');
  lastStudiedAt.setDate(lastStudiedAt.getDate() - daysAgo);
  return { topicId, languageCode, mastery, lastStudiedAt };
}

const CATALOGO = [topic('primeiro'), topic('segundo'), topic('terceiro')];

describe('nível-teto da leitura', () => {
  it('usa o idioma mais atrasado', () => {
    // O texto e o mesmo nos quatro: puxar pelo ingles B2 deixaria o russo A1
    // sem versao que conte a mesma historia.
    expect(lowestReadingLevel(['B2', 'A2', 'A1', 'A1'])).toBe('A1');
  });

  it('rebaixa nível acima da escala para B1', () => {
    expect(lowestReadingLevel(['C1', 'B2'])).toBe('B1');
  });

  it('sem idioma matriculado, não promete o texto mais difícil', () => {
    expect(lowestReadingLevel([])).toBe('A1');
  });

  it('só oferece textos que cabem no teto', () => {
    const candidatos = readingCandidates(['B2', 'A1']);
    expect(candidatos.every((t) => t.level === 'A1')).toBe(true);
  });
});

describe('escolha do texto do dia', () => {
  /**
   * A regra que define o modulo, e ela e o oposto da dos outros blocos: nao se
   * escolhe o assunto menos dominado, escolhe-se a historia que ele JA LEU
   * noutro idioma. E a segunda leitura que da o andaime e o contraste.
   */
  it('prefere a história já lida em outro idioma', () => {
    const rows = [row('segundo', 'en')];
    expect(pickReadingTopic(CATALOGO, rows, 'de')?.id).toBe('segundo');
  });

  it('prefere a mais coberta quando duas já foram lidas fora', () => {
    const rows = [row('segundo', 'en'), row('terceiro', 'en'), row('terceiro', 'es')];
    expect(pickReadingTopic(CATALOGO, rows, 'de')?.id).toBe('terceiro');
  });

  it('desempata pela leitura mais recente em outro idioma', () => {
    // Memoria fresca do conteudo segura mais: o andaime e justamente lembrar o
    // que esta escrito ali.
    const rows = [row('segundo', 'en', 30), row('terceiro', 'en', 2)];
    expect(pickReadingTopic(CATALOGO, rows, 'de')?.id).toBe('terceiro');
  });

  it('não repete o texto no mesmo idioma', () => {
    // Reler o mesmo texto na mesma lingua e a unica combinacao que nao ensina
    // nada de novo -- mesmo sendo a mais "coberta".
    const rows = [row('segundo', 'en'), row('segundo', 'de')];
    expect(pickReadingTopic(CATALOGO, rows, 'de')?.id).not.toBe('segundo');
  });

  it('sem nada lido, segue a ordem do catálogo', () => {
    expect(pickReadingTopic(CATALOGO, [], 'en')?.id).toBe('primeiro');
  });

  /**
   * Com o catalogo esgotado neste idioma o bloco nao pode ficar vazio: reler
   * depois de meses e leitura legitima. Volta o mais antigo, e nao o mais
   * coberto -- aqui a cobertura ja esta completa em todos.
   */
  it('com o catálogo esgotado no idioma, devolve o mais antigo', () => {
    const rows = [
      row('primeiro', 'de', 90),
      row('segundo', 'de', 10),
      row('terceiro', 'de', 40),
    ];
    expect(pickReadingTopic(CATALOGO, rows, 'de')?.id).toBe('primeiro');
  });

  it('sem candidatos, não devolve texto', () => {
    expect(pickReadingTopic([], [], 'en')).toBeUndefined();
  });
});

describe('leitura pelos outros idiomas', () => {
  it('lista onde a história já foi lida', () => {
    const rows = [row('segundo', 'en'), row('segundo', 'es'), row('terceiro', 'en')];
    expect(readInLanguages('segundo', rows).sort()).toEqual(['en', 'es']);
  });

  /**
   * `grammar_progress` guarda contraste, can-do e leitura na mesma tabela. Ler
   * tudo sem filtrar traria topicos de outro catalogo com ids que parecem
   * textos -- e a escolha do dia passaria a pular textos que ele nunca leu.
   */
  it('só considera linhas de leitura, já sem o prefixo', () => {
    const rows = toReadingRows([
      { topicId: 'reading:segundo', languageCode: 'de', mastery: 50, lastStudiedAt: new Date() },
      { topicId: 'cando:segundo', languageCode: 'de', mastery: 90, lastStudiedAt: new Date() },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].topicId).toBe('segundo');
  });
});
