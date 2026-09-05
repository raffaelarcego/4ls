import { VocabStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { INTERVAL_LADDER, review, ReviewGrade, SrsState } from './srs.engine';

/** Item novo, nunca revisado. */
function fresh(overrides: Partial<SrsState> = {}): SrsState {
  return {
    status: VocabStatus.NEW,
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    correctCount: 0,
    wrongCount: 0,
    confidence: 0,
    ...overrides,
  };
}

/** Aplica uma sequencia de notas, devolvendo o estado final. */
function sequence(grades: ReviewGrade[], from: SrsState = fresh()): SrsState {
  return grades.reduce<SrsState>((state, grade) => review(state, grade), from);
}

const NOW = new Date('2026-01-01T12:00:00.000Z');

describe('escada de intervalos', () => {
  it('sobe 1-3-7-14-30-60 quando o aluno sempre acerta', () => {
    // Com ease 2.5, o fator de escala e 1: o intervalo e a propria escada.
    // Este e o contrato legivel que o produto promete ao usuario.
    const observed: number[] = [];
    let state = fresh();

    for (let i = 0; i < INTERVAL_LADDER.length; i += 1) {
      const result = review(state, 'good', NOW);
      observed.push(result.intervalDays);
      state = result;
    }

    expect(observed).toEqual([1, 3, 7, 14, 30, 60]);
  });

  it('nao passa do ultimo degrau, por mais acertos que venham', () => {
    const state = sequence(Array<ReviewGrade>(12).fill('good'));
    expect(state.intervalDays).toBe(60);
  });

  it('"easy" pula um degrau', () => {
    const good = review(fresh(), 'good', NOW);
    const easy = review(fresh(), 'easy', NOW);

    // "good" entra no degrau 0 (1 dia); "easy" entra no degrau 1 (3 dias),
    // ainda esticado pelo ease maior.
    expect(good.intervalDays).toBe(1);
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
  });
});

describe('erro', () => {
  it('volta ao inicio da escada e reagenda para daqui a pouco', () => {
    const learned = sequence(['good', 'good', 'good']);
    const failed = review(learned, 'again', NOW);

    expect(failed.repetitions).toBe(0);
    expect(failed.intervalDays).toBe(0);
    expect(failed.nextReview.getTime()).toBe(NOW.getTime() + 10 * 60 * 1000);
  });

  it('preserva o historico de acertos ao zerar a escada', () => {
    const learned = sequence(['good', 'good', 'good']);
    const failed = review(learned, 'again', NOW);

    expect(failed.correctCount).toBe(3);
    expect(failed.wrongCount).toBe(1);
  });

  it('derruba o item de volta para LEARNING', () => {
    const learned = sequence(['good', 'good', 'good']);
    expect(learned.status).toBe(VocabStatus.REVIEW);

    const failed = review(learned, 'again', NOW);
    expect(failed.status).toBe(VocabStatus.LEARNING);
  });
});

describe('ease factor', () => {
  it('nao cai abaixo do piso, por mais erros que venham', () => {
    const state = sequence(Array<ReviewGrade>(20).fill('again'));
    expect(state.easeFactor).toBe(1.3);
  });

  it('nao sobe acima do teto, por mais acertos faceis que venham', () => {
    const state = sequence(Array<ReviewGrade>(20).fill('easy'));
    expect(state.easeFactor).toBe(2.8);
  });

  it('encolhe a escada quando o item e dificil', () => {
    // Mesmo degrau, eases diferentes: o item dificil volta antes.
    const base = fresh({ repetitions: 3, easeFactor: 2.5 });
    const facil = review(fresh({ repetitions: 3, easeFactor: 2.8 }), 'good', NOW);
    const dificil = review({ ...base, easeFactor: 1.3 }, 'good', NOW);

    expect(dificil.intervalDays).toBeLessThan(facil.intervalDays);
  });

  it('nunca agenda para menos de um dia depois de um acerto', () => {
    const state = review(fresh({ easeFactor: 1.3 }), 'good', NOW);
    expect(state.intervalDays).toBeGreaterThanOrEqual(1);
  });
});

describe('confianca e status', () => {
  it('e a taxa de acerto sobre o total de tentativas', () => {
    const state = sequence(['good', 'good', 'again', 'good']);
    expect(state.confidence).toBeCloseTo(3 / 4);
  });

  it('so vira MASTERED com intervalo longo e confianca alta', () => {
    const perfeito = sequence(Array<ReviewGrade>(8).fill('good'));
    expect(perfeito.intervalDays).toBe(60);
    expect(perfeito.confidence).toBe(1);
    expect(perfeito.status).toBe(VocabStatus.MASTERED);
  });

  it('nao vira MASTERED se o aluno errou muito no caminho', () => {
    let state = sequence(['again', 'again', 'again']);
    state = sequence(Array<ReviewGrade>(8).fill('good'), state);

    // Duas travas atuam juntas aqui, e vale registrar as duas. Os erros
    // derrubaram o ease para 1.9, o que encolhe a escada inteira: mesmo no
    // ultimo degrau o item volta em ~46 dias, nao 60. E a confianca ficou
    // abaixo de 0.9. Um item com historico ruim nao se forma so por acumular
    // acertos depois -- ele precisa reconquistar o intervalo.
    expect(state.repetitions).toBeGreaterThanOrEqual(6);
    expect(state.intervalDays).toBeGreaterThan(40);
    expect(state.intervalDays).toBeLessThan(60);
    expect(state.confidence).toBeLessThan(0.9);
    expect(state.status).toBe(VocabStatus.REVIEW);
  });
});
