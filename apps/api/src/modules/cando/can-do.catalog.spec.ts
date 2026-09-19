import { describe, expect, it } from 'vitest';
import { CAN_DOS, canDosUpTo } from './can-do.catalog';

const IDIOMAS = ['en', 'es', 'de', 'ru'];

describe('catalogo de can-dos', () => {
  /**
   * A promessa do bloco: as QUATRO respostas lado a lado. Uma can-do sem a nota
   * de um idioma produz uma coluna vazia na tela de contraste -- exatamente a
   * coluna que ele mais precisa ver, se for a do alemao ou a do russo.
   */
  it('descreve os quatro idiomas em toda can-do', () => {
    for (const canDo of CAN_DOS) {
      const cobertos = canDo.notes.map((n) => n.languageCode).sort();
      expect(cobertos, `${canDo.id} não cobre os quatro idiomas`).toEqual([...IDIOMAS].sort());
    }
  });

  it('não repete id', () => {
    const ids = CAN_DOS.map((c) => c.id);
    const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(repetidos, `ids repetidos: ${repetidos.join(', ')}`).toEqual([]);
  });

  /**
   * As colunas sao a tabela de montagem, e ela so ensina o contraste se for a
   * MESMA nos quatro idiomas -- e a diferenca de ordem ao preenche-las que
   * mostra a regra. Uma can-do sem colunas nao tem o que comparar.
   */
  it('define as colunas da tabela de montagem', () => {
    for (const canDo of CAN_DOS) {
      expect(canDo.columns.length, `${canDo.id} sem colunas`).toBeGreaterThanOrEqual(2);
      expect(canDo.question.trim().endsWith('?'), `${canDo.id}: a pergunta não é uma pergunta`).toBe(
        true,
      );
      expect(canDo.goal.trim().length, `${canDo.id} sem objetivo`).toBeGreaterThan(0);
    }
  });

  /**
   * O espanhol e o idioma onde o portugues mais vaza (lingua tipologicamente
   * proxima). O catalogo tem de apontar essas armadilhas em vez de escondê-las.
   */
  it('aponta armadilhas de interferência em espanhol', () => {
    const comArmadilhaEs = CAN_DOS.filter((c) =>
      c.notes.some((n) => n.languageCode === 'es' && n.trap),
    );
    expect(comArmadilhaEs.length).toBeGreaterThanOrEqual(3);
  });

  it('filtra por nível acumulando os anteriores', () => {
    const a1 = canDosUpTo('A1');
    const a2 = canDosUpTo('A2');

    expect(a1.every((c) => c.level === 'A1')).toBe(true);
    expect(a2.length).toBeGreaterThan(a1.length);
    // A2 precisa conter tudo que A1 contem: o aluno de A2 nao "pulou" as
    // funcoes basicas, elas continuam valendo.
    expect(a1.every((c) => a2.some((x) => x.id === c.id))).toBe(true);
  });
});
