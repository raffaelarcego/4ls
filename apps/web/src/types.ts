export type Pillar = 'LISTEN' | 'LEARN' | 'LIVE' | 'LEVEL_UP';
export type VocabStatus = 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED';
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export interface SessionActivity {
  id: string;
  languageCode: string;
  languageName: string;
  pillar: Pillar;
  type: string;
  order: number;
  plannedMinutes: number;
  durationSeconds: number;
  completed: boolean;
  score: number | null;
  xpEarned: number;
  reason: string | null;
}

export interface StudySession {
  id: string;
  date: string;
  plannedMinutes: number;
  durationSeconds: number;
  xpEarned: number;
  completed: boolean;
  rationale: string | null;
  activities: SessionActivity[];
}

export interface LanguageSkills {
  listening: number;
  reading: number;
  writing: number;
  speaking: number;
  vocabScore: number;
  grammar: number;
  pronunciation: number;
}

export interface DashboardLanguage {
  id: string;
  code: string;
  name: string;
  currentLevel: string;
  targetLevel: string;
  minutesPerDay: number;
  compositeScore: number;
  suggestedLevel: string;
  skills: LanguageSkills;
  dueReviews: number;
  vocabulary: { total: number; learning: number; mastered: number };
  topErrors: Array<{
    id: string;
    category: string;
    description: string;
    occurrenceCount: number;
  }>;
}

export interface DashboardData {
  session: StudySession;
  languages: DashboardLanguage[];
  streak: { current: number; longest: number };
  xp: XpSummary;
  aiEnabled: boolean;
}

/**
 * Onde o aluno esta na curva de nivel.
 *
 * Vem pronto do backend, e nao calculado aqui, porque a curva e regra de
 * produto: ter a formula nos dois lados garantiria que um dia eles divergem e
 * a barra passaria a discordar do nivel que o servidor credita.
 */
export interface LevelProgress {
  level: number;
  /** "Aprendiz", "Viajante", "Mestre das Quatro"... */
  title: string;
  xpIntoLevel: number;
  xpForLevel: number;
  xpRemaining: number;
  /** 0-99. Nunca 100: ao encher, o nivel sobe e ela zera. */
  percent: number;
}

export interface XpSummary {
  today: number;
  week: number;
  total: number;
  progress: LevelProgress;
}

/**
 * Uma realizacao do conceito em um idioma.
 * Nunca chega sozinha: o card sempre traz as quatro, porque a regra do produto
 * e que o significado entre em todos os idiomas no mesmo dia.
 */
export interface ConceptEntry {
  languageCode: string;
  languageName: string;
  term: string;
  meaning: string;
  example: string | null;
  translation: string | null;
  status: VocabStatus | null;
  nextReview: string | null;
}

export interface ConceptCard {
  id: string;
  slug: string;
  /** O significado em portugues -- o gancho comum das quatro palavras. */
  gloss: string;
  note: string | null;
  level: string;
  entries: ConceptEntry[];
}

/** Uma peca da frase, com a funcao que ela cumpre. */
export interface SentencePart {
  text: string;
  role: string;
}

export interface StructureExample {
  sentence: string;
  translation: string;
  parts: SentencePart[];
  note?: string;
}

export interface StructurePitfall {
  wrong: string;
  right: string;
  why: string;
}

export interface StructureDrill {
  gloss: string;
  scrambled: string[];
  answer: string;
  explanation: string;
}

/** A aula de formacao de frase do dia, para um idioma. */
export interface StructureLesson {
  patternId: string;
  languageCode: string;
  languageName: string;
  level: string;
  title: string;
  question: string;
  formula: string;
  explanation: string;
  /** A regra curada no catalogo -- nao veio da IA. */
  behavior: string;
  /** Como os outros idiomas resolvem o mesmo ponto. */
  contrast: string;
  steps: string[];
  examples: StructureExample[];
  pitfalls: StructurePitfall[];
  drills: StructureDrill[];
  mastery: number;
  attempts: number;
}

/**
 * Uma armadilha: a forma certa e a que sai quando outra língua vaza.
 *
 * `own` marca as que vieram de um erro que ele mesmo cometeu — a alternativa
 * errada ali é literalmente a frase que ele escreveu.
 */
export interface TrapItem {
  id: string;
  sourceCode: string;
  /** A ideia em português. Erro próprio nem sempre tem uma. */
  gloss: string | null;
  options: string[];
  answer: string;
  why: string;
  own: boolean;
}

export interface TrapsLesson {
  languageCode: string;
  languageName: string;
  level: string;
  /** Quantos itens saíram de erros que ele mesmo cometeu. */
  fromOwnErrors: number;
  items: TrapItem[];
}

/** Uma linha da tabela de casos: a palavra naquele caso. */
export interface ParadigmForm {
  slotId: string;
  form: string;
  romanization?: string | null;
  /** O que mudou nesta forma. Null quando não há nada a dizer. */
  note?: string | null;
}

/** Um caso do idioma, do catálogo. */
export interface MorphologySlotInfo {
  id: string;
  name: string;
  /** A pergunta que ele responde — é ela que ensina, não o nome. */
  question: string;
  triggers?: string[];
  trap?: string;
  /** Fora do nível dele ainda: aparece na tabela, não entra no treino. */
  locked?: boolean;
}

/**
 * Um exercício: a frase com a forma escondida.
 *
 * As alternativas são as outras formas da MESMA palavra — os concorrentes
 * reais, e é isso que torna o exercício corrigível sem IA.
 */
export interface MorphologyDrill {
  slotId: string;
  term: string;
  sentence: string;
  romanization?: string | null;
  translation: string;
  options: string[];
  answer: string;
}

/** A aula de casos do dia, num idioma. */
export interface MorphologyLesson {
  languageCode: string;
  languageName: string;
  level: string;
  /** O caso em foco hoje. */
  slot: MorphologySlotInfo & { triggers: string[]; trap: string };
  /** Todos os casos do idioma, para a tabela mostrar o mapa inteiro. */
  slots: MorphologySlotInfo[];
  mastery: Record<string, number>;
  word: {
    term: string;
    gloss: string;
    gender?: string | null;
    pattern: string;
    forms: ParadigmForm[];
  };
  drills: MorphologyDrill[];
}

/** As tres rodadas do chefe de fase. */
export type PromotionRound = 'sentences' | 'reading' | 'vocabulary';

/**
 * O estado do chefe num idioma.
 *
 * `reason` sempre diz o que FALTA, nunca apenas "bloqueado": o portao tem
 * quatro motivos diferentes para estar fechado, e cada um pede uma ação
 * diferente do aluno — esperar, estudar, ou nada (topo da escala).
 */
export interface PromotionGate {
  state: 'ready' | 'growing' | 'cooldown' | 'unprepared' | 'maxed';
  reason: string;
  languageCode: string;
  languageName: string;
  currentLevel: string;
  nextLevel: string | null;
  missingScore: number;
  availableAt: string | null;
}

/** Um item do exame. Com `scrambled` é montagem; com `options`, escolha. */
export interface PromotionItem {
  round: PromotionRound;
  prompt: string;
  scrambled?: string[];
  options?: string[];
  answer: string;
  explanation?: string;
}

export interface PromotionExam {
  languageCode: string;
  languageName: string;
  currentLevel: string;
  nextLevel: string | null;
  items: PromotionItem[];
}

export interface PromotionAttempt {
  passed: boolean;
  score: number;
  rounds: Array<{ round: PromotionRound; correct: number; total: number }>;
  from: string;
  level: string;
  /** A rodada que afundou. Vira o que treinar até o chefe reabrir. */
  weakest: PromotionRound | null;
}

/** Uma frase do texto de leitura, na versao de um idioma. */
export interface ReadingSentence {
  text: string;
  /** So em russo. */
  romanization?: string | null;
  /** A mesma frase em portugues, para quando ele travar. */
  translation: string;
}

export interface ReadingQuestion {
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}

/** O texto num idioma: o que ele le, mais o que a tela precisa em volta. */
export interface ReadingVersion {
  languageCode: string;
  title: string;
  sentences: ReadingSentence[];
  glossary?: Array<{ term: string; meaning: string }>;
  questions: ReadingQuestion[];
}

/**
 * A MESMA historia nos outros idiomas, alinhada por indice.
 *
 * A frase N daqui diz o que diz a frase N da versao que ele esta lendo -- e por
 * isso que a tela consegue abrir qualquer frase e mostrar as outras tres. Vem
 * so o texto: perguntas e glossario dos outros idiomas nao servem a nada aqui.
 */
export interface ReadingOtherVersion {
  languageCode: string;
  title: string;
  sentences: Array<{ text: string; romanization?: string | null }>;
}

/** O texto de leitura do dia, num idioma, com as outras versoes junto. */
export interface ReadingLesson {
  passageId: string;
  /** O titulo em portugues; o do idioma vem em `version.title`. */
  title: string;
  premise: string;
  /** O que reparar enquanto le -- o ponto em que os quatro se separam. */
  focus: string;
  genre: string;
  level: string;
  languageCode: string;
  languageName: string;
  version: ReadingVersion;
  others: ReadingOtherVersion[];
  /**
   * Em que idiomas ele JA leu esta historia. Saber que o conteudo e conhecido
   * muda como se entra num texto que parecia impossivel.
   */
  alsoRead: string[];
  contrast: string;
}

/**
 * Uma peca da frase presa a uma COLUNA da can-do -- e nao a um papel gramatical
 * do idioma. A coluna e a mesma nos quatro idiomas; o que muda de um para outro
 * e a ordem em que eles a preenchem, e e essa diferenca de ordem que ensina.
 *
 * Uma realizacao pode ter MENOS pecas do que colunas: o espanhol resolve
 * "Eu sou brasileiro." com "Soy brasileño." e simplesmente nao preenche QUEM.
 * A coluna vazia e a licao, nao um dado faltando -- quem consome isto tem de
 * mostrar a ausencia, nunca fechar o buraco.
 */
export interface CanDoPart {
  text: string;
  /** Nome da coluna, em portugues, tal como vem em `CanDoToday.columns`. */
  column: string;
}

/** A mesma ideia resolvida por UM idioma. */
export interface CanDoRealization {
  languageCode: string;
  sentence: string;
  /** So vem preenchida em escrita nao-latina (russo). */
  romanization?: string | null;
  parts?: CanDoPart[];
  /** Comentario em portugues sobre ESTA frase neste idioma. */
  note?: string;
}

/**
 * Uma ideia da aula, com as quatro realizacoes juntas.
 *
 * O agrupamento e por ideia e nao por idioma de proposito: e a ideia que os
 * quatro compartilham, e so com as quatro realizacoes da MESMA ideia lado a
 * lado a diferenca de ordem entre elas fica visivel.
 */
export interface CanDoSentence {
  /** A ideia, em portugues -- o gancho comum das realizacoes. */
  gloss: string;
  realizations: CanDoRealization[];
}

/** Comentario curado sobre o que um idioma exige nesta can-do. */
export interface CanDoNote {
  languageCode: string;
  /** O que este idioma exige aqui e o portugues nao exige. */
  note: string;
  /** O erro que um falante de portugues comete neste ponto, se houver. */
  trap?: string;
}

/** Matricula do aluno num idioma. Nao carrega conteudo: so nome e progresso. */
export interface CanDoLanguage {
  code: string;
  name: string;
  level: string;
  mastery: number;
}

/**
 * A can-do do dia: uma funcao comunicativa enunciada em portugues e as quatro
 * realizacoes dela. Serve aos dois blocos que fecham o dia pelas pontas -- o
 * contraste explicito na abertura e a producao de memoria no encerramento --,
 * por isso a mesma resposta atende os dois runners.
 */
export interface CanDoToday {
  canDoId: string;
  /** A funcao, do ponto de vista de quem quer falar. Em portugues. */
  question: string;
  goal: string;
  level: string;
  /** As colunas da montagem, iguais para os quatro idiomas. */
  columns: string[];
  /** Comentario por idioma. Nem todo idioma matriculado aparece aqui. */
  notes: CanDoNote[];
  languages: CanDoLanguage[];
  /** O conteudo: uma entrada por ideia, cada uma com as quatro realizacoes. */
  sentences: CanDoSentence[];
  /** Paragrafo curto, em portugues, sobre o que difere entre os quatro. */
  contrast: string;
  mastery: number;
}

export interface CanDoRecordResult {
  score: number;
  mastery: number;
}

/** Uma letra do alfabeto, do jeito que ela precisa ser apresentada. */
export interface AlphabetLetter {
  upper: string;
  lower: string;
  name: string;
  /** Ancora de som em portugues, ex. 'j de "janela"'. */
  sound: string;
  /**
   * So existe nas letras que PARECEM latinas e soam diferente (Н Р С В У Х Е).
   * E o texto mais valioso da tela: e exatamente onde ele le errado com
   * confianca, e por isso nunca erra sozinho -- erra sempre do mesmo jeito.
   */
  trap?: string;
}

/** Uma palavra legivel apenas com as letras ja ensinadas. */
export interface AlphabetWord {
  word: string;
  meaning: string;
  /** Como soa, soletrado em portugues. */
  reading: string;
}

/** A aula de alfabeto do dia, para um idioma de escrita nao-latina. */
export interface AlphabetLesson {
  lessonId: string;
  languageCode: string;
  languageName: string;
  index: number;
  total: number;
  title: string;
  goal: string;
  letters: AlphabetLetter[];
  words: AlphabetWord[];
  /** Letras de licoes anteriores -- servem de distrator plausivel no treino. */
  review: AlphabetLetter[];
  mastery: number;
  complete: boolean;
}

/** Uma peça de frase nova: uma palavra, com o papel que ela cumpre. */
export interface FoundationPiece {
  term: string;
  meaning: string;
  /** Como soa, soletrado em português. */
  reading: string;
  /** O que esta peça exige e o português não exige. */
  note?: string;
  /** Só existe nas peças que parecem outra coisa — o "ja" alemão que se lê "iá". */
  trap?: string;
}

/** Um pedaço de frase, com o papel dele: QUEM, SER, ONDE, AÇÃO, NÃO. */
export interface SentencePart {
  chunk: string;
  label: string;
}

/** Uma frase montável apenas com as peças já ensinadas. */
export interface FoundationSentence {
  text: string;
  reading: string;
  meaning: string;
  /** A frase quebrada, na ordem do idioma. É a aula de montagem. */
  parts: SentencePart[];
}

/** A aula de fundamentos do dia, para um idioma que o aluno começa do zero. */
export interface FoundationLesson {
  lessonId: string;
  languageCode: string;
  languageName: string;
  index: number;
  total: number;
  title: string;
  goal: string;
  /** A regra de montagem em português — o texto que ele não deduz sozinho. */
  rule: string;
  pieces: FoundationPiece[];
  sentences: FoundationSentence[];
  /** Peças de lições anteriores — servem de distrator plausível no treino. */
  review: FoundationPiece[];
  mastery: number;
  complete: boolean;
  /**
   * `learn` = lição nova, com peças e frases antes do treino.
   * `review` = lição já vencida voltando; a tela abre direto no treino.
   */
  mode: 'learn' | 'review';
}

/** A mesma coisa num idioma que o aluno ja domina, para servir de dica. */
export interface Scaffold {
  languageCode: string;
  languageName: string;
  term: string;
}

/** Uma tentativa de producao, avaliada. */
export interface ProductionResult {
  languageCode: string;
  languageName: string;
  ok: boolean;
  score: number;
  corrected: string;
  feedback: string;
  errors: Array<{
    category: string;
    description: string;
    explanation?: string;
    sourceLanguage?: string | null;
  }>;
}

export interface ProductionMission {
  conceptId: string;
  gloss: string;
  note: string | null;
  meaningStrength: number;
  targets: Array<{
    languageCode: string;
    languageName: string;
    term: string;
    meaning: string;
  }>;
}

export interface ProductionEvaluation {
  conceptId: string;
  gloss: string;
  score: number;
  /** O que a comparacao entre as quatro tentativas revelou. */
  insight: string | null;
  results: ProductionResult[];
}

/** Um par de idiomas que se atrapalham, com o contraste que resolve. */
export interface Interference {
  languageCode: string;
  languageName: string;
  sourceCode: string;
  sourceName: string;
  occurrences: number;
  categories: string[];
  topics: Array<{ id: string; title: string; question: string }>;
}

export interface CaptureResult {
  learned: ConceptCard[];
  /** Termos que o texto trouxe mas o aluno ja tinha. */
  skipped: string[];
}

export interface ReviewItem {
  id: string;
  status: VocabStatus;
  confidence: number;
  term: string;
  meaning: string;
  example: string | null;
  translation: string | null;
  level: string;
  languageCode: string;
  languageName: string;
  conceptId: string | null;
  /** Presente so quando o significado ja firmou e a forma deste idioma nao. */
  scaffold: Scaffold | null;
}

/** Um item da prova mensal: uma frase para remontar num idioma. */
export interface AssessmentItem {
  canDoId: string;
  languageCode: string;
  /** O que dizer, em português. */
  gloss: string;
  /** A frase certa, revelada depois da resposta. */
  sentence: string;
  /** Os pedaços na ordem CERTA — quem embaralha é a tela. */
  parts: Array<{ text: string; column: string }>;
}

/**
 * A prova do mês.
 *
 * Vem vazia quando não há material com três semanas de descanso, e isso é
 * estado normal, não erro: é o que acontece com quem começou há pouco.
 */
export interface AssessmentExam {
  items: AssessmentItem[];
  questions: Array<{ canDoId: string; question: string }>;
}

/** Uma entrada da tabela de consulta: uma letra, um dígrafo, uma combinação. */
export interface ReferenceEntry {
  symbol: string;
  name?: string;
  /** O som, ancorado numa palavra portuguesa. */
  sound: string;
  example?: string;
  exampleMeaning?: string;
  exampleReading?: string;
  /** O engano provável. Só quem parece outra coisa tem. */
  trap?: string;
}

export interface ReferenceSection {
  id: string;
  title: string;
  note?: string;
  entries: ReferenceEntry[];
  /** 0-100 quando a seção é uma lição da trilha; null quando é só regra. */
  mastery: number | null;
}

/** O material de consulta de um idioma. Não pontua e não entra na sessão. */
export interface Reference {
  languageCode: string;
  title: string;
  intro: string;
  sections: ReferenceSection[];
  /** Vale oferecer ordem alfabética? Alfabeto sim, regra de leitura não. */
  sortable: boolean;
  /** Tudo numa lista só, para busca e ordenação. */
  all: ReferenceEntry[];
}

export interface ReferenceLanguage {
  code: string;
  name: string;
  title: string;
}
