import { describe, expect, it } from 'vitest';
import { TRAPS, trapsForLanguage, trapsForPair, trapTopicId } from './traps.catalog';
import { buildRound, ErrorRow, fromError, sourcesFor } from './traps.selection';

function error(overrides: Partial<ErrorRow> = {}): ErrorRow {
  return {
    id: 'e1',
    languageCode: 'de',
    sourceCode: 'pt',
    description: 'Verbo fora da segunda posição',
    explanation: 'O verbo alemão ocupa a segunda posição.',
    userText: 'Morgen ich gehe ins Kino.',
    correctedText: 'Morgen gehe ich ins Kino.',
    occurrenceCount: 3,
    ...overrides,
  };
}

describe('catálogo de armadilhas', () => {
  it('não repete id', () => {
    const ids = TRAPS.map((t) => t.id);
    const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(repetidos, `ids repetidos: ${repetidos.join(', ')}`).toEqual([]);
  });

  /**
   * A alternativa errada nao pode ser um distrator inventado: ela e a frase que
   * SAI quando a regra da outra lingua vaza. Se as duas fossem iguais, nao
   * haveria escolha; se a errada nao fosse plausivel, nao haveria armadilha.
   */
  it('a forma errada é diferente da certa em toda armadilha', () => {
    for (const trap of TRAPS) {
      expect(trap.right.trim(), `${trap.id}`).not.toBe(trap.wrong.trim());
      expect(trap.why.trim().length, `${trap.id} sem explicação`).toBeGreaterThan(0);
      expect(trap.languageCode, `${trap.id}: origem igual ao alvo`).not.toBe(trap.sourceCode);
    }
  });

  it('cobre os quatro idiomas estudados', () => {
    for (const code of ['en', 'es', 'de', 'ru']) {
      expect(trapsForLanguage(code, 'B1').length, `${code} sem armadilha`).toBeGreaterThan(0);
    }
  });

  /**
   * A interferencia mais perigosa deste aluno e a do portugues, e a do espanhol
   * logo depois -- lingua proxima e a que vaza.
   */
  it('tem armadilhas do português em todos os idiomas', () => {
    for (const code of ['en', 'es', 'de', 'ru']) {
      expect(trapsForPair(code, 'pt', 'B1').length, `${code} <- pt`).toBeGreaterThan(0);
    }
  });

  it('tem armadilhas entre os idiomas estudados, não só do português', () => {
    const entreEstudados = TRAPS.filter((t) => t.sourceCode !== 'pt');
    expect(entreEstudados.length).toBeGreaterThanOrEqual(4);
  });

  it('filtra por nível acumulando os anteriores', () => {
    const a1 = trapsForLanguage('de', 'A1');
    const a2 = trapsForLanguage('de', 'A2');

    expect(a1.every((t) => t.level === 'A1')).toBe(true);
    expect(a1.every((t) => a2.some((x) => x.id === t.id))).toBe(true);
  });

  it('prefixa o tópico de progresso', () => {
    expect(trapTopicId('es-pt-vergonha')).toBe('trap:es-pt-vergonha');
  });
});

describe('erro do aluno virando par mínimo', () => {
  it('usa a frase dele como alternativa errada', () => {
    const item = fromError(error())!;

    expect(item.own).toBe(true);
    expect(item.right).toBe('Morgen gehe ich ins Kino.');
    expect(item.wrong).toBe('Morgen ich gehe ins Kino.');
  });

  /**
   * Sem `userText` nao ha o que oferecer como alternativa errada, e inventar uma
   * seria escrever a armadilha no lugar dele -- justamente o que da valor a este
   * item.
   */
  it('descarta o erro sem a frase original', () => {
    expect(fromError(error({ userText: null }))).toBeNull();
  });

  it('descarta o erro sem correção', () => {
    expect(fromError(error({ correctedText: null }))).toBeNull();
  });

  it('descarta a correção que não mudou nada', () => {
    expect(fromError(error({ correctedText: 'Morgen ich gehe ins Kino.' }))).toBeNull();
  });

  it('erro sem origem identificada ainda vale, contado como português', () => {
    // O par minimo continua sendo dele; a origem so muda o texto da explicacao.
    expect(fromError(error({ sourceCode: null }))?.sourceCode).toBe('pt');
  });
});

describe('rodada de armadilhas', () => {
  it('põe os erros dele antes do catálogo', () => {
    const round = buildRound({
      languageCode: 'de',
      level: 'A2',
      errors: [error()],
      sources: ['pt'],
    });

    expect(round[0].own).toBe(true);
    expect(round.length).toBeGreaterThan(1);
    expect(round.some((i) => !i.own)).toBe(true);
  });

  it('ordena os erros dele do mais recorrente ao menos', () => {
    const round = buildRound({
      languageCode: 'de',
      level: 'A2',
      errors: [
        error({ id: 'raro', occurrenceCount: 1, userText: 'a', correctedText: 'b' }),
        error({ id: 'comum', occurrenceCount: 9, userText: 'c', correctedText: 'd' }),
      ],
      sources: ['pt'],
    });

    expect(round.slice(0, 2).map((i) => i.id)).toEqual(['comum', 'raro']);
  });

  /**
   * O mesmo par minimo vindo do erro dele e do catalogo apareceria duas vezes
   * na mesma tela -- e a segunda entregaria a resposta da primeira.
   */
  it('não repete a mesma frase certa', () => {
    const round = buildRound({
      languageCode: 'de',
      level: 'A2',
      errors: [error({ correctedText: 'Morgen gehe ich ins Kino.' })],
      sources: ['pt'],
    });

    const certas = round.map((i) => i.right.toLowerCase());
    expect(new Set(certas).size).toBe(certas.length);
  });

  it('prioriza o catálogo do par que os erros dele acusam', () => {
    // Sem isto, a rodada serviria armadilhas do portugues a quem esta errando
    // por causa do ingles.
    const round = buildRound({
      languageCode: 'de',
      level: 'A2',
      errors: [],
      sources: ['en'],
      limit: 1,
    });

    expect(round[0].sourceCode).toBe('en');
  });

  it('só traz itens do idioma pedido', () => {
    const round = buildRound({
      languageCode: 'ru',
      level: 'B1',
      errors: [error()],
      sources: ['pt'],
    });

    expect(round.every((i) => i.languageCode === 'ru')).toBe(true);
  });

  it('respeita o tamanho da rodada', () => {
    const round = buildRound({ languageCode: 'de', level: 'B1', errors: [], sources: [], limit: 3 });
    expect(round).toHaveLength(3);
  });
});

describe('origens da interferência', () => {
  it('ordena da que mais atrapalha para a que menos', () => {
    const origens = sourcesFor(
      [
        error({ id: 'a', sourceCode: 'en', occurrenceCount: 2 }),
        error({ id: 'b', sourceCode: 'pt', occurrenceCount: 7 }),
        error({ id: 'c', sourceCode: 'en', occurrenceCount: 1 }),
      ],
      'de',
    );

    expect(origens).toEqual(['pt', 'en']);
  });

  it('ignora erros de outro idioma', () => {
    expect(sourcesFor([error({ languageCode: 'ru', sourceCode: 'en' })], 'de')).toEqual([]);
  });
});
