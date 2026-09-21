import { describe, expect, it } from 'vitest';
import {
  allSlotsFor,
  hasMorphology,
  MORPHOLOGY_SLOTS,
  morphologyTopicId,
  slotsFor,
} from './morphology.catalog';

describe('catálogo de casos', () => {
  it('não repete id', () => {
    const ids = MORPHOLOGY_SLOTS.map((s) => s.id);
    const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(repetidos, `ids repetidos: ${repetidos.join(', ')}`).toEqual([]);
  });

  /**
   * "Dativo" nao diz nada a quem nao sabe o que e dativo; "a quem?" diz. A tela
   * inteira e construida em cima da pergunta, entao um caso sem ela ficaria
   * mudo justamente para quem mais precisa dele.
   */
  it('descreve cada caso pela pergunta que ele responde', () => {
    for (const slot of MORPHOLOGY_SLOTS) {
      expect(slot.question.trim().endsWith('?'), `${slot.id}: a pergunta não é uma pergunta`).toBe(
        true,
      );
      expect(slot.triggers.length, `${slot.id} sem gatilhos`).toBeGreaterThan(0);
      expect(slot.trap.trim().length, `${slot.id} sem armadilha`).toBeGreaterThan(0);
    }
  });

  it('tem os seis casos do russo e os quatro do alemão', () => {
    expect(allSlotsFor('ru')).toHaveLength(6);
    expect(allSlotsFor('de')).toHaveLength(4);
  });

  /**
   * A bandeira que o motor da sessao consulta. Sem ela o planejador ofereceria
   * "casos do ingles" -- um assunto que nao existe.
   */
  it('só existe onde a língua marca caso', () => {
    expect(hasMorphology('ru')).toBe(true);
    expect(hasMorphology('de')).toBe(true);
    expect(hasMorphology('en')).toBe(false);
    expect(hasMorphology('es')).toBe(false);
  });

  it('filtra por nível acumulando os anteriores', () => {
    const a1 = slotsFor('ru', 'A1');
    const a2 = slotsFor('ru', 'A2');

    expect(a1.every((s) => s.level === 'A1')).toBe(true);
    expect(a2.length).toBeGreaterThan(a1.length);
    expect(a1.every((s) => a2.some((x) => x.id === s.id))).toBe(true);
  });

  /**
   * Parar de servir casos a quem passou de B1 seria o contrario do que o nivel
   * significa -- e B2 e justamente onde o aluno mais usa o genitivo.
   */
  it('acima da escala do catálogo, serve o catálogo inteiro', () => {
    expect(slotsFor('ru', 'B2')).toHaveLength(6);
  });

  it('começa o russo pelos casos que resolvem "onde" e "o quê"', () => {
    // A ordem do catalogo decide o que ele ve primeiro quando nada foi
    // estudado: preposicional e acusativo sao os que destravam a frase basica.
    const a1 = slotsFor('ru', 'A1').map((s) => s.id);
    expect(a1).toContain('ru-pre');
    expect(a1).toContain('ru-acc');
    expect(a1).not.toContain('ru-ins');
  });

  it('prefixa o tópico de progresso', () => {
    expect(morphologyTopicId('ru-dat')).toBe('morph:ru-dat');
  });
});
