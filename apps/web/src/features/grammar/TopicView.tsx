import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UIEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

  /*
   * O treino e mais um nivel de navegacao, entao mora na URL junto com o
   * topico: entrar empilha uma entrada e sair e `navigate(-1)`. Com useState o
   * gesto de voltar do celular pulava do drill direto para fora do modulo.
   */
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const training = params.get('treino') === '1';

  const [column, setColumn] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [training]);

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
      <div>
        <div className="card flex min-h-[16rem] items-center justify-center">
          <p className="text-sm text-wolf">Carregando a comparação...</p>
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
          queryClient.invalidateQueries({ queryKey: ['grammar'] });
          navigate(-1);
        }}
      />
    );
  }

  // O indicador de colunas so e util enquanto o carrossel existe -- no desktop
  // as colunas cabem lado a lado e o indice nao significa nada.
  function handleColumnScroll(event: UIEvent<HTMLDivElement>) {
    const strip = event.currentTarget;
    const card = strip.firstElementChild as HTMLElement | null;
    if (!card) return;
    const step = card.offsetWidth + 10;
    setColumn(Math.round(strip.scrollLeft / step));
  }

  return (
    // A margem lateral vem do <main> do Layout; repetir aqui estreitava o
    // carrossel de comparacao justamente onde ele precisa de largura.
    <div className="space-y-5">
      <button onClick={onBack} className="btn-plain tap-target -ml-3 text-sm">
        ← Voltar
      </button>

      <header className="space-y-1.5">
        <h1 className="font-serif text-2xl font-semibold leading-tight text-eel">{data.title}</h1>
        <p className="text-wolf">{data.question}</p>
      </header>

      {/*
        Tabela de comparacao: uma coluna por idioma, alvo primeiro.

        No celular ela e um carrossel, nao uma tabela. Antes eram cards de 240px
        numa faixa de ~1250px vista por uma janela de 360px, dentro de um
        scroller vertical e sem nenhum sinal de que havia mais coisa a direita --
        na pratica o aluno lia so a primeira coluna. Agora o card mede pela
        viewport (o proximo aparece pela borda, entao da para adivinhar o gesto),
        o snap encaixa uma coluna por vez e o contador diz quantas existem.
      */}
      <section className="space-y-2">
        <div
          onScroll={handleColumnScroll}
          className="hscroll -mx-4 flex snap-x snap-mandatory gap-2.5 px-4 pb-1"
        >
          {data.columns.map((col) => {
            const label = roleLabel(col);
            return (
              <div
                key={col.lang}
                className={`w-[85vw] max-w-xs shrink-0 snap-start space-y-2 rounded-lg border p-3.5 ${columnStyle(col)}`}
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden className="font-serif text-lg">
                    {languageTheme(col.lang).mark}
                  </span>
                  <span className="font-serif text-sm font-semibold capitalize">{col.name}</span>
                </div>
                {label && <p className="text-xs text-wolf">{label}</p>}
                <p className="text-sm leading-snug">{col.behavior}</p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-hare">
            {Math.min(column + 1, data.columns.length)}/{data.columns.length}
          </span>
          <span className="text-xs text-hare">idiomas — deslize para comparar</span>
        </div>
      </section>

      {/* Frases paralelas: a mesma ideia escrita nos quatro idiomas. E aqui que
          o contraste deixa de ser explicacao e vira percepcao. */}
      <section className="space-y-3">
        <p className="section-label">A mesma frase, lado a lado</p>
        {data.examples.map((example, index) => (
          <div key={index} className="card space-y-2.5">
            <p className="text-xs text-hare">{example.gloss}</p>
            <div className="space-y-1.5">
              {example.cells.map((cell) => {
                const col = data.columns.find((c) => c.lang === cell.lang);
                return (
                  <div
                    key={cell.lang}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 ${
                      col?.isTarget ? 'bg-macaw-soft' : ''
                    }`}
                  >
                    <span aria-hidden className="w-6 shrink-0 text-center font-serif">
                      {languageTheme(cell.lang).mark}
                    </span>
                    {/* `min-w-0`: sem ele um composto alemao longo nao quebra e
                        empurra o botao de audio para fora da tela em 360px. */}
                    <span
                      lang={cell.lang}
                      className={`min-w-0 flex-1 font-medium ${col?.isTarget ? 'text-macaw-dark' : ''}`}
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
              <p className="rounded-md bg-snow px-3 py-2 text-sm text-wolf">{example.note}</p>
            )}
          </div>
        ))}
      </section>

      {data.bridge && (
        <section className="rounded-lg border border-humpback bg-humpback-soft p-4">
          <p className="mb-1 font-serif text-sm font-semibold text-humpback-dark">
            O que você já sabe que ajuda aqui
          </p>
          <p className="text-sm leading-snug text-humpback-dark">{data.bridge}</p>
        </section>
      )}

      {data.trap && (
        <section className="rounded-lg border border-cardinal bg-cardinal-soft p-4">
          <p className="mb-2 font-serif text-sm font-semibold text-cardinal-dark">
            O erro que essa confusão produz
          </p>
          <p lang={languageCode} className="text-cardinal-dark line-through">
            {data.trap.wrong}
          </p>
          <p lang={languageCode} className="font-semibold text-grass-dark">
            {data.trap.right}
          </p>
          <p className="mt-2 text-sm text-cardinal-dark/90">{data.trap.why}</p>
        </section>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button
          className="btn-primary flex-1"
          onClick={() => setParams({ topico: topicId, treino: '1' })}
        >
          Treinar este ponto
        </button>
        <button
          className={data.flagged ? 'btn-blue' : 'btn-ghost'}
          onClick={() => flag.mutate(!data.flagged)}
          disabled={flag.isPending}
        >
          {data.flagged ? 'Marcado como confuso' : 'Ainda me confunde'}
        </button>
      </div>

      {flag.isError && <p className="text-sm text-cardinal-dark">{errorMessage(flag.error)}</p>}
    </div>
  );
}
