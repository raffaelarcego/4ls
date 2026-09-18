/**
 * Vocabulario visual do app: como cada idioma, atividade e competencia se
 * apresentam. Fica num lugar so para que dashboard, sessao e progresso nunca
 * divirjam no icone, na cor ou no nome de uma mesma coisa.
 */

export interface LanguageTheme {
  /** Monograma tipografico do idioma -- uma letra que so existe nele. */
  mark: string;
  /** Cor solida de fundo (avatar, barra de progresso). */
  bg: string;
  text: string;
  soft: string;
  border: string;
}

const FALLBACK_LANGUAGE: LanguageTheme = {
  mark: '?',
  bg: 'bg-humpback',
  text: 'text-humpback-dark',
  soft: 'bg-humpback-soft',
  border: 'border-humpback',
};

const LANGUAGE_THEMES: Record<string, LanguageTheme> = {
  /*
   * Portugues nao e um idioma estudado -- e a referencia, e aparece o tempo
   * todo como origem de comparacao e de interferencia. Por isso esta aqui em
   * tom neutro, e nao com uma cor propria: visualmente ele nao disputa com os
   * quatro que estao sendo aprendidos. Sem esta entrada, `languageTheme('pt')`
   * caia no fallback e o portugues aparecia como "?".
   */
  pt: {
    mark: 'ã',
    bg: 'bg-wolf',
    text: 'text-wolf',
    soft: 'bg-snow',
    border: 'border-swan',
  },
  en: {
    mark: 'w',
    bg: 'bg-macaw',
    text: 'text-macaw-dark',
    soft: 'bg-macaw-soft',
    border: 'border-macaw',
  },
  es: {
    mark: 'ñ',
    bg: 'bg-bee',
    text: 'text-bee-dark',
    soft: 'bg-bee-soft',
    border: 'border-bee',
  },
  de: {
    mark: 'ß',
    bg: 'bg-forest',
    text: 'text-forest-dark',
    soft: 'bg-forest-soft',
    border: 'border-forest',
  },
  ru: {
    mark: 'ы',
    bg: 'bg-humpback',
    text: 'text-humpback-dark',
    soft: 'bg-humpback-soft',
    border: 'border-humpback',
  },
};

export function languageTheme(code: string): LanguageTheme {
  return LANGUAGE_THEMES[code] ?? FALLBACK_LANGUAGE;
}

export interface ActivityTheme {
  label: string;
  emoji: string;
  /** O que a atividade treina, em uma linha, quando o motor nao explica. */
  blurb: string;
}

const ACTIVITY_THEMES: Record<string, ActivityTheme> = {
  review: { label: 'Revisão', emoji: '🔁', blurb: 'Cards que venceram hoje' },
  vocabulary: { label: 'Vocabulário', emoji: '💬', blurb: 'O mesmo conceito nos 4 idiomas' },
  structure: { label: 'Estrutura', emoji: '🧱', blurb: 'Como montar a frase neste idioma' },
  production: { label: 'Produção', emoji: '🎤', blurb: 'A mesma frase nos 4 idiomas' },
  grammar: { label: 'Gramática', emoji: '🧩', blurb: 'Estrutura e formas' },
  listening: { label: 'Escuta', emoji: '🎧', blurb: 'Diálogo falado + compreensão' },
  dictation: { label: 'Ditado', emoji: '🎙️', blurb: 'Ouvir e escrever' },
  reading: { label: 'Leitura', emoji: '📖', blurb: 'Compreensão de texto' },
  speaking: { label: 'Fala', emoji: '🗣️', blurb: 'Falar e ser corrigido' },
  writing: { label: 'Escrita', emoji: '✍️', blurb: 'Produzir texto seu' },
  tutor: { label: 'Tutor', emoji: '🤖', blurb: 'Conversa corrigida' },
  assessment: { label: 'Avaliação', emoji: '🎯', blurb: 'Medir o nível' },
};

export function activityTheme(type: string): ActivityTheme {
  return ACTIVITY_THEMES[type] ?? { label: type, emoji: '⭐', blurb: 'Bloco de estudo' };
}

export const PILLAR_LABEL: Record<string, string> = {
  LISTEN: 'Input',
  LEARN: 'Treino',
  LIVE: 'Uso real',
  LEVEL_UP: 'Nível',
};

export const SKILL_LABEL: Record<string, { label: string; emoji: string }> = {
  listening: { label: 'Escuta', emoji: '🎧' },
  reading: { label: 'Leitura', emoji: '📖' },
  writing: { label: 'Escrita', emoji: '✍️' },
  speaking: { label: 'Fala', emoji: '🗣️' },
  grammar: { label: 'Gramática', emoji: '🧩' },
  vocabScore: { label: 'Vocabulário', emoji: '💬' },
  pronunciation: { label: 'Pronúncia', emoji: '🔊' },
};

/** Verde quando vai bem, ambar no meio, vermelho quando precisa de atencao. */
export function scoreTone(value: number): { bar: string; text: string } {
  if (value >= 70) return { bar: 'bg-grass', text: 'text-grass-dark' };
  if (value >= 40) return { bar: 'bg-bee', text: 'text-bee-dark' };
  return { bar: 'bg-cardinal', text: 'text-cardinal-dark' };
}
