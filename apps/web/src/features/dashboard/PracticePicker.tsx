import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { activityTheme, languageTheme } from '../../lib/ui';
import { api, errorMessage } from '../../services/api';
import { DashboardLanguage } from '../../types';

/**
 * Os tipos que podem ser iniciados avulso. A ordem e a mesma do backend
 * (`PRACTICABLE_TYPES`) -- se um lado ganhar um tipo novo, o outro rejeita.
 */
const TYPES = [
  'review',
  'foundation',
  'structure',
  'vocabulary',
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
 * Prática livre.
 *
 * O planejador continua mandando no que voce *deveria* fazer, mas ele so cabe
 * uns poucos blocos por dia -- entao ditado e fala podiam nunca aparecer. Aqui
 * o bloco entra na sessao de hoje por escolha explicita, valendo XP igual.
 */
export function PracticePicker({ languages }: { languages: DashboardLanguage[] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [languageCode, setLanguageCode] = useState(languages[0]?.code ?? 'en');
  const [type, setType] = useState<string>('listening');

  const start = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/study/practice', { languageCode, type });
      return data as { id: string };
    },
    onSuccess: (activity) => {
      queryClient.invalidateQueries({ queryKey: ['session', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate(`/sessao?activity=${activity.id}`);
    },
  });

  if (!open) {
    return (
      <button
        className="btn-ghost w-full"
        onClick={() => setOpen(true)}
        aria-expanded={false}
      >
        Treinar outra coisa
      </button>
    );
  }

  return (
    <section className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="section-title">Prática livre</h2>
          <p className="text-xs text-wolf">Entra na sessão de hoje e vale XP igual aos blocos planejados.</p>
        </div>
        <button className="btn-plain px-2 text-xs" onClick={() => setOpen(false)}>
          Fechar
        </button>
      </div>

      <div className="flex gap-2">
        {languages.map((language) => {
          const theme = languageTheme(language.code);
          const isActive = languageCode === language.code;
          return (
            <button
              key={language.code}
              onClick={() => setLanguageCode(language.code)}
              className={`flex-1 rounded-md border px-2 py-2.5 font-mono text-xs transition ${
                isActive
                  ? `${theme.border} ${theme.soft} ${theme.text}`
                  : 'border-swan bg-white text-wolf hover:bg-snow'
              }`}
            >
              <span aria-hidden className="mr-1">
                {theme.mark}
              </span>
              {language.code.toUpperCase()}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {TYPES.map((option) => {
          const theme = activityTheme(option);
          const isActive = type === option;
          return (
            <button
              key={option}
              onClick={() => setType(option)}
              className={`flex flex-col items-center gap-1 rounded-md border px-1 py-3 text-[11px] transition ${
                isActive
                  ? 'border-macaw bg-macaw-soft text-macaw-dark'
                  : 'border-swan bg-white text-wolf hover:bg-snow'
              }`}
            >
              {theme.label}
            </button>
          );
        })}
      </div>

      <p className="rounded-md bg-snow px-3 py-2 text-xs text-wolf">{activityTheme(type).blurb}</p>

      {start.isError && (
        <p className="rounded-md bg-cardinal-soft px-3 py-2 text-sm text-cardinal-dark">
          {errorMessage(start.error)}
        </p>
      )}

      <button
        className="btn-primary w-full py-4"
        onClick={() => start.mutate()}
        disabled={start.isPending}
      >
        {start.isPending ? 'Preparando...' : 'Treinar agora'}
      </button>
    </section>
  );
}
