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
  /**
   * O idioma ainda tem fundamentos pendentes.
   *
   * O degrau seguinte ao alfabeto, e por isso um campo separado: saber ler os
   * caracteres nao ensina que peca vai onde. Enquanto for verdade, o bloco de
   * estrutura cede o lugar aos fundamentos -- a aula de estrutura fala de uma
   * regra de frase pressupondo que o aluno ja tem pronome, verbo e ordem, e
   * quem nao tem nenhum dos tres nao a acompanha.
   */
  needsFoundation: boolean;
  /**
   * O idioma marca caso no substantivo (alemao e russo).
   *
   * Sem esta bandeira o ranqueamento ofereceria "casos do ingles" -- um assunto
   * que nao existe -- e ainda gastaria com ele a vaga de um bloco que ensinaria
   * alguma coisa. Ela vem do catalogo de morfologia, nao do progresso do aluno:
   * e um fato sobre a lingua, nao sobre ele.
   */
  hasMorphology: boolean;
  /**
   * Ocorrencias abertas de erro com origem NOUTRO idioma que ele estuda.
   *
   * E o que decide se o bloco de armadilhas concorre hoje. Zero significa que
   * nao ha interferencia diagnosticada -- e um bloco de desambiguacao sem par
   * confuso para desambiguar treinaria uma confusao que ele nao tem.
   */
  interferenceErrors: number;
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
  foundation: Pillar.LEARN,
  // Ver a mesma frase nos quatro idiomas e aula: o aluno recebe o contraste.
  contrast: Pillar.LEARN,
  // Produzir a mesma frase nos quatro de memoria e uso, nao apresentacao.
  compare: Pillar.LIVE,
  // Producao livre e uso real da lingua, nao treino de forma.
  production: Pillar.LIVE,
  grammar: Pillar.LEARN,
  // Produzir a forma certa e treino de gramatica, como estrutura.
  morphology: Pillar.LEARN,
  // Escolher entre a forma certa e a importada e treino, nao apresentacao.
  traps: Pillar.LEARN,
  listening: Pillar.LISTEN,
  dictation: Pillar.LISTEN,
  reading: Pillar.LISTEN,
  speaking: Pillar.LIVE,
  writing: Pillar.LIVE,
  tutor: Pillar.LIVE,
  assessment: Pillar.LEVEL_UP,
  // O chefe de fase e literalmente subir de nivel. Ele nunca e planejado: entra
  // so pela porta da pratica livre, quando o aluno decide encara-lo.
  promotion: Pillar.LEVEL_UP,
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

/**
 * Categorias de erro que puxam um SEGUNDO tipo para cima, alem do principal.
 *
 * Artigo e preposicao continuam apontando para gramatica, e isso nao muda: em
 * ingles e espanhol e ali mesmo que o erro se resolve. Mas em alemao e russo os
 * dois sao quase sempre o mesmo erro -- o caso errado --, e quem erra "mit der
 * Mann" nao precisa de uma aula de gramatica, precisa produzir dativo vinte
 * vezes. Como `morphology` nem concorre nos idiomas sem caso, o reforco so tem
 * efeito onde ele significa alguma coisa.
 */
const SECONDARY_ERROR_TO_TYPE: Record<string, string> = {
  ARTICLE: 'morphology',
  PREPOSITION: 'morphology',
};

/** Subcompetencia que governa a necessidade de cada tipo. */
const SKILL_BY_TYPE: Record<string, keyof LanguageState['skills']> = {
  vocabulary: 'vocabScore',
  // Montar frase e gramatica aplicada: o dominio aparece ali.
  structure: 'grammar',
  // Ligar caractere a som e leitura na sua forma mais basica.
  alphabet: 'reading',
  // Fundamentos e montagem de frase na forma mais basica: gramatica, como
  // estrutura -- e o mesmo campo, para o bloco nao melhorar uma nota que
  // ninguem consulta para decidir o dia seguinte.
  foundation: 'grammar',
  // Comparar a ordem das pecas entre os quatro idiomas move gramatica.
  contrast: 'grammar',
  // Produzir a mesma frase nos quatro de memoria e escrita, como a producao.
  compare: 'writing',
  grammar: 'grammar',
  // A terminacao errada com a ordem certa e erro de gramatica -- e o mesmo
  // campo que o bloco move ao ser concluido.
  morphology: 'grammar',
  // Interferencia se manifesta como erro de gramatica, de artigo e de
  // vocabulario; gramatica e o campo que o motor ja usa para os tres.
  traps: 'grammar',
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
 * Os blocos que podem substituir `structure` enquanto o idioma ainda nao chegou
 * la. Ocupam a MESMA vaga, em vez de somar uma terceira: o tempo do idioma nao
 * cresceu, e a aula de frase pode esperar -- ler e saber montar, nao.
 */
const ALPHABET_TYPE = 'alphabet';
const FOUNDATION_TYPE = 'foundation';

/** Os tipos que substituem `structure`, na ordem em que se sobrepoem. */
const PRE_STRUCTURE_TYPES = [ALPHABET_TYPE, FOUNDATION_TYPE] as const;

/**
 * Qual bloco ocupa a vaga de `structure` neste idioma hoje.
 *
 * A ordem entre os dois nao e negociavel, e e por isso que ela vive aqui em vez
 * de dentro de cada servico: no russo, quem ainda nao decodifica os caracteres
 * nao tem o que fazer numa aula que monta frases em cirilico. Alfabeto primeiro,
 * fundamentos depois, estrutura por ultimo. No alemao o primeiro degrau nao
 * existe (ele ja le alfabeto latino), entao a trilha comeca direto no segundo.
 */
function structureSlotFor(
  state: Pick<LanguageState, 'needsAlphabet' | 'needsFoundation'>,
): string {
  if (state.needsAlphabet) return ALPHABET_TYPE;
  if (state.needsFoundation) return FOUNDATION_TYPE;
  return 'structure';
}

/** Os blocos obrigatorios deste idioma hoje, na ordem. */
export function dailyTypesFor(
  state: Pick<LanguageState, 'needsAlphabet' | 'needsFoundation'>,
): string[] {
  const slot = structureSlotFor(state);
  return DAILY_TYPES.map((type) => (type === 'structure' ? slot : type));
}

/** Tipos que podem ser iniciados avulso, pelo botao de pratica livre. */
export const PRACTICABLE_TYPES = [
  'review',
  'alphabet',
  'foundation',
  'structure',
  'vocabulary',
  'morphology',
  'traps',
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

/**
 * Minutos da avaliacao periodica.
 *
 * Ela ABRE o dia, antes ate do contraste, e isso nao e ordem de conveniencia:
 * a prova cobra material com tres semanas de descanso, e servi-la depois da
 * aula de hoje deixaria o conteudo recem-visto vazar para a medida. Medir
 * primeiro, ensinar depois.
 */
const ASSESSMENT_MINUTES = 6;

/** Tipos que atravessam os idiomas e por isso ficam fora do ranqueamento. */
const CROSS_LANGUAGE_TYPES = ['contrast', 'compare'] as const;

export interface PlanOptions {
  /**
   * Inclui a avaliacao periodica nesta sessao.
   *
   * Quem decide e o StudyService: mensal, e so quando existe material
   * descansado o bastante para cobrar. Prova que abre vazia ensina o aluno a
   * pular a proxima.
   */
  includeAssessment?: boolean;
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
   * A prova sai do total antes de qualquer divisao, como a producao e a
   * moldura: ela nao pertence a idioma nenhum -- cobra os quatro de uma vez.
   */
  const assessment =
    options.includeAssessment && languages.length >= 2 && totalMinutes >= ASSESSMENT_MINUTES * 3
      ? ASSESSMENT_MINUTES
      : 0;

  if (assessment > 0) {
    activities.push({
      languageCode: languages[0].code,
      pillar: PILLAR_BY_TYPE.assessment,
      type: 'assessment',
      plannedMinutes: assessment,
      reason: DAILY_REASON.assessment,
    });
  }

  /*
   * A producao atravessa os idiomas, entao ela sai do total ANTES da divisao
   * por idioma -- nao pertence a nenhum deles. O idioma prioritario entra so
   * como dono nominal do bloco, porque toda atividade precisa de um.
   */
  const production =
    options.includeProduction &&
    languages.length >= 2 &&
    totalMinutes - assessment >= PRODUCTION_MINUTES * 2
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
    languages.length >= 2 &&
    totalMinutes - production - assessment >= (CONTRAST_MINUTES + COMPARE_MINUTES) * 3
      ? CONTRAST_MINUTES + COMPARE_MINUTES
      : 0;

  const budget = totalMinutes - production - frame - assessment;

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

  /*
   * O idioma ainda esta antes da aula de estrutura -- alfabeto ou fundamentos.
   *
   * Isto muda as duas etapas seguintes, e nao so uma delas, porque o problema
   * que elas causam juntas e maior que a soma: o ranqueamento pontua
   * `100 - competencia`, entao um idioma que o aluno nao fala ganha escuta e
   * gramatica NO TOPO da fila, justamente por ele nao saber nada. Com 15
   * minutos por idioma isso enchia metade do tempo de alemao e de russo com
   * dialogo falado e exercicio de gramatica gerado por IA -- para quem estava
   * na primeira licao do alfabeto. O motor foi desenhado para atacar a
   * competencia mais fraca, o que e certo quando a fraqueza e uma lacuna e
   * exatamente errado quando a fraqueza e nao saber o idioma.
   */
  const preStructure = dailyTypes.some((type) =>
    (PRE_STRUCTURE_TYPES as readonly string[]).includes(type),
  );

  dailyTypes.forEach((type, index) => {
    if (remaining < MIN_BLOCK) return;

    // O que os obrigatorios seguintes ainda vao precisar.
    const stillReserved = MIN_BLOCK * (dailyTypes.length - index - 1);

    /*
     * Quanto este bloco pede, antes dos limites.
     *
     * Fora do modo pre-estrutura sao 20% do tempo do idioma, e o resto vai para
     * o ranqueamento. Dentro dele nao ha ranqueamento adiante, entao os
     * obrigatorios dividem entre si o que sobrou: segurar os 20% aqui deixaria
     * o tempo restante sem destino nenhum.
     */
    const share = preStructure
      ? Math.floor(remaining / (dailyTypes.length - index))
      : Math.round(minutes * 0.2);

    const blockMinutes = Math.min(
      MAX_BLOCK,
      Math.max(MIN_BLOCK, remaining - stillReserved),
      Math.max(MIN_BLOCK, share),
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

  /*
   * 3. O tempo restante vai para os tipos com maior necessidade -- exceto antes
   *    da estrutura.
   *
   * Nenhum dos candidatos do ranqueamento e acompanhavel por quem ainda nao le
   * o alfabeto ou nao monta a frase: escuta, ditado, fala, escrita, leitura,
   * gramatica e tutor pressupoem, todos, um idioma que o aluno ja tem por baixo.
   * Nao ha um subconjunto seguro a salvar aqui -- por isso a etapa inteira e
   * pulada, e nao filtrada. O tempo ja foi para os obrigatorios na etapa 2.
   */
  const ranked = preStructure ? [] : rankTypes(language, dailyTypes);

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
  foundation:
    'As primeiras peças da frase, do zero. Sem elas, toda aula depois soa como língua estrangeira sobre língua estrangeira.',
  vocabulary: 'Os conceitos de hoje, os mesmos que voce ve nos outros idiomas.',
  assessment:
    'Prova do mês: funções que você aprendeu há três semanas ou mais, sem dica e sem autoavaliação. É a única medida do app que não depende da sua opinião.',
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
  // Alfabeto e fundamentos saem da disputa mesmo quando nao sao obrigatorios
  // hoje: os dois sao escadas com uma licao por vez, entao um segundo bloco no
  // mesmo dia repetiria a mesma licao -- e, com a trilha fechada, nao ha o que
  // servir.
  //
  // `DAILY_TYPES` entra inteiro junto com os de hoje: em modo alfabeto ou
  // fundamentos, `structure` perdeu a vaga obrigatoria e voltaria pela porta do
  // ranqueamento, devolvendo ao aluno exatamente a aula que ele ainda nao
  // consegue acompanhar.
  //
  // `contrast` e `compare` tambem ficam de fora, e por um motivo diferente:
  // eles nao sao blocos DESTE idioma. Ja foram criados uma vez, fora da divisao
  // por idioma, e deixa-los concorrer aqui daria um bloco de comparacao por
  // idioma -- quatro vezes a mesma tela, cada uma dizendo pertencer a uma
  // lingua so, que e o oposto do que eles fazem.
  const excluded = new Set<string>([
    ...DAILY_TYPES,
    ...dailyTypes,
    ...PRE_STRUCTURE_TYPES,
    ...CROSS_LANGUAGE_TYPES,
  ]);
  /*
   * Morfologia so existe onde a lingua marca caso. Ingles e espanhol nao marcam,
   * e servir o bloco neles seria inventar assunto -- ainda por cima gastando a
   * vaga de um bloco util.
   */
  if (!language.hasMorphology) excluded.add('morphology');

  /*
   * Armadilhas so entram com interferencia diagnosticada. O bloco e movido pela
   * EVIDENCIA, nao pela competencia: sem par confuso para desambiguar, ele
   * treinaria uma confusao que este aluno nao tem -- e ainda tomaria a vaga de
   * um bloco escolhido pela fraqueza real.
   *
   * Continua alcancavel pela pratica livre, onde o catalogo curado preenche a
   * rodada sozinho. O que a bandeira governa e a entrada AUTOMATICA.
   */
  if (language.interferenceErrors <= 0) excluded.add('traps');

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
      .filter(
        ([category]) =>
          ERROR_TO_TYPE[category] === type || SECONDARY_ERROR_TO_TYPE[category] === type,
      )
      .reduce((sum, [, count]) => sum + count, 0);

    /*
     * A interferencia pontua o bloco de armadilhas direto, sem passar pelas
     * categorias: o que o move nao e "erro de artigo" nem "erro de ordem", e o
     * fato de OUTRO IDIOMA estar vazando -- categoria nenhuma captura isso, e e
     * justamente por isso que o campo de origem existe.
     */
    if (type === 'traps') {
      score += language.interferenceErrors * 10;
      reasons.push(
        `${language.interferenceErrors} ${
          language.interferenceErrors === 1 ? 'erro vindo' : 'erros vindos'
        } de outro idioma que voce estuda`,
      );
    }

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
