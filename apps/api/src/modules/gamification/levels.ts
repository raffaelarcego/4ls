/**
 * Nivel do aluno a partir do XP acumulado.
 *
 * O XP ja existia e nao dizia nada: o dashboard recebia `total` e mostrava um
 * numero cru que so crescia. Numero que so cresce nao e progressao -- nao tem
 * degrau, nao tem "falta pouco", nao tem nada para querer alcancar. O nivel e o
 * que transforma o mesmo dado em progresso visivel.
 *
 * A curva e linear no incremento, e nao exponencial:
 *
 *   para sair do nivel L custa 500 + (L-1) * 250
 *
 * Uma sessao inteira rende perto de 250 XP, entao o primeiro nivel cai em dois
 * dias, o decimo em onze. Exponencial daria a sensacao classica de parede --
 * aos poucos cada nivel custaria semanas, e para um app de habito diario isso
 * desliga exatamente quem ja estava constante. Aqui o degrau cresce devagar o
 * bastante para caber numa rotina de uma hora por dia.
 */

/** Quanto custa sair do nivel `level` para o seguinte. */
export function xpToNext(level: number): number {
  return 500 + (Math.max(1, level) - 1) * 250;
}

/**
 * Os titulos, por faixa.
 *
 * Falam de lingua, e nao de espada: o produto e um diario de estudo que virou
 * jogo, nao um RPG com tema de idioma colado por cima. "Mestre das Quatro" so
 * existe la no fim porque e literalmente a promessa do 4L.
 */
const TITLES: Array<{ from: number; title: string }> = [
  { from: 1, title: 'Aprendiz' },
  { from: 3, title: 'Viajante' },
  { from: 6, title: 'Intérprete' },
  { from: 10, title: 'Poliglota' },
  { from: 15, title: 'Erudito' },
  { from: 25, title: 'Mestre das Quatro' },
];

export function titleForLevel(level: number): string {
  let title = TITLES[0].title;
  for (const band of TITLES) {
    if (level >= band.from) title = band.title;
  }
  return title;
}

export interface LevelProgress {
  level: number;
  title: string;
  /** XP ja conquistado DENTRO do nivel atual. */
  xpIntoLevel: number;
  /** XP que este nivel inteiro custa. */
  xpForLevel: number;
  /** Quanto falta para o proximo. Zero nunca acontece: ao zerar, sobe de nivel. */
  xpRemaining: number;
  /** 0-100, para a barra. */
  percent: number;
}

/**
 * Onde o aluno esta, dado o XP total.
 *
 * Itera em vez de resolver a formula fechada: a soma acumulada de uma
 * progressao aritmetica tem inversa com raiz quadrada, e um erro de
 * arredondamento ali colocaria o aluno no nivel errado por 1 XP. Com um nivel
 * custando centenas de XP, o laco roda poucas dezenas de vezes mesmo para uma
 * conta de anos -- nao vale trocar clareza por isso.
 */
export function levelFromXp(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));

  let level = 1;
  let remaining = xp;

  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level);
    level += 1;
  }

  const xpForLevel = xpToNext(level);

  return {
    level,
    title: titleForLevel(level),
    xpIntoLevel: remaining,
    xpForLevel,
    xpRemaining: xpForLevel - remaining,
    /*
     * `floor`, nao `round`: faltando 3 XP para subir, o arredondamento dava
     * 100% e a barra ficava cheia com o nivel ainda no lugar. Barra cheia que
     * nao entrega o nivel e a forma mais rapida de o aluno achar que o app
     * quebrou. Com `floor`, e `xpIntoLevel` sempre menor que `xpForLevel`, ela
     * para em 99 e so zera junto com o nivel novo.
     */
    percent: Math.floor((remaining / xpForLevel) * 100),
  };
}
