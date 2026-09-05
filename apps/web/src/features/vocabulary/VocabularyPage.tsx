import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AudioButton } from '../../components/AudioButton';
import { ProgressBar } from '../../components/ProgressBar';
import { languageTheme } from '../../lib/ui';
import { api } from '../../services/api';
import { VocabStatus } from '../../types';

interface VocabularyRow {
  id: string;
  term: string;
  meaning: string;
  example: string | null;
  translation: string | null;
  level: string;
  languageCode: string;
  status: VocabStatus;
  confidence: number;
  nextReview: string;
  correctCount: number;
  wrongCount: number;
}

const STATUS: Record<VocabStatus, { label: string; emoji: string; chip: string; bar: string }> = {
  NEW: { label: 'Novo', emoji: '🌱', chip: 'bg-snow text-wolf', bar: 'bg-hare' },
  LEARNING: { label: 'Aprendendo', emoji: '🌿', chip: 'bg-bee-soft text-bee-dark', bar: 'bg-bee' },
  REVIEW: { label: 'Revisando', emoji: '🌳', chip: 'bg-macaw-soft text-macaw-dark', bar: 'bg-macaw' },
  MASTERED: {
    label: 'Dominado',
    emoji: '🏆',
    chip: 'bg-grass-soft text-grass-dark',
    bar: 'bg-grass',
  },
};

const LANGUAGE_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'de', label: '🇩🇪 Deutsch' },
];

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'NEW', label: '🌱 Novos' },
  { value: 'LEARNING', label: '🌿 Aprendendo' },
  { value: 'REVIEW', label: '🌳 Revisando' },
  { value: 'MASTERED', label: '🏆 Dominados' },
];

export function VocabularyPage() {
  const [language, setLanguage] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery<VocabularyRow[]>({
    queryKey: ['vocabulary', language, status],
    queryFn: async () => {
      const { data } = await api.get('/vocabulary', {
        params: { ...(language ? { language } : {}), ...(status ? { status } : {}) },
      });
      return data;
    },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-black tracking-tight">Suas palavras 💬</h1>
        <p className="text-sm font-semibold text-wolf">
          Cada termo guarda contexto, histórico de acertos e a próxima revisão.
        </p>
      </header>

      <div className="space-y-2">
        <FilterRow options={LANGUAGE_FILTERS} value={language} onChange={setLanguage} />
        <FilterRow options={STATUS_FILTERS} value={status} onChange={setStatus} />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-snow" />
          ))}
        </div>
      )}

      {data && data.length === 0 && (
        <div className="card flex flex-col items-center gap-2 py-10 text-center">
          <span className="text-5xl">🔍</span>
          <p className="font-black">Nenhum termo com estes filtros</p>
          <p className="text-sm font-semibold text-wolf">Tente afrouxar a busca.</p>
        </div>
      )}

      {data && data.length > 0 && (
        <>
          <p className="section-title">
            {data.length} {data.length === 1 ? 'termo' : 'termos'}
          </p>
          <div className="space-y-2.5">
            {data.map((row) => (
              <VocabularyCard key={row.id} row={row} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FilterRow({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`shrink-0 rounded-full border-2 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide transition ${
            value === option.value
              ? 'border-macaw bg-macaw-soft text-macaw-dark'
              : 'border-swan bg-white text-wolf hover:bg-snow'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function VocabularyCard({ row }: { row: VocabularyRow }) {
  const status = STATUS[row.status];
  const theme = languageTheme(row.languageCode);
  const attempts = row.correctCount + row.wrongCount;

  return (
    <div className="card space-y-2.5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black">
            <span aria-hidden>{theme.flag} </span>
            {row.term}
          </p>
          <p className="text-sm font-bold text-wolf">{row.meaning}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AudioButton text={row.term} languageCode={row.languageCode} size="sm" />
          <span className="chip bg-snow text-hare">{row.level}</span>
          <span className={`chip ${status.chip}`}>
            <span aria-hidden>{status.emoji}</span> {status.label}
          </span>
        </div>
      </div>

      {row.example && (
        <div className="flex items-start gap-2.5 rounded-xl bg-snow px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold italic text-eel">{row.example}</p>
            {row.translation && (
              <p className="mt-0.5 text-xs font-semibold text-wolf">{row.translation}</p>
            )}
          </div>
          <AudioButton text={row.example} languageCode={row.languageCode} size="sm" />
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* confidence vem em 0-1 do SRS engine. */}
        <ProgressBar value={row.confidence} max={1} size="sm" tone={status.bar} />
        <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-wider text-hare">
          {attempts > 0 ? `${row.correctCount}/${attempts} acertos` : 'sem tentativas'} · volta{' '}
          {new Date(row.nextReview).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}
