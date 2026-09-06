export type Lang = 'pt' | 'en' | 'es' | 'de';

export interface TopicSummary {
  id: string;
  title: string;
  question: string;
  level: string;
  ally: Lang | null;
  allyName: string | null;
  contrast: Lang | null;
  contrastName: string | null;
  mastery: number;
  attempts: number;
  flagged: boolean;
}

/** Uma coluna da tabela de comparacao: um idioma e o que ele faz. */
export interface TopicColumn {
  lang: Lang;
  name: string;
  isTarget: boolean;
  /** "ally" confirma a intuicao do aluno, "contrast" a quebra. */
  role: 'ally' | 'contrast' | null;
  behavior: string;
}

export interface TopicExample {
  gloss: string;
  note: string | null;
  cells: Array<{ lang: Lang; text: string }>;
}

export interface TopicDetail {
  id: string;
  title: string;
  question: string;
  level: string;
  languageCode: string;
  ally: Lang | null;
  contrast: Lang | null;
  /** Analogia parcial, quando nenhum idioma serve de paralelo direto. */
  bridge: string | null;
  trap: { wrong: string; right: string; why: string } | null;
  columns: TopicColumn[];
  examples: TopicExample[];
  mastery: number;
  attempts: number;
  flagged: boolean;
}

export type DrillType = 'mirror' | 'trap' | 'align';

export interface Drill {
  type: DrillType;
  gloss: string;
  /** Versoes da frase que o aluno ja ve, nos idiomas de apoio. */
  shown: Array<{ lang: Lang; text: string }>;
  sentence: string;
  answer: string;
  explanation: string;
  options?: string[];
}
