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

/** Tipos que podem ser iniciados avulso, pelo botao de pratica livre. */
export const PRACTICABLE_TYPES = [
  'review',
  'vocabulary',
  'grammar',
  'listening',
  'dictation',
  'speaking',
  'writing',
  'reading',
  'tutor',
] as const;

export function planSession(languages: LanguageState[], totalMinutes: number): MissionPlan {
  const activities: PlannedActivity[] = [];
  const highlights: string[] = [];

  // O tempo declarado por idioma e normalizado para bater com o total real.
  const declared = languages.reduce((sum, l) => sum + l.minutesPerDay, 0) || 1;
  const scale = totalMinutes / declared;

  for (const language of languages) {
    const minutes = Math.round(language.minutesPerDay * scale);
    if (minutes < MIN_BLOCK) continue;

    const { blocks, highlight } = planLanguage(language, minutes);
    activities.push(...blocks);
    if (highlight) highlights.push(highlight);
  }

  return {
    totalMinutes: activities.reduce((sum, a) => sum + a.plannedMinutes, 0),
    rationale: highlights.length
      ? `Foco de hoje: ${highlights.join('; ')}.`
      : 'Sessao equilibrada entre os tres idiomas.',
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

  // 1. Revisao vencida sempre vem primeiro -- e o que trava a progressao.
  if (language.dueReviews > 0) {
    // ~30s por item, entre MIN_BLOCK e 40% do tempo do idioma.
    const reviewMinutes = clamp(
      Math.ceil(language.dueReviews * 0.5),
      MIN_BLOCK,
      Math.max(MIN_BLOCK, Math.floor(minutes * 0.4)),
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

  // 2. O tempo restante vai para os tipos com maior necessidade.
  const ranked = rankTypes(language);

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

  // 3. Sobra pequena volta para o primeiro bloco, para fechar o tempo exato.
  if (remaining > 0 && blocks.length > 0) {
    blocks[0].plannedMinutes += remaining;
  }

  return { blocks, highlight };
}

interface RankedType {
  type: string;
  score: number;
  reason: string;
}

/**
 * Pontua cada tipo de atividade. Score maior = mais necessario hoje.
 * Tres forcas: fraqueza da competencia, erros recorrentes e variedade.
 */
function rankTypes(language: LanguageState): RankedType[] {
  const candidates = Object.keys(SKILL_BY_TYPE);

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
