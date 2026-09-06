import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AudioButton } from '../../components/AudioButton';
import { languageTheme } from '../../lib/ui';
import { api, errorMessage } from '../../services/api';
import { DrillRunner } from './DrillRunner';
import { TopicColumn, TopicDetail } from './types';

/** Cor da coluna conforme o papel do idioma na comparacao. */
function columnStyle(column: TopicColumn): string {
  if (column.isTarget) return 'border-macaw bg-macaw-soft';
  if (column.role === 'ally') return 'border-grass/40 bg-grass-soft';
  if (column.role === 'contrast') return 'border-cardinal/40 bg-cardinal-soft';
  return 'border-swan bg-white';
}

function roleLabel(column: TopicColumn): string | null {
  if (column.isTarget) return 'você está aprendendo';
  if (column.role === 'ally') return 'funciona igual';
  if (column.role === 'contrast') return 'funciona diferente';
  return null;
}

export function TopicView({
  topicId,
  languageCode,
  onBack,
}: {
  topicId: string;
  languageCode: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [training, setTraining] = useState(false);

  const { data, isLoading } = useQuery<TopicDetail>({
    queryKey: ['grammar', 'topic', topicId, languageCode],
    queryFn: async () =>
      (await api.get(`/grammar/topics/${topicId}`, { params: { language: languageCode } })).data,
  });

  const flag = useMutation({
    mutationFn: async (flagged: boolean) =>
      (await api.post(`/grammar/topics/${topicId}/flag`, { languageCode, flagged })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grammar'] });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-5">
        <div className="card flex min-h-[16rem] items-center justify-center">
          <span className="animate-float text-5xl">🧩</span>
        </div>
      </div>
    );
  }

  if (training) {
    return (
      <DrillRunner
        topicId={topicId}
        languageCode={languageCode}
        title={data.title}
        onDone={() => {
          setTraining(false);
          queryClient.invalidateQueries({ queryKey: ['grammar'] });
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-5">
      <button onClick={onBack} className="btn-plain -ml-3 text-sm">
        ← Voltar
      </button>

      <header className="space-y-1.5">
        <h1 className="text-2xl font-black leading-tight tracking-tight">{data.title}</h1>
        <p className="font-semibold text-wolf">{data.question}</p>
      </header>

      {/* Tabela de comparacao: uma coluna por idioma, alvo primeiro. Rola na
          horizontal no celular em vez de espremer o texto. */}
      <section className="-mx-4 overflow-x-auto px-4">
        <div className="flex min-w-max gap-2.5 pb-1">
          {data.columns.map((column) => {
            const theme = languageTheme(column.lang);
            const label = roleLabel(column);
            return (
              <div
                key={column.lang}
                className={`w-60 shrink-0 space-y-2 rounded-2xl border-2 p-3.5 ${columnStyle(column)}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{column.lang === 'pt' ? '🇧🇷' : theme.flag}</span>
                  <span className="text-sm font-black capitalize">{column.name}</span>
                </div>
                {label && (
                  <p className="text-[0.65rem] font-extrabold uppercase tracking-wider opacity-70">
                    {label}
                  </p>
                )}
                <p className="text-sm font-semibold leading-snug">{column.behavior}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Frases paralelas: a mesma ideia escrita nos quatro idiomas. E aqui que
          o contraste deixa de ser explicacao e vira percepcao. */}
      <section className="space-y-3">
        <p className="section-label">A mesma frase, lado a lado</p>
        {data.examples.map((example, index) => (
          <div key={index} className="card space-y-2.5">
            <p className="text-xs font-extrabold uppercase tracking-wider text-hare">
              {example.gloss}
            </p>
            <div className="space-y-1.5">
              {example.cells.map((cell) => {
                const column = data.columns.find((c) => c.lang === cell.lang);
                const theme = languageTheme(cell.lang);
                return (
                  <div
                    key={cell.lang}
                    className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 ${
                      column?.isTarget ? 'bg-macaw-soft' : ''
                    }`}
                  >
                    <span className="w-6 shrink-0 text-center">
                      {cell.lang === 'pt' ? '🇧🇷' : theme.flag}
                    </span>
                    <span
                      className={`flex-1 font-bold ${column?.isTarget ? 'text-macaw-dark' : ''}`}
                    >
                      {cell.text}
                    </span>
                    {cell.lang !== 'pt' && (
                      <AudioButton text={cell.text} languageCode={cell.lang} />
                    )}
                  </div>
                );
              })}
            </div>
            {example.note && (
              <p className="rounded-xl bg-snow px-3 py-2 text-sm font-semibold text-wolf">
                {example.note}
              </p>
            )}
          </div>
        ))}
      </section>

      {data.bridge && (
        <section className="rounded-2xl border-2 border-humpback bg-humpback-soft p-4">
          <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-humpback-dark">
            🌉 O que você já sabe que ajuda aqui
          </p>
          <p className="text-sm font-semibold leading-snug text-humpback-dark">{data.bridge}</p>
        </section>
      )}

      {data.trap && (
        <section className="rounded-2xl border-2 border-cardinal bg-cardinal-soft p-4">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-cardinal-dark">
            ⚠️ O erro que essa confusão produz
          </p>
          <p className="font-bold text-cardinal-dark line-through decoration-2">
            {data.trap.wrong}
          </p>
          <p className="font-black text-grass-dark">{data.trap.right}</p>
          <p className="mt-2 text-sm font-semibold text-cardinal-dark/90">{data.trap.why}</p>
        </section>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button className="btn-primary flex-1" onClick={() => setTraining(true)}>
          Treinar este ponto
        </button>
        <button
          className={data.flagged ? 'btn-blue' : 'btn-ghost'}
          onClick={() => flag.mutate(!data.flagged)}
          disabled={flag.isPending}
        >
          {data.flagged ? '★ Marcado como confuso' : '☆ Ainda me confunde'}
        </button>
      </div>

      {flag.isError && (
        <p className="text-sm font-bold text-cardinal-dark">{errorMessage(flag.error)}</p>
      )}
    </div>
  );
}
