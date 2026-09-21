import { describe, expect, it } from 'vitest';
import { MorphologySlot, slotsFor } from './morphology.catalog';
import {
  masteryBySlot,
  MorphologyProgressRow,
  pickSlot,
  rankTerms,
  toMorphologyRows,
} from './morphology.selection';

const NOW = new Date('2026-09-21T00:00:00Z');

function slot(id: string): MorphologySlot {
  return {
    id,
    languageCode: 'ru',
    name: id,
    question: 'quem?',
    triggers: ['x'],
    trap: 'y',
    level: 'A1',
  };
}

function row(
  slotId: string,
  mastery: number,
  daysAgo = 1,
): MorphologyProgressRow {
  const lastStudiedAt = new Date(NOW);
  lastStudiedAt.setDate(lastStudiedAt.getDate() - daysAgo);
  return { slotId, languageCode: 'ru', mastery, attempts: 4, lastStudiedAt };
}

const CASOS = [slot('ru-nom'), slot('ru-pre'), slot('ru-acc')];

describe('escolha do caso do dia', () => {
  /**
   * Mesma regra do bloco de estrutura: o menos dominado VOLTA. Uma terminacao
   * que nao firmou nao atrapalha uma frase -- atrapalha todas as frases que
   * usam aquela funcao.
   */
  it('traz de volta o caso menos dominado', () => {
    const rows = [row('ru-nom', 90), row('ru-pre', 30), row('ru-acc', 70)];
    expect(pickSlot(CASOS, rows)?.id).toBe('ru-pre');
  });

  it('o caso nunca treinado vem antes de qualquer um já visto', () => {
    // Nem o de 10% compete com o que ele nunca produziu.
    const rows = [row('ru-nom', 10), row('ru-pre', 20)];
    expect(pickSlot(CASOS, rows)?.id).toBe('ru-acc');
  });

  it('empate no domínio desempata pelo mais antigo', () => {
    const rows = [row('ru-nom', 50, 2), row('ru-pre', 50, 30), row('ru-acc', 90)];
    expect(pickSlot(CASOS, rows)?.id).toBe('ru-pre');
  });

  it('sem nada estudado, segue a ordem do catálogo', () => {
    expect(pickSlot(CASOS, [])?.id).toBe('ru-nom');
  });

  it('sem candidatos, não devolve caso', () => {
    expect(pickSlot([], [])).toBeUndefined();
  });

  it('o russo A1 escolhe entre os casos do nível, não entre os seis', () => {
    const candidatos = slotsFor('ru', 'A1');
    expect(pickSlot(candidatos, [])?.level).toBe('A1');
  });
});

describe('mapa de domínio', () => {
  it('devolve o domínio por caso, já arredondado', () => {
    expect(masteryBySlot([row('ru-dat', 63.4)])).toEqual({ 'ru-dat': 63 });
  });

  /**
   * `grammar_progress` guarda contraste, can-do, leitura e casos na mesma
   * tabela. Sem filtrar, um topico de outro catalogo entraria como caso.
   */
  it('só considera linhas de morfologia, já sem o prefixo', () => {
    const rows = toMorphologyRows([
      {
        topicId: 'morph:ru-dat',
        languageCode: 'ru',
        mastery: 50,
        attempts: 4,
        lastStudiedAt: NOW,
      },
      {
        topicId: 'cando:ru-dat',
        languageCode: 'ru',
        mastery: 90,
        attempts: 4,
        lastStudiedAt: NOW,
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].slotId).toBe('ru-dat');
  });
});

describe('quais palavras declinar', () => {
  /**
   * A forma nova gruda no que ja esta firme. Declinar a palavra que ele mal
   * conhece ensinaria duas coisas ao mesmo tempo, e a terminacao e a que se
   * perde.
   */
  it('prefere as palavras que ele já tem firmes', () => {
    const termos = [
      { term: 'нога', confidence: 0.2, createdAt: NOW },
      { term: 'работа', confidence: 0.9, createdAt: NOW },
      { term: 'книга', confidence: 0.5, createdAt: NOW },
    ];

    expect(rankTerms(termos, 2).map((t) => t.term)).toEqual(['работа', 'книга']);
  });

  it('respeita o limite pedido', () => {
    const termos = Array.from({ length: 10 }, (_, i) => ({
      term: `t${i}`,
      confidence: 0.5,
      createdAt: NOW,
    }));

    expect(rankTerms(termos, 3)).toHaveLength(3);
  });
});
