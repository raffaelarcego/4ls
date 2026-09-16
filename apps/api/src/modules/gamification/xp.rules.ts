/** Tabela de XP do produto. XP mede consistencia, nao proficiencia. */
export const XP_BY_ACTIVITY: Record<string, number> = {
  review: 10,
  listening: 10,
  reading: 10,
  vocabulary: 15,
  // Montar frase custa mais esforco que reconhecer palavra, e e o bloco que o
  // aluno tende a pular: o XP acompanha o esforco real.
  structure: 20,
  grammar: 15,
  // Ditado exige ouvir e escrever: pesa mais que escuta pura (10).
  dictation: 15,
  lesson: 15,
  writing: 20,
  speaking: 25,
  // O bloco mais duro do produto: escrever a mesma frase em quatro idiomas,
  // sem nenhuma alternativa na tela. O XP reconhece isso.
  production: 40,
  tutor: 50,
};

export const SESSION_COMPLETION_XP = 25;

export function xpForActivity(type: string): number {
  return XP_BY_ACTIVITY[type] ?? 10;
}
