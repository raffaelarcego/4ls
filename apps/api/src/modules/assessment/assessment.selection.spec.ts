import { describe, expect, it } from 'vitest';
import {
  assessableCanDos,
  AssessmentItem,
  interleaveByLanguage,
  scoreByLanguage,
  toCanDoProgress,
} from './assessment.selection';

const NOW = new Date('2026-09-21T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

const row = (canDoId: string, languageCode: string, mastery: number, days: number) => ({
  canDoId,
  languageCode,
  mastery,
  lastStudiedAt: daysAgo(days),
});

/** A mesma can-do dominada nos quatro idiomas, parada ha `days` dias. */
const nosQuatro = (canDoId: string, days: number, mastery = 85) =>
  ['en', 'es', 'de', 'ru'].map((code) => row(canDoId, code, mastery, days));

describe('o que a prova pode cobrar', () => {
  it('nao cobra nada quando tudo foi estudado ha pouco', () => {
    expect(assessableCanDos(nosQuatro('a', 5), NOW)).toEqual([]);
  });

  it('cobra o que descansou tres semanas', () => {
    expect(assessableCanDos(nosQuatro('a', 21), NOW)).toEqual(['a']);
    expect(assessableCanDos(nosQuatro('a', 20), NOW)).toEqual([]);
  });

  /**
   * A prova cobra os quatro idiomas na mesma funcao, entao o descanso tem de
   * valer para os quatro. Ter treinado em espanhol ontem desqualifica a
   * can-do inteira, mesmo com o russo dela parado ha meses -- senao a nota do
   * espanhol mediria memoria de curto prazo.
   */
  it('um idioma treinado ontem tira a can-do inteira da prova', () => {
    const rows = [...nosQuatro('a', 90).slice(0, 3), row('a', 'es', 85, 1)];

    expect(assessableCanDos(rows, NOW)).toEqual([]);
  });

  /**
   * Cobrar o que nunca firmou nao mede esquecimento -- mede que ele nunca
   * soube, e isso o proprio mastery ja dizia.
   */
  it('ignora can-do que nunca chegou a ser aprendida', () => {
    expect(assessableCanDos(nosQuatro('a', 60, 40), NOW)).toEqual([]);
  });

  it('basta ter firmado em um idioma para valer a medida', () => {
    const rows = [...nosQuatro('a', 60, 30).slice(0, 3), row('a', 'en', 90, 60)];

    expect(assessableCanDos(rows, NOW)).toEqual(['a']);
  });

  it('a mais antiga primeiro, e respeita o limite', () => {
    const rows = [...nosQuatro('recente', 25), ...nosQuatro('antiga', 200), ...nosQuatro('media', 60)];

    expect(assessableCanDos(rows, NOW, 2)).toEqual(['antiga', 'media']);
  });

  it('descarta topico que nao e can-do', () => {
    const progresso = toCanDoProgress([
      { topicId: 'cando:apresentar-se', languageCode: 'de', mastery: 80, lastStudiedAt: NOW },
      { topicId: 'foundation:de-fund-1', languageCode: 'de', mastery: 80, lastStudiedAt: NOW },
      { topicId: 'alphabet:ru-alfa-1', languageCode: 'ru', mastery: 80, lastStudiedAt: NOW },
    ]);

    expect(progresso).toHaveLength(1);
    expect(progresso[0].canDoId).toBe('apresentar-se');
  });
});

describe('ordem dos itens', () => {
  const item = (languageCode: string, n: number): AssessmentItem => ({
    canDoId: `c${n}`,
    languageCode,
    gloss: `ideia ${n}`,
    sentence: `frase ${languageCode} ${n}`,
    parts: [{ text: 'x', column: 'QUEM' }],
  });

  /**
   * Quatro frases seguidas em russo viram um bloco de russo no meio da prova,
   * e o cansaco daquele trecho entra so na nota do russo. Alternando, ele se
   * espalha igual entre os quatro.
   */
  it('alterna os idiomas em vez de agrupar', () => {
    const entrada = [
      item('en', 1), item('en', 2),
      item('ru', 1), item('ru', 2),
      item('de', 1), item('de', 2),
    ];

    const codes = interleaveByLanguage(entrada).map((i) => i.languageCode);

    expect(codes).toEqual(['en', 'ru', 'de', 'en', 'ru', 'de']);
  });

  it('nao perde nem duplica item quando as filas sao desiguais', () => {
    const entrada = [item('en', 1), item('en', 2), item('en', 3), item('ru', 1)];
    const saida = interleaveByLanguage(entrada);

    expect(saida).toHaveLength(entrada.length);
    expect(new Set(saida.map((i) => `${i.languageCode}${i.canDoId}`)).size).toBe(entrada.length);
  });

  it('aguenta lista vazia', () => {
    expect(interleaveByLanguage([])).toEqual([]);
  });
});

describe('nota', () => {
  it('e por idioma, e objetiva', () => {
    const notas = scoreByLanguage([
      { languageCode: 'en', correct: true },
      { languageCode: 'en', correct: true },
      { languageCode: 'ru', correct: false },
      { languageCode: 'ru', correct: true },
      { languageCode: 'de', correct: false },
    ]);

    expect(notas).toEqual({ en: 100, ru: 50, de: 0 });
  });

  it('nao inventa idioma que nao foi medido', () => {
    expect(scoreByLanguage([{ languageCode: 'en', correct: true }])).toEqual({ en: 100 });
  });
});
