/**
 * A escolha do que a avaliacao periodica vai cobrar.
 *
 * O app inteiro se media por autoavaliacao. O bloco de comparacao pergunta
 * "voce saberia dizer isto?" e aceita a resposta do aluno; escuta, escrita,
 * fala e tutor terminam num botao de Dificil/Ok/Tranquilo; e o que e medido de
 * verdade -- os drills -- cobra NA MESMA SESSAO que acabou de ensinar.
 *
 * O problema disso nao e filosofico. As notas de competencia sao exatamente o
 * que decide o dia seguinte: o ranqueamento pontua `100 - competencia`. Um laco
 * que se alimenta da propria opiniao vai longe sem ninguem perceber -- foi
 * assim que o aluno passou meses sem aprender alemao e russo e so descobriu
 * quando ficou insuportavel.
 *
 * Esta avaliacao e o contrapeso, e ela tem tres regras que a diferenciam de
 * qualquer outro bloco:
 *
 * 1. SO MATERIAL ANTIGO. Uma can-do estudada esta semana nao mede retencao,
 *    mede memoria de curto prazo -- que e justamente o que o resto ja mede.
 * 2. SO CORRECAO OBJETIVA. Nada de autoavaliacao e nada de IA. O exercicio e
 *    ordenar os pedacos da frase, que ou esta na ordem certa ou nao esta. E
 *    tambem nao e arbitrario: montar frase e o que o produto ensina.
 * 3. NAO ENSINA. Nao ha dica, nao ha regra na tela, nao ha segunda tentativa.
 *    Medir e ensinar na mesma tela contamina a medida.
 */

/** Uma linha de progresso de can-do, ja sem o prefixo `cando:`. */
export interface CanDoProgress {
  canDoId: string;
  languageCode: string;
  mastery: number;
  lastStudiedAt: Date;
}

/**
 * Quanto tempo uma can-do precisa ter descansado para valer como medida.
 *
 * Tres semanas. Abaixo disso a frase ainda esta na memoria de trabalho e o
 * acerto nao prova retencao; muito acima, a avaliacao ficaria rara demais para
 * corrigir o rumo enquanto ainda da tempo.
 */
export const REST_DAYS = 21;

/**
 * Nota minima para a can-do entrar na prova.
 *
 * Cobrar o que o aluno nunca chegou a dominar nao mede esquecimento -- mede
 * que ele nunca soube, o que o proprio mastery ja dizia. A prova existe para
 * responder outra pergunta: o que ele deu por aprendido continua la?
 */
export const LEARNED_MASTERY = 70;

/** Quantas can-dos a prova cobra. */
export const MAX_CAN_DOS = 2;

/**
 * As can-dos que valem uma medida hoje, da mais antiga para a mais recente.
 *
 * "Mais antiga" e pela data MAIS RECENTE entre os idiomas: se a funcao foi
 * treinada em espanhol ontem, ela nao descansou, mesmo que o russo dela esteja
 * parado ha meses. A prova cobra os quatro idiomas juntos, entao o descanso
 * tambem tem de valer para os quatro.
 */
export function assessableCanDos(
  rows: CanDoProgress[],
  now: Date,
  limit = MAX_CAN_DOS,
): string[] {
  const byCanDo = new Map<string, { newest: number; learnedIn: number }>();

  for (const row of rows) {
    const entry = byCanDo.get(row.canDoId) ?? { newest: 0, learnedIn: 0 };
    entry.newest = Math.max(entry.newest, row.lastStudiedAt.getTime());
    if (row.mastery >= LEARNED_MASTERY) entry.learnedIn += 1;
    byCanDo.set(row.canDoId, entry);
  }

  const cutoff = now.getTime() - REST_DAYS * 86_400_000;

  return [...byCanDo.entries()]
    .filter(([, e]) => e.newest <= cutoff && e.learnedIn > 0)
    .sort((a, b) => a[1].newest - b[1].newest)
    .slice(0, limit)
    .map(([canDoId]) => canDoId);
}

/** As linhas de `grammar_progress` das can-dos, sem o prefixo do topico. */
export function toCanDoProgress(
  rows: Array<{ topicId: string; languageCode: string; mastery: number; lastStudiedAt: Date }>,
): CanDoProgress[] {
  return rows
    .filter((r) => r.topicId.startsWith('cando:'))
    .map((r) => ({
      canDoId: r.topicId.slice('cando:'.length),
      languageCode: r.languageCode,
      mastery: r.mastery,
      lastStudiedAt: r.lastStudiedAt,
    }));
}

/** Um item da prova: uma frase para remontar num idioma. */
export interface AssessmentItem {
  canDoId: string;
  languageCode: string;
  /** O que dizer, em portugues. */
  gloss: string;
  /** A frase certa, para conferir e para revelar depois da resposta. */
  sentence: string;
  /** Os pedacos na ordem CERTA. Quem embaralha e a tela. */
  parts: Array<{ text: string; column: string }>;
}

/**
 * Distribui os itens para que todo idioma seja medido.
 *
 * Intercalar por idioma, e nao agrupar: quatro frases seguidas em russo viram
 * um bloco de russo no meio da prova, e o cansaco daquele trecho entra na nota
 * daquele idioma. Alternando, o cansaco se espalha igual entre os quatro.
 */
export function interleaveByLanguage(items: AssessmentItem[]): AssessmentItem[] {
  const byLanguage = new Map<string, AssessmentItem[]>();
  for (const item of items) {
    const list = byLanguage.get(item.languageCode) ?? [];
    list.push(item);
    byLanguage.set(item.languageCode, list);
  }

  const queues = [...byLanguage.values()];
  const out: AssessmentItem[] = [];
  let index = 0;
  while (out.length < items.length) {
    const queue = queues[index % queues.length];
    const next = queue.shift();
    if (next) out.push(next);
    index += 1;
    // Todas as filas vazias antes de completar significa que sobrou item sem
    // dono -- impossivel pela construcao, mas um laco infinito aqui travaria a
    // sessao do aluno, entao a saida e explicita.
    if (queues.every((q) => q.length === 0)) break;
  }
  return out;
}

/** A nota por idioma, 0-100. Objetiva: cada item acertou ou nao. */
export function scoreByLanguage(
  results: Array<{ languageCode: string; correct: boolean }>,
): Record<string, number> {
  const tally = new Map<string, { correct: number; total: number }>();
  for (const r of results) {
    const t = tally.get(r.languageCode) ?? { correct: 0, total: 0 };
    t.total += 1;
    if (r.correct) t.correct += 1;
    tally.set(r.languageCode, t);
  }

  return Object.fromEntries(
    [...tally.entries()].map(([code, t]) => [code, Math.round((t.correct / t.total) * 100)]),
  );
}
