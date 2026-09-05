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
}
