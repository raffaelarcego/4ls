/**
 * O chefe de fase: quando o idioma sobe de nivel, e quem decide isso.
 *
 * Ate aqui o CEFR era meio motor: as subcompetencias eram rastreadas, a nota
 * composta era calculada e `suggestedLevel` dizia "da para subir" -- e mais
 * nada acontecia. O nivel do idioma so mudava se alguem editasse o banco. Como
 * o nivel e o que decide o teto do conteudo (can-do, leitura, estrutura), o
 * aluno ficava preso no A1 do alemao para sempre, por construcao.
 *
 * Duas formas de fechar esse buraco, e a escolha entre elas e o modulo todo:
 *
 * - PROMOVER SOZINHO quando a nota composta passa de 85. E o caminho facil, e
 *   ele promove a partir da propria opiniao do aluno: metade das notas de
 *   competencia vem de autoavaliacao de fim de bloco. Subir de nivel assim
 *   endurece o conteudo com base em "achei que fui bem", e o aluno descobre o
 *   engano tres semanas depois, sem entender o que mudou.
 * - EXIGIR UMA PROVA. A nota composta deixa de promover e passa a fazer outra
 *   coisa: ABRIR o chefe. Quem promove e um exame com gabarito, sem dica e sem
 *   segunda tentativa -- o mesmo principio da prova mensal, so que por idioma e
 *   com consequencia.
 *
 * E o segundo. O chefe tambem e o momento de recompensa que faltava: a
 * progressao do app era XP, que sobe todo dia e nunca marca um degrau. Subir de
 * nivel num idioma e o unico degrau que significa alguma coisa sobre a lingua.
 */

/**
 * A pericia com que a vitoria e a derrota sao guardadas em `assessments`.
 *
 * Sao duas e nao uma porque as duas perguntas que o codigo faz depois sao
 * diferentes: "ele ja venceu algum chefe?" (conquista) e "ele perdeu ha menos
 * de uma semana?" (espera). Com um rotulo so, as duas dependeriam de ler o
 * `detail` em JSON de cada linha -- e a consulta da espera roda a cada abertura
 * do painel, em quatro idiomas.
 */
export const PROMOTION_WON = 'promotion';
export const PROMOTION_LOST = 'promotion-failed';

/** Os niveis, do mais baixo ao mais alto. */
export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export type Cefr = (typeof CEFR_ORDER)[number];

/**
 * Nota composta que abre o chefe.
 *
 * O mesmo numero que `LanguagesService.suggestedLevel` usa para sugerir a
 * subida -- e ele mora aqui para ter um dono so. Quando os dois eram numeros
 * soltos em arquivos diferentes, a tela podia dizer "voce pode subir" com o
 * chefe ainda trancado, que e a forma mais rapida de o aluno achar que o app
 * quebrou.
 */
export const PROMOTION_SCORE = 85;

/** Acerto minimo no exame inteiro para subir de nivel. */
export const PASS_SCORE = 80;

/**
 * Acerto minimo em CADA rodada.
 *
 * Existe para impedir a aprovacao torta: sem ele da para passar com 80% no
 * total acertando tudo de vocabulario e quase nada de montagem de frase -- e
 * subir de nivel justamente em quem so reconhece palavra. As rodadas medem
 * coisas diferentes de proposito, e o nivel novo cobra as tres.
 */
export const MIN_ROUND_SCORE = 60;

/**
 * Quantos dias o chefe fica fechado depois de uma derrota.
 *
 * Sem espera, o exame vira tentativa e erro: repetir ate a sorte dos itens
 * ajudar promove sem aprender nada. Uma semana e o tempo de o plano do dia
 * atacar o que a derrota apontou -- o resultado diz qual rodada afundou, e o
 * motor ja sabe puxar aquela competencia.
 */
export const COOLDOWN_DAYS = 7;

/** Itens por rodada. Quatro dao margem: um erro nao reprova a rodada sozinho. */
export const ITEMS_PER_ROUND = 4;

/**
 * Itens minimos para o exame valer.
 *
 * Um chefe de tres itens seria ganho na sorte. Abaixo disso o idioma ainda nao
 * tem material estudado suficiente, e a tela diz isso em vez de abrir um exame
 * vazio.
 */
export const MIN_ITEMS = 6;

/**
 * Quanto as competencias encolhem ao subir de nivel.
 *
 * Nao e punicao, e mudanca de regua: 85 de gramatica em A1 nao e 85 de
 * gramatica em A2 -- a mesma nota passa a medir um conteudo mais duro. Sem
 * encolher, tres coisas quebram de uma vez: a composta continua acima de 85 e o
 * chefe do nivel seguinte abre no dia seguinte; o motor da sessao acha que o
 * idioma esta forte justo quando ele ficou mais dificil; e a barra de
 * competencia para de se mover, porque ja esta no teto.
 */
export const LEVEL_UP_DAMPING = 0.6;

/** As tres rodadas do chefe, na ordem em que ele as enfrenta. */
export const ROUNDS = ['sentences', 'reading', 'vocabulary'] as const;

export type Round = (typeof ROUNDS)[number];

/** O nome de cada rodada na tela, e o que ela cobra. */
export const ROUND_LABEL: Record<Round, { title: string; blurb: string }> = {
  sentences: {
    title: 'Montar a frase',
    blurb: 'A ordem das peças, sem rótulo e sem dica.',
  },
  reading: {
    title: 'Entender o texto',
    blurb: 'Detalhes das histórias que você leu neste idioma.',
  },
  vocabulary: {
    title: 'Saber a palavra',
    blurb: 'Termos que você deu por aprendidos.',
  },
};

export interface RoundTally {
  round: Round;
  correct: number;
  total: number;
}

/** O nivel seguinte, ou null no topo da escala. */
export function nextLevel(current: string): Cefr | null {
  const index = CEFR_ORDER.indexOf(current as Cefr);
  if (index === -1 || index === CEFR_ORDER.length - 1) return null;
  return CEFR_ORDER[index + 1];
}

/** 0-100 de uma rodada. Rodada sem itens nao tem nota. */
export function roundScore(tally: RoundTally): number | null {
  if (tally.total <= 0) return null;
  return Math.round((tally.correct / tally.total) * 100);
}

/**
 * A nota do exame.
 *
 * Acertos sobre itens, e nao media das rodadas: com a media, uma rodada de dois
 * itens pesaria igual a uma de quatro, e um erro ali derrubaria a nota o dobro
 * do que deveria. O item e a unidade de medida -- ele vale o mesmo venha de
 * onde vier.
 */
export function examScore(tallies: RoundTally[]): number {
  const total = tallies.reduce((sum, t) => sum + t.total, 0);
  if (total <= 0) return 0;
  const correct = tallies.reduce((sum, t) => sum + t.correct, 0);
  return Math.round((correct / total) * 100);
}

/** Subiu de nivel? Nota do exame E nenhuma rodada abaixo do piso. */
export function passed(tallies: RoundTally[]): boolean {
  const played = tallies.filter((t) => t.total > 0);
  if (played.length === 0) return false;
  if (examScore(played) < PASS_SCORE) return false;
  return played.every((t) => (roundScore(t) ?? 0) >= MIN_ROUND_SCORE);
}

/**
 * A rodada que reprovou, quando houve uma.
 *
 * E o dado que faz a derrota valer alguma coisa: em vez de "nao passou", a tela
 * diz o que treinar, e o plano dos proximos dias ja sabe puxar aquela
 * competencia. A mais fraca entre as reprovadas, porque so cabe uma indicacao.
 */
export function weakestRound(tallies: RoundTally[]): Round | null {
  const played = tallies
    .filter((t) => t.total > 0)
    .map((t) => ({ round: t.round, score: roundScore(t) ?? 0 }))
    .sort((a, b) => a.score - b.score);

  const worst = played[0];
  if (!worst) return null;
  return worst.score < PASS_SCORE ? worst.round : null;
}

export type GateState = 'ready' | 'growing' | 'cooldown' | 'unprepared' | 'maxed';

export interface Gate {
  state: GateState;
  /** Em portugues, para a tela. Sempre diz o que falta, nunca so "bloqueado". */
  reason: string;
  /** Para onde ele sobe se vencer. Null no topo da escala. */
  nextLevel: Cefr | null;
  /** Quantos pontos de nota composta ainda faltam. Zero quando ja abriu. */
  missingScore: number;
  /** Quando o chefe reabre, depois de uma derrota. */
  availableAt: Date | null;
}

export interface GateInput {
  currentLevel: string;
  /** A nota composta 0-100 do idioma. */
  composite: number;
  /** Quando ele encarou o chefe deste idioma pela ultima vez e perdeu. */
  lastFailedAt: Date | null;
  /** Quantos itens o exame conseguiria montar hoje. */
  itemCount: number;
  now: Date;
}

/**
 * O chefe esta aberto?
 *
 * A ordem das checagens e a ordem em que elas interessam a quem le a tela:
 * primeiro o que nao tem conserto (topo da escala), depois o que o tempo
 * resolve (espera), depois o que o estudo resolve (nota e material). Trocar a
 * ordem faria a tela dizer "estude mais" para quem so precisa esperar ate
 * sabado.
 */
export function gate(input: GateInput): Gate {
  const next = nextLevel(input.currentLevel);
  const missingScore = Math.max(0, Math.ceil(PROMOTION_SCORE - input.composite));

  if (!next) {
    return {
      state: 'maxed',
      reason: 'Você está no topo da escala neste idioma.',
      nextLevel: null,
      missingScore: 0,
      availableAt: null,
    };
  }

  if (input.lastFailedAt) {
    const reopens = new Date(input.lastFailedAt);
    reopens.setDate(reopens.getDate() + COOLDOWN_DAYS);

    if (reopens > input.now) {
      const days = Math.max(1, Math.ceil((reopens.getTime() - input.now.getTime()) / 86_400_000));
      return {
        state: 'cooldown',
        reason: `O chefe volta em ${days} ${days === 1 ? 'dia' : 'dias'}. Até lá, o plano do dia ataca o que faltou.`,
        nextLevel: next,
        missingScore,
        availableAt: reopens,
      };
    }
  }

  if (input.composite < PROMOTION_SCORE) {
    return {
      state: 'growing',
      reason: `Faltam ${missingScore} pontos de desempenho neste idioma para o chefe aparecer.`,
      nextLevel: next,
      missingScore,
      availableAt: null,
    };
  }

  if (input.itemCount < MIN_ITEMS) {
    return {
      state: 'unprepared',
      reason:
        'Seu desempenho já dá, mas ainda não há material estudado suficiente para montar um exame honesto.',
      nextLevel: next,
      missingScore: 0,
      availableAt: null,
    };
  }

  return {
    state: 'ready',
    reason: `Você está pronto para tentar o ${next}.`,
    nextLevel: next,
    missingScore: 0,
    availableAt: null,
  };
}

/** As competencias depois da subida, na regua do nivel novo. */
export function dampenSkills<T extends Record<string, number>>(skills: T): T {
  const next = {} as Record<string, number>;
  for (const [skill, value] of Object.entries(skills)) {
    next[skill] = Math.round(value * LEVEL_UP_DAMPING * 10) / 10;
  }
  return next as T;
}
