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
  /** O que a atividade treina, em uma linha, quando o motor nao explica. */
  blurb: string;
}

const ACTIVITY_THEMES: Record<string, ActivityTheme> = {
  alphabet: { label: 'Alfabeto', blurb: 'Ler as letras antes das palavras' },
  foundation: { label: 'Fundamentos', blurb: 'As primeiras peças da frase, do zero' },
  review: { label: 'Revisão', blurb: 'Cards que venceram hoje' },
  vocabulary: { label: 'Vocabulário', blurb: 'O mesmo conceito nos 4 idiomas' },
  structure: { label: 'Estrutura', blurb: 'Como montar a frase neste idioma' },
  // As duas pontas da can-do do dia. Sem entrada aqui, a sessao exibia o tipo
  // cru ("contrast") no lugar do nome do bloco.
  contrast: { label: 'Contraste', blurb: 'A mesma função nos 4 idiomas' },
  compare: { label: 'Comparação', blurb: 'A mesma função, de memória' },
  production: { label: 'Produção', blurb: 'A mesma frase nos 4 idiomas' },
  grammar: { label: 'Gramática', blurb: 'Estrutura e formas' },
  listening: { label: 'Escuta', blurb: 'Diálogo falado + compreensão' },
  dictation: { label: 'Ditado', blurb: 'Ouvir e escrever' },
  reading: { label: 'Leitura', blurb: 'A mesma história nos 4 idiomas' },
  speaking: { label: 'Fala', blurb: 'Falar e ser corrigido' },
  writing: { label: 'Escrita', blurb: 'Produzir texto seu' },
  tutor: { label: 'Tutor', blurb: 'Conversa corrigida' },
  assessment: { label: 'Avaliação', blurb: 'Medir o nível' },
  // O único bloco que muda o nível do idioma. Não é planejado: aparece no
  // painel quando o desempenho abre o portão, e é o aluno que decide encarar.
  promotion: { label: 'Chefe de fase', blurb: 'O exame que sobe o nível' },
};

export function activityTheme(type: string): ActivityTheme {
  return ACTIVITY_THEMES[type] ?? { label: type, blurb: 'Bloco de estudo' };
}

export const PILLAR_LABEL: Record<string, string> = {
  LISTEN: 'Input',
  LEARN: 'Treino',
  LIVE: 'Uso real',
  LEVEL_UP: 'Nível',
};

export const SKILL_LABEL: Record<string, { label: string }> = {
  listening: { label: 'Escuta' },
  reading: { label: 'Leitura' },
  writing: { label: 'Escrita' },
  speaking: { label: 'Fala' },
  grammar: { label: 'Gramática' },
  vocabScore: { label: 'Vocabulário' },
  pronunciation: { label: 'Pronúncia' },
};

/** Verde quando vai bem, ambar no meio, vermelho quando precisa de atencao. */
export function scoreTone(value: number): { bar: string; text: string } {
  if (value >= 70) return { bar: 'bg-grass', text: 'text-grass-dark' };
  if (value >= 40) return { bar: 'bg-bee', text: 'text-bee-dark' };
  return { bar: 'bg-cardinal', text: 'text-cardinal-dark' };
}
