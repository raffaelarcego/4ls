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
  // Produzir a terminacao certa e mais duro que reconhecer a regra, e e o bloco
  // que o aluno mais quer pular -- o XP acompanha o esforco real.
  morphology: 20,
  // Ditado exige ouvir e escrever: pesa mais que escuta pura (10).
  dictation: 15,
  lesson: 15,
  writing: 20,
  speaking: 25,
  // O bloco mais duro do produto: escrever a mesma frase em quatro idiomas,
  // sem nenhuma alternativa na tela. O XP reconhece isso.
  production: 40,
  tutor: 50,
  // A prova mensal. Vale mais que um bloco de treino e menos que o tutor: ela
  // e curta, mas e a unica que cobra material de tres semanas atras sem dica
  // nenhuma -- e o aluno pode sair dela com uma nota ruim, entao o XP precisa
  // compensar ter encarado.
  assessment: 35,
  // O chefe de fase. O maior XP do produto, e ele nao paga o acerto -- paga
  // ter encarado: o exame pode terminar em derrota, e um bloco que so recompensa
  // quem vence ensina a nao tentar.
  promotion: 60,
};

export const SESSION_COMPLETION_XP = 25;

export function xpForActivity(type: string): number {
  return XP_BY_ACTIVITY[type] ?? 10;
}
