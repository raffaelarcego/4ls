import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AudioButton } from '../../components/AudioButton';
import { ProgressBar } from '../../components/ProgressBar';
import { languageTheme } from '../../lib/ui';
import { api } from '../../services/api';
import { VocabStatus } from '../../types';
import { TextCapture } from './TextCapture';

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

const STATUS: Record<VocabStatus, { label: string; chip: string; bar: string }> = {
  NEW: { label: 'Novo', chip: 'border-swan text-wolf', bar: 'bg-hare' },
  LEARNING: { label: 'Aprendendo', chip: 'border-bee text-bee-dark', bar: 'bg-bee' },
  REVIEW: { label: 'Revisando', chip: 'border-macaw text-macaw-dark', bar: 'bg-macaw' },
  MASTERED: { label: 'Dominado', chip: 'border-grass text-grass-dark', bar: 'bg-grass' },
};

/**
 * Rotulo curto de proposito.
 *
 * Com os nomes inteiros, os cinco filtros somavam bem mais que a largura de um
 * celular: a faixa rolava e o alemao e o russo ficavam fora da tela, sem nada
 * indicando que existiam. Com o codigo os cinco cabem de uma vez, e escolher
 * um idioma deixa de depender de descobrir que a faixa rola.
 */
const LANGUAGE_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
  { value: 'de', label: 'DE' },
  { value: 'ru', label: 'RU' },
];

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'NEW', label: 'Novos' },
  { value: 'LEARNING', label: 'Aprendendo' },
  { value: 'REVIEW', label: 'Revisando' },
  { value: 'MASTERED', label: 'Dominados' },
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
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-eel">Suas palavras</h1>
        <p className="text-sm text-wolf">Cada termo guarda contexto, histórico de acertos e a próxima revisão.</p>
      </header>

      <TextCapture />

      <div className="space-y-2">
        <FilterRow options={LANGUAGE_FILTERS} value={language} onChange={setLanguage} />
        <FilterRow options={STATUS_FILTERS} value={status} onChange={setStatus} />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-swan/40" />
          ))}
        </div>
      )}

      {data && data.length === 0 && (
        <div className="card flex flex-col items-center gap-1 py-10 text-center">
          <p className="font-serif font-semibold text-eel">Nenhum termo com estes filtros</p>
          <p className="text-sm text-wolf">Tente afrouxar a busca.</p>
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
    <div className="hscroll -mx-4 flex gap-2 px-4 pb-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`shrink-0 rounded-md border px-3.5 py-1.5 text-xs transition ${
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
      {/*
        Empilha no celular. Em linha unica, o audio e os dois chips ocupavam
        `shrink-0` e sobravam 109px para o termo: "straightforward" nao cabia no
        proprio card. O termo e o conteudo do card -- quem cede espaco sao os
        adornos.
      */}
      <div className="space-y-2 sm:flex sm:items-start sm:justify-between sm:gap-3 sm:space-y-0">
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-eel">
              <span className={`mr-1 font-mono ${theme.text}`}>{theme.mark}</span>
              {row.term}
            </p>
            <p className="text-sm text-wolf">{row.meaning}</p>
          </div>
          <AudioButton text={row.term} languageCode={row.languageCode} size="sm" />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="chip">{row.level}</span>
          <span className={`chip ${status.chip}`}>{status.label}</span>
        </div>
      </div>

      {row.example && (
        <div className="flex items-start gap-2.5 rounded-md bg-snow px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="font-serif text-sm italic text-eel">{row.example}</p>
            {row.translation && <p className="mt-0.5 text-xs text-wolf">{row.translation}</p>}
          </div>
          <AudioButton text={row.example} languageCode={row.languageCode} size="sm" />
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* confidence vem em 0-1 do SRS engine. */}
        <ProgressBar value={row.confidence} max={1} size="sm" tone={status.bar} />
        <span className="shrink-0 font-mono text-[11px] text-hare">
          {attempts > 0 ? `${row.correctCount}/${attempts} acertos, ` : 'sem tentativas, '}
          revisão em{' '}
          {new Date(row.nextReview).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}
