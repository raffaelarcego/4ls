/** Tabela de XP do produto. XP mede consistencia, nao proficiencia. */
export const XP_BY_ACTIVITY: Record<string, number> = {
  review: 10,
  listening: 10,
  reading: 10,
  vocabulary: 15,
  grammar: 15,
  // Ditado exige ouvir e escrever: pesa mais que escuta pura (10).
  dictation: 15,
  lesson: 15,
  writing: 20,
  speaking: 25,
  tutor: 50,
};

export const SESSION_COMPLETION_XP = 25;

export function xpForActivity(type: string): number {
  return XP_BY_ACTIVITY[type] ?? 10;
}
