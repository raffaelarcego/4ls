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
  xp: { today: number; week: number; total: number };
  aiEnabled: boolean;
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
