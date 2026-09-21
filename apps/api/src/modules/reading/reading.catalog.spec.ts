import { describe, expect, it } from 'vitest';
import {
  READING_TOPICS,
  readingTopicId,
  readingTopicsUpTo,
  sentenceCountFor,
} from './reading.catalog';

describe('catálogo de textos', () => {
  it('não repete id', () => {
    const ids = READING_TOPICS.map((t) => t.id);
    const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(repetidos, `ids repetidos: ${repetidos.join(', ')}`).toEqual([]);
  });

  /**
   * A premissa e a espinha que mantem as quatro versoes sendo a mesma historia.
   * Uma premissa vaga ("alguem vai ao mercado") devolveria quatro textos
   * diferentes sobre mercados, e a comparacao frase a frase morreria -- que e a
   * unica coisa que este modulo faz.
   */
  it('descreve a história inteira em cada premissa', () => {
    for (const topic of READING_TOPICS) {
      expect(topic.premise.trim().length, `${topic.id}: premissa curta demais`).toBeGreaterThan(100);
      expect(topic.focus.trim().length, `${topic.id} sem foco`).toBeGreaterThan(0);
      expect(topic.title.trim().length, `${topic.id} sem título`).toBeGreaterThan(0);
    }
  });

  /**
   * O bloco de leitura entra em qualquer dia, e o teto e o idioma mais atrasado
   * do aluno -- hoje, A1. Um catalogo com poucos textos em A1 faria o mesmo
   * texto voltar no mesmo idioma antes de ter passado pelos outros tres.
   */
  it('tem texto suficiente no nível mais baixo para cobrir os quatro idiomas', () => {
    expect(readingTopicsUpTo('A1').length).toBeGreaterThanOrEqual(4);
  });

  it('filtra por nível acumulando os anteriores', () => {
    const a1 = readingTopicsUpTo('A1');
    const a2 = readingTopicsUpTo('A2');

    expect(a1.every((t) => t.level === 'A1')).toBe(true);
    expect(a2.length).toBeGreaterThan(a1.length);
    expect(a1.every((t) => a2.some((x) => x.id === t.id))).toBe(true);
  });

  /** O texto cresce em frase, nao em quantidade de frases -- mas cresce. */
  it('pede mais frases conforme o nível sobe', () => {
    expect(sentenceCountFor('A1')).toBeLessThan(sentenceCountFor('A2'));
    expect(sentenceCountFor('A2')).toBeLessThan(sentenceCountFor('B1'));
  });

  /**
   * `grammar_progress` e compartilhada pelos catalogos que vivem no codigo. Sem
   * o prefixo, o id de um texto colidiria com o de um contraste e o aluno
   * apareceria dominando um topico que nunca estudou.
   */
  it('prefixa o tópico de progresso', () => {
    expect(readingTopicId('a-manha-atrasada')).toBe('reading:a-manha-atrasada');
  });
});
