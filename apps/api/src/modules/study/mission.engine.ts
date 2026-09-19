import { Pillar } from '@prisma/client';

/**
 * Daily Mission Engine (planejador deterministico).
 *
 * Este planejador nao usa IA de proposito: a plataforma precisa nascer
 * funcional antes de nascer inteligente. A IA entra depois como refinamento
 * opcional (ver StudyService.planWithAi), e se ela falhar o usuario ainda
 * recebe uma sessao coerente.
 *
 * A logica central e simples e auditavel: cada tipo de atividade recebe uma
 * pontuacao de necessidade, e o tempo do idioma e distribuido entre os tipos
 * mais necessarios. Isso e o que permite responder "por que isto hoje?".
 */

export interface LanguageState {
  code: string;
  name: string;
  level: string;
  minutesPerDay: number;
  dueReviews: number;
  /** Subcompetencias 0-100. */
  skills: {
    listening: number;
    reading: number;
    writing: number;
    speaking: number;
    vocabScore: number;
    grammar: number;
  };
  /** Categorias de erro abertas, com contagem de ocorrencias. */
  errorCounts: Record<string, number>;
  /** Tipos usados nas ultimas sessoes, do mais recente ao mais antigo. */
  recentTypes: string[];
  /**
   * O idioma ainda tem alfabeto pendente.
   *
   * Enquanto for verdade, o bloco de estrutura do dia cede o lugar ao alfabeto:
   * ensinar ordem de frase a quem nao decodifica os caracteres faz o aluno
   * decorar o DESENHO da frase, nao le-la.
   */
  needsAlphabet: boolean;
}

export interface PlannedActivity {
  languageCode: string;
  pillar: Pillar;
  type: string;
  plannedMinutes: number;
  reason: string;
}

export interface MissionPlan {
  totalMinutes: number;
  rationale: string;
  activities: PlannedActivity[];
}

const MIN_BLOCK = 3;
const MAX_BLOCK = 10;

/** De qual pilar cada tipo de atividade faz parte. */
const PILLAR_BY_TYPE: Record<string, Pillar> = {
  review: Pillar.LEARN,
  vocabulary: Pillar.LEARN,
  structure: Pillar.LEARN,
  alphabet: Pillar.LEARN,
  // Ver a mesma frase nos quatro idiomas e aula: o aluno recebe o contraste.
  contrast: Pillar.LEARN,
  // Produzir a mesma frase nos quatro de memoria e uso, nao apresentacao.
  compare: Pillar.LIVE,
  // Producao livre e uso real da lingua, nao treino de forma.
  production: Pillar.LIVE,
  grammar: Pillar.LEARN,
  listening: Pillar.LISTEN,
  dictation: Pillar.LISTEN,
  reading: Pillar.LISTEN,
  speaking: Pillar.LIVE,
  writing: Pillar.LIVE,
  tutor: Pillar.LIVE,
  assessment: Pillar.LEVEL_UP,
};

/** Categorias de erro que puxam cada tipo de atividade para cima. */
const ERROR_TO_TYPE: Record<string, string> = {
  VOCABULARY: 'vocabulary',
  FALSE_COGNATE: 'vocabulary',
  GRAMMAR: 'grammar',
  WORD_ORDER: 'grammar',
  ARTICLE: 'grammar',
  TENSE: 'grammar',
  PREPOSITION: 'grammar',
  // Ditado ataca ortografia melhor que escrita livre: ouvir e escrever forca
  // a grafia exata, enquanto num texto proprio o aluno desvia da palavra que
  // nao sabe escrever.
  SPELLING: 'dictation',
  PRONUNCIATION: 'speaking',
  COMPREHENSION: 'listening',
};

/** Subcompetencia que governa a necessidade de cada tipo. */
const SKILL_BY_TYPE: Record<string, keyof LanguageState['skills']> = {
  vocabulary: 'vocabScore',
  // Montar frase e gramatica aplicada: o dominio aparece ali.
  structure: 'grammar',
  // Ligar caractere a som e leitura na sua forma mais basica.
  alphabet: 'reading',
  // Comparar a ordem das pecas entre os quatro idiomas move gramatica.
  contrast: 'grammar',
  // Produzir a mesma frase nos quatro de memoria e escrita, como a producao.
  compare: 'writing',
  grammar: 'grammar',
  listening: 'listening',
  // Ditado depende de escuta, mas concorre em separado -- a penalidade de
  // repeticao e o que faz um alternar com o outro entre as sessoes.
  dictation: 'listening',
  reading: 'reading',
  speaking: 'speaking',
  writing: 'writing',
  tutor: 'speaking',
};

/** Pilar de um tipo de atividade, para quem cria blocos fora do planejador. */
export function pillarForType(type: string): Pillar {
  return PILLAR_BY_TYPE[type] ?? Pillar.LEARN;
}

/**
 * Blocos que todo idioma recebe TODO dia, antes de qualquer ranqueamento.
 *
 * Nao sao os blocos mais "necessarios" pela pontuacao -- sao os dois que
 * sustentam a promessa do produto, e por isso nao competem por vaga:
 *
 * - `structure` porque saber o significado da palavra nao ensina a montar a
 *   frase. Sem ela o aluno junta palavras certas numa ordem que nenhum nativo
 *   usaria, e isso nao melhora sozinho com mais vocabulario.
 * - `vocabulary` porque e o bloco que entrega os conceitos do dia, e os
 *   conceitos do dia sao os MESMOS nos quatro idiomas. Se um idioma ficar sem
 *   ele, aquele idioma perde o conceito e a rede se rompe exatamente onde ela
 *   deveria segurar.
 *
 * A ordem importa: estrutura antes de vocabulario, para o aluno ja receber as
 * palavras novas sabendo onde encaixa-las.
 */
const DAILY_TYPES = ['structure', 'vocabulary'] as const;

/**
 * O bloco obrigatorio que substitui `structure` enquanto o alfabeto do idioma
 * nao esta fechado. Ocupa a MESMA vaga, em vez de somar uma terceira: o tempo
 * do idioma nao cresceu, e a frase pode esperar -- a leitura, nao.
 */
const ALPHABET_TYPE = 'alphabet';

/** Os blocos obrigatorios deste idioma hoje, na ordem. */
export function dailyTypesFor(state: Pick<LanguageState, 'needsAlphabet'>): string[] {
  return DAILY_TYPES.map((type) =>
    type === 'structure' && state.needsAlphabet ? ALPHABET_TYPE : type,
  );
}

/** Tipos que podem ser iniciados avulso, pelo botao de pratica livre. */
export const PRACTICABLE_TYPES = [
  'review',
  'alphabet',
  'structure',
  'vocabulary',
  'production',
  'grammar',
  'listening',
  'dictation',
  'speaking',
  'writing',
  'reading',
  'tutor',
] as const;

/**
 * Minutos do bloco de producao quadrupla.
 *
 * Mais que um bloco comum porque ele e outra coisa: escrever a mesma frase em
 * quatro idiomas, sem alternativa na tela, e o exercicio mais lento e mais
 * caro do produto. Tambem e o unico que mede o que o resto so treina.
 */
const PRODUCTION_MINUTES = 8;

/**
 * Os dois blocos que atravessam os idiomas e emolduram o dia.
 *
 * Eles sao a resposta a exigencia central do aluno: aprender no mesmo dia as
 * MESMAS coisas nos quatro idiomas. O resto da sessao continua organizado por
 * idioma, e e assim que deve ser -- a pesquisa e explicita: bloquear DENTRO de
 * cada lingua, intercalar ENTRE elas, e so tornar o contraste explicito no fim.
 *
 * Dai a moldura, e nesta ordem:
 *
 * - `contrast` ABRE o dia. Os quatro idiomas lado a lado na can-do de hoje. Vem
 *   antes porque e apresentacao guiada, nao teste: intercalar sem apoio no
 *   comeco atrapalha quem ainda esta no inicio, em vez de ajudar.
 * - `compare` FECHA o dia. Ele produz a mesma coisa nos quatro de memoria e so
 *   depois revela. E o contraste explicito no fim, quando ja ha o que comparar.
 *
 * Nenhum dos dois concorre por vaga no ranqueamento: sao a promessa do produto,
 * nao um preenchimento de tempo que sobrou.
 */
const CONTRAST_MINUTES = 5;
const COMPARE_MINUTES = 4;

/** Tipos que atravessam os idiomas e por isso ficam fora do ranqueamento. */
const CROSS_LANGUAGE_TYPES = ['contrast', 'compare'] as const;

export interface PlanOptions {
  /**
   * Inclui o bloco de producao quadrupla nesta sessao.
   *
   * Quem decide e o StudyService, olhando quando foi a ultima: semanal, nao
   * diaria. Diaria cansaria e, pior, mediria memoria de curto prazo -- a
   * producao livre so diz alguma coisa sobre conceitos que ja assentaram.
   */
  includeProduction?: boolean;
}

export function planSession(
  languages: LanguageState[],
  totalMinutes: number,
  options: PlanOptions = {},
): MissionPlan {
  const activities: PlannedActivity[] = [];
  const highlights: string[] = [];

  /*
   * A producao atravessa os idiomas, entao ela sai do total ANTES da divisao
   * por idioma -- nao pertence a nenhum deles. O idioma prioritario entra so
   * como dono nominal do bloco, porque toda atividade precisa de um.
   */
  const production =
    options.includeProduction && languages.length >= 2 && totalMinutes >= PRODUCTION_MINUTES * 2
      ? Math.min(PRODUCTION_MINUTES, Math.floor(totalMinutes * 0.2))
      : 0;

  /*
   * A moldura cross-language sai do total ANTES da divisao por idioma, pela
   * mesma razao da producao: ela nao pertence a nenhum deles.
   *
   * So entra com pelo menos dois idiomas (sem dois nao ha contraste) e com
   * tempo para sobrar pelo menos o dobro dela aos idiomas -- num dia de dez
   * minutos a moldura comeria a sessao e o aluno ficaria comparando frases que
   * nao estudou.
   */
  const frame =
    languages.length >= 2 && totalMinutes - production >= (CONTRAST_MINUTES + COMPARE_MINUTES) * 3
      ? CONTRAST_MINUTES + COMPARE_MINUTES
      : 0;

  const budget = totalMinutes - production - frame;

  if (frame > 0) {
    // Dono nominal: `languageCode` nao aceita nulo, e a convencao ja usada pela
    // producao e apontar o idioma prioritario. O conteudo e dos quatro.
    activities.push({
      languageCode: languages[0].code,
      pillar: PILLAR_BY_TYPE.contrast,
      type: 'contrast',
      plannedMinutes: CONTRAST_MINUTES,
      reason: DAILY_REASON.contrast,
    });
  }

  // O tempo declarado por idioma e normalizado para bater com o total real.
  const declared = languages.reduce((sum, l) => sum + l.minutesPerDay, 0) || 1;
  const scale = budget / declared;

  /*
   * A distribuicao e acumulada, e nao um arredondamento por idioma.
   *
   * Arredondar cada idioma isoladamente erra o total por alguns minutos sempre
   * que a escala nao e redonda -- e com a moldura e a producao saindo do bolo,
   * ela quase nunca e. Distribuir pela diferenca entre acumulados soma
   * exatamente o orcamento, que e o que a sessao promete ao aluno.
   */
  let consumed = 0;
  let allocated = 0;

  for (const language of languages) {
    consumed += language.minutesPerDay;
    const upTo = Math.round(consumed * scale);
    const minutes = upTo - allocated;
    if (minutes < MIN_BLOCK) continue;
    allocated = upTo;

    const { blocks, highlight } = planLanguage(language, minutes);
    activities.push(...blocks);
    if (highlight) highlights.push(highlight);
  }

  if (production > 0) {
    // No fim da sessao de proposito: producao livre exige o aquecimento que os
    // blocos anteriores deram, e falha feio como primeira tarefa do dia.
    activities.push({
      languageCode: languages[0].code,
      pillar: Pillar.LIVE,
      type: 'production',
      plannedMinutes: production,
      reason: 'Dizer a mesma coisa nos quatro idiomas, sem alternativa na tela.',
    });
  }

  if (frame > 0) {
    // Depois de tudo, inclusive da producao: e o fechamento do dia, o momento
    // em que o contraste entre os quatro vira explicito.
    activities.push({
      languageCode: languages[0].code,
      pillar: PILLAR_BY_TYPE.compare,
      type: 'compare',
      plannedMinutes: COMPARE_MINUTES,
      reason: DAILY_REASON.compare,
    });
  }

  const base = highlights.length
    ? `Os mesmos conceitos em todos os idiomas, cada um com a sua regra de frase. Foco extra: ${highlights.join('; ')}.`
    : 'Os mesmos conceitos em todos os idiomas, cada um com a sua regra de frase.';

  return {
    totalMinutes: activities.reduce((sum, a) => sum + a.plannedMinutes, 0),
    rationale: production > 0 ? `${base} Hoje tem producao quadrupla.` : base,
    activities,
  };
}

function planLanguage(
  language: LanguageState,
  minutes: number,
): { blocks: PlannedActivity[]; highlight: string | null } {
  const blocks: PlannedActivity[] = [];
  let remaining = minutes;
  let highlight: string | null = null;

  // Os blocos obrigatorios tem a vaga garantida, entao o resto do plano nao
  // pode gastar o tempo deles. Reservar aqui e o que impede uma revisao enorme
  // de engolir a aula de estrutura do dia.
  const reserved = MIN_BLOCK * DAILY_TYPES.length;

  // 1. Revisao vencida vem primeiro -- e o que trava a progressao.
  if (language.dueReviews > 0 && remaining - reserved >= MIN_BLOCK) {
    // ~30s por item, entre MIN_BLOCK e 40% do tempo do idioma, e nunca
    // avancando sobre o que os blocos obrigatorios ainda vao precisar.
    const reviewMinutes = Math.min(
      clamp(
        Math.ceil(language.dueReviews * 0.5),
        MIN_BLOCK,
        Math.max(MIN_BLOCK, Math.floor(minutes * 0.4)),
      ),
      remaining - reserved,
    );
    blocks.push({
      languageCode: language.code,
      pillar: Pillar.LEARN,
      type: 'review',
      plannedMinutes: reviewMinutes,
      reason: `${language.dueReviews} ${language.dueReviews === 1 ? 'item vencido' : 'itens vencidos'} de revisao.`,
    });
    remaining -= reviewMinutes;
  }

  // 2. Os dois blocos do dia, sem passar pelo ranqueamento.
  const dailyTypes = dailyTypesFor(language);

  dailyTypes.forEach((type, index) => {
    if (remaining < MIN_BLOCK) return;

    // O que os obrigatorios seguintes ainda vao precisar.
    const stillReserved = MIN_BLOCK * (dailyTypes.length - index - 1);
    const blockMinutes = Math.min(
      MAX_BLOCK,
      Math.max(MIN_BLOCK, remaining - stillReserved),
      Math.max(MIN_BLOCK, Math.round(minutes * 0.2)),
    );

    blocks.push({
      languageCode: language.code,
      pillar: PILLAR_BY_TYPE[type] ?? Pillar.LEARN,
      type,
      plannedMinutes: blockMinutes,
      reason: DAILY_REASON[type],
    });
    remaining -= blockMinutes;
  });

  // 3. O tempo restante vai para os tipos com maior necessidade.
  const ranked = rankTypes(language, dailyTypes);

  for (const candidate of ranked) {
    if (remaining < MIN_BLOCK) break;
    const blockMinutes = Math.min(MAX_BLOCK, remaining, Math.max(MIN_BLOCK, Math.round(remaining / 2)));

    blocks.push({
      languageCode: language.code,
      pillar: PILLAR_BY_TYPE[candidate.type] ?? Pillar.LEARN,
      type: candidate.type,
      plannedMinutes: blockMinutes,
      reason: candidate.reason,
    });
    remaining -= blockMinutes;

    if (!highlight) highlight = `${language.name} em ${candidate.type}`;
  }

  // 4. Sobra pequena volta para o primeiro bloco, para fechar o tempo exato.
  if (remaining > 0 && blocks.length > 0) {
    blocks[0].plannedMinutes += remaining;
  }

  return { blocks, highlight };
}

/** Por que cada bloco obrigatorio esta ali -- a sessao sempre se explica. */
const DAILY_REASON: Record<string, string> = {
  contrast:
    'A mesma frase nos quatro idiomas, lado a lado. É aqui que você vê o que muda de um para o outro.',
  compare:
    'Diga a mesma coisa nos quatro, de memória, e só depois confira. O contraste fecha o dia.',
  structure: 'Como este idioma monta a frase. Saber a palavra nao basta para dizer a frase.',
  alphabet: 'Ler as letras deste idioma. Sem isso, a palavra é só desenho.',
  vocabulary: 'Os conceitos de hoje, os mesmos que voce ve nos outros idiomas.',
};

interface RankedType {
  type: string;
  score: number;
  reason: string;
}

/**
 * Pontua cada tipo de atividade. Score maior = mais necessario hoje.
 * Tres forcas: fraqueza da competencia, erros recorrentes e variedade.
 */
function rankTypes(language: LanguageState, dailyTypes: string[]): RankedType[] {
  // Os obrigatorios ja entraram: deixa-los concorrer de novo duplicaria o
  // bloco e ainda tiraria a vaga de uma competencia nao atendida hoje.
  //
  // O alfabeto sai da disputa mesmo quando nao e obrigatorio hoje: ele e uma
  // escada com uma licao por vez, entao um segundo bloco no mesmo dia repetiria
  // a mesma licao -- e, com a trilha fechada, nao ha o que servir.
  //
  // `DAILY_TYPES` entra inteiro junto com os de hoje: em modo alfabeto,
  // `structure` perdeu a vaga obrigatoria e voltaria pela porta do ranqueamento,
  // devolvendo ao aluno exatamente a aula que ele ainda nao consegue ler.
  //
  // `contrast` e `compare` tambem ficam de fora, e por um motivo diferente:
  // eles nao sao blocos DESTE idioma. Ja foram criados uma vez, fora da divisao
  // por idioma, e deixa-los concorrer aqui daria um bloco de comparacao por
  // idioma -- quatro vezes a mesma tela, cada uma dizendo pertencer a uma
  // lingua so, que e o oposto do que eles fazem.
  const excluded = new Set<string>([
    ...DAILY_TYPES,
    ...dailyTypes,
    ALPHABET_TYPE,
    ...CROSS_LANGUAGE_TYPES,
  ]);
  const candidates = Object.keys(SKILL_BY_TYPE).filter((type) => !excluded.has(type));

  const ranked = candidates.map<RankedType>((type) => {
    const skill = SKILL_BY_TYPE[type];
    const skillScore = language.skills[skill] ?? 0;

    // Competencia fraca pesa mais. 0 de nota => 100 de necessidade.
    let score = 100 - skillScore;
    const reasons: string[] = [];

    if (skillScore < 50) {
      reasons.push(`${skill} em ${Math.round(skillScore)}%`);
    }

    // Erros abertos que apontam para este tipo.
    const relatedErrors = Object.entries(language.errorCounts)
      .filter(([category]) => ERROR_TO_TYPE[category] === type)
      .reduce((sum, [, count]) => sum + count, 0);

    if (relatedErrors > 0) {
      score += relatedErrors * 8;
      reasons.push(`${relatedErrors} ${relatedErrors === 1 ? 'erro aberto' : 'erros abertos'} nesta area`);
    }

    // Penaliza o que ele acabou de fazer, para a sessao nao repetir.
    const recentIndex = language.recentTypes.indexOf(type);
    if (recentIndex !== -1) {
      score -= (language.recentTypes.length - recentIndex) * 6;
    }

    return {
      type,
      score,
      reason: reasons.length
        ? `${capitalize(reasons.join(' e '))}.`
        : 'Manutencao equilibrada da competencia.',
    };
  });

  return ranked.sort((a, b) => b.score - a.score);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
