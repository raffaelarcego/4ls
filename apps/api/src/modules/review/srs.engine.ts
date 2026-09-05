import { VocabStatus } from '@prisma/client';

/**
 * Motor de repeticao espacada proprio, derivado do SM-2.
 *
 * Diferenca em relacao ao SM-2 puro: os intervalos sao ancorados na escada
 * definida no produto (0, 1, 3, 7, 14, 30, 60 dias) e o ease factor apenas
 * estica ou encolhe essa escada. Isso mantem os intervalos previsiveis e
 * legiveis para o usuario, sem abrir mao da adaptacao por item.
 */

/** Qualidade da resposta do usuario numa revisao. */
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export const INTERVAL_LADDER = [1, 3, 7, 14, 30, 60] as const;

export interface SrsState {
  status: VocabStatus;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  correctCount: number;
  wrongCount: number;
  confidence: number;
}

export interface SrsResult extends SrsState {
  nextReview: Date;
  lastReview: Date;
}

const EASE_DELTA: Record<ReviewGrade, number> = {
  again: -0.2,
  hard: -0.15,
  good: 0,
  easy: 0.15,
};

const MIN_EASE = 1.3;
const MAX_EASE = 2.8;

export function review(state: SrsState, grade: ReviewGrade, now = new Date()): SrsResult {
  const correct = grade !== 'again';

  const easeFactor = clamp(state.easeFactor + EASE_DELTA[grade], MIN_EASE, MAX_EASE);
  const correctCount = state.correctCount + (correct ? 1 : 0);
  const wrongCount = state.wrongCount + (correct ? 0 : 1);

  // Errar joga o item de volta para o comeco da escada, mas preserva o historico.
  const repetitions = correct ? state.repetitions + 1 : 0;

  let intervalDays: number;
  if (!correct) {
    intervalDays = 0; // revisar ainda hoje
  } else {
    // Avanca um degrau (dois, se foi "easy") e escala pelo ease factor.
    const step = Math.min(
      state.repetitions + (grade === 'easy' ? 1 : 0),
      INTERVAL_LADDER.length - 1,
    );
    const base = INTERVAL_LADDER[step];
    intervalDays = Math.max(1, Math.round(base * (easeFactor / 2.5)));
  }

  const nextReview = new Date(now);
  if (intervalDays === 0) {
    nextReview.setMinutes(nextReview.getMinutes() + 10);
  } else {
    nextReview.setDate(nextReview.getDate() + intervalDays);
  }

  const total = correctCount + wrongCount;
  const confidence = total === 0 ? 0 : clamp(correctCount / total, 0, 1);

  return {
    status: nextStatus(repetitions, intervalDays, confidence),
    easeFactor,
    intervalDays,
    repetitions,
    correctCount,
    wrongCount,
    confidence,
    nextReview,
    lastReview: now,
  };
}

function nextStatus(repetitions: number, intervalDays: number, confidence: number): VocabStatus {
  if (repetitions === 0) return VocabStatus.LEARNING;
  if (intervalDays >= 60 && confidence >= 0.9) return VocabStatus.MASTERED;
  if (repetitions >= 3) return VocabStatus.REVIEW;
  return VocabStatus.LEARNING;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
