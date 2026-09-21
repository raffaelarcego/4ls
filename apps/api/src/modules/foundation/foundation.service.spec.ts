import { describe, expect, it } from 'vitest';
import { FOUNDATION_TRACKS } from './foundation.catalog';
import { selectFoundationLesson } from './foundation.service';

const lessons = FOUNDATION_TRACKS.de;
const id = (index: number) => lessons[index].id;

const NOW = new Date('2026-09-21T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

/** Dominio de todas as licoes ate um indice, exclusive. */
function masteredUpTo(count: number, value = 100): Record<string, number> {
  return Object.fromEntries(lessons.slice(0, count).map((l) => [l.id, value]));
}

/** Toda a trilha vencida, estudada ha `days` dias. */
const allMastered = () => masteredUpTo(lessons.length);
const allStudied = (days: number): Record<string, Date> =>
  Object.fromEntries(lessons.map((l) => [l.id, daysAgo(days)]));

describe('aprender: a licao ainda nao vencida', () => {
  it('comeca na primeira quando nao ha nenhum progresso', () => {
    const escolha = selectFoundationLesson(lessons, {}, {}, NOW);

    expect(escolha.lesson.id).toBe(id(0));
    expect(escolha.index).toBe(1);
    expect(escolha.complete).toBe(false);
    expect(escolha.mode).toBe('learn');
    expect(escolha.due).toBe(true);
  });

  it('avanca para a primeira licao ainda nao vencida', () => {
    const escolha = selectFoundationLesson(lessons, masteredUpTo(3), {}, NOW);

    expect(escolha.lesson.id).toBe(id(3));
    expect(escolha.index).toBe(4);
  });

  /**
   * Mesma razao da escada do alfabeto: a licao do verbo no presente monta
   * frases com a negacao da licao 3 e o "hier" da 4. Pular um degrau fraco
   * porque o da frente esta mais atrasado entregaria uma aula com pecas que o
   * aluno nunca viu.
   */
  it('nao pula um degrau fraco por causa de um degrau forte a frente', () => {
    const escolha = selectFoundationLesson(
      lessons,
      { ...masteredUpTo(5), [id(1)]: 40 },
      {},
      NOW,
    );

    expect(escolha.lesson.id).toBe(id(1));
    expect(escolha.mode).toBe('learn');
  });

  /**
   * 75, e nao os 80 do alfabeto: aqui o que se mede e montagem de frase, e a
   * frase reaparece nos blocos seguintes. Segurar o aluno num degrau por causa
   * de uma terminacao custa mais do que deixar a exposicao consertar.
   */
  it('exige 75 para dar a licao por vencida', () => {
    expect(selectFoundationLesson(lessons, { [id(0)]: 74 }, {}, NOW).lesson.id).toBe(id(0));
    expect(selectFoundationLesson(lessons, { [id(0)]: 75 }, {}, NOW).lesson.id).toBe(id(1));
  });

  it('aprender tem prioridade sobre revisar', () => {
    // Uma licao antiga vencendo NAO pode passar na frente de uma nunca feita:
    // a escada quebraria, e o aluno receberia uma revisao de pecas que ele
    // ainda nao tem como usar na licao seguinte.
    const escolha = selectFoundationLesson(
      lessons,
      masteredUpTo(2),
      allStudied(90),
      NOW,
    );

    expect(escolha.mode).toBe('learn');
    expect(escolha.lesson.id).toBe(id(2));
  });
});

describe('revisar: a licao ja vencida que volta', () => {
  it('nao pede bloco nenhum enquanto tudo esta fresco', () => {
    // A trilha fechada e recente devolve a vaga para a aula de estrutura.
    const escolha = selectFoundationLesson(lessons, allMastered(), allStudied(3), NOW);

    expect(escolha.complete).toBe(true);
    expect(escolha.mode).toBe('review');
    expect(escolha.due).toBe(false);
  });

  it('volta depois de dez dias parada', () => {
    const escolha = selectFoundationLesson(lessons, allMastered(), allStudied(10), NOW);

    expect(escolha.due).toBe(true);
    expect(escolha.mode).toBe('review');
  });

  it('nove dias ainda nao', () => {
    expect(selectFoundationLesson(lessons, allMastered(), allStudied(9), NOW).due).toBe(false);
  });

  /**
   * A mais ANTIGA, nao a de menor nota: nota baixa recem-treinada ainda esta
   * fresca na cabeca, e o que o esquecimento come e o tempo.
   */
  it('escolhe a mais antiga, nao a de nota mais baixa', () => {
    const escolha = selectFoundationLesson(
      lessons,
      { ...allMastered(), [id(4)]: 76 },
      { ...allStudied(2), [id(6)]: daysAgo(40) },
      NOW,
    );

    expect(escolha.lesson.id).toBe(id(6));
  });

  /**
   * Revisao mal feita derruba a nota abaixo de 75, e no dia seguinte a regra
   * de aprender volta a valer sozinha -- o aluno refaz a licao inteira, com
   * pecas e frases. Isso e o efeito desejado: nota que caiu significa que a
   * licao nao estava firme.
   */
  it('uma revisao ruim devolve a licao ao modo de aprender', () => {
    const escolha = selectFoundationLesson(
      lessons,
      { ...allMastered(), [id(2)]: 60 },
      allStudied(0),
      NOW,
    );

    expect(escolha.mode).toBe('learn');
    expect(escolha.lesson.id).toBe(id(2));
  });

  it('a revisao reseta o relogio, entao ela nao se repete no dia seguinte', () => {
    const recemRevisada = { ...allStudied(30), [id(0)]: daysAgo(0) };
    // Com a primeira acabada de revisar, a proxima mais antiga assume -- e ela
    // tambem esta vencida, entao ainda ha bloco hoje.
    const escolha = selectFoundationLesson(lessons, allMastered(), recemRevisada, NOW);

    expect(escolha.lesson.id).not.toBe(id(0));
    expect(escolha.due).toBe(true);

    // Com TODAS frescas, nao ha bloco nenhum.
    const nenhuma = selectFoundationLesson(lessons, allMastered(), allStudied(1), NOW);
    expect(nenhuma.due).toBe(false);
  });
});
