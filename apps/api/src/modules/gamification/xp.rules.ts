/** Tabela de XP do produto. XP mede consistencia, nao proficiencia. */
export const XP_BY_ACTIVITY: Record<string, number> = {
  review: 10,
  listening: 10,
  reading: 10,
  vocabulary: 15,
  // Montar frase custa mais esforco que reconhecer palavra, e e o bloco que o
  // aluno tende a pular: o XP acompanha o esforco real.
  structure: 20,
  // Sem ler as letras nada do resto acontece: o bloco vale o mesmo que montar
  // frase, senao o aluno o trataria como aquecimento.
  alphabet: 20,
  // Mesma faixa: montar a primeira frase custa tanto quanto ler a primeira
  // palavra, e e o degrau que decide se o idioma continua ou nao.
  foundation: 20,
  // Ver os quatro idiomas lado a lado e leitura guiada: vale como vocabulario.
  contrast: 15,
  // Produzir a mesma frase nos quatro de memoria e quase a producao quadrupla,
  // so que mais curta -- e continua sendo o bloco que mais custa ao aluno.
  compare: 30,
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
