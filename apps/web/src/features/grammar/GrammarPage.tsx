import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ProgressBar } from '../../components/ProgressBar';
import { languageTheme, scoreTone } from '../../lib/ui';
import { api } from '../../services/api';
import { InterferencePanel } from './InterferencePanel';
import { TopicView } from './TopicView';
import { TopicSummary } from './types';

/**
 * `short` existe porque o rotulo inteiro nao cabe.
 *
 * Com quatro idiomas num aparelho de 360px sobram 76px por botao, e
 * "Deutsch" com bandeira e respiro precisa de uns 100px. Como `flex-1` nao
 * encolhe um item abaixo do proprio conteudo, a linha estourava para fora da
 * tela e os dois ultimos idiomas ficavam inalcancaveis -- o alemao sumia sem
 * nenhum sinal de que havia algo ali.
 */
const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'es', label: 'Español', short: 'ES' },
  { code: 'de', label: 'Deutsch', short: 'DE' },
  { code: 'ru', label: 'Русский', short: 'RU' },
];

/**
 * Estudo de gramatica por contraste.
 *
 * A tese do modulo: quem estuda quatro idiomas ao mesmo tempo raramente tem
 * duvida DENTRO de um idioma -- tem duvida no descompasso entre eles. Por isso
 * cada topico e apresentado com quem CONFIRMA a intuicao do aluno e quem
 * CONTRASTA com ela, e nao como uma regra solta do idioma alvo.
 */
export function GrammarPage() {
  const [language, setLanguage] = useState('en');
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ topics: TopicSummary[] }>({
    queryKey: ['grammar', 'topics', language],
    queryFn: async () => (await api.get('/grammar/topics', { params: { language } })).data,
  });

  if (openTopic) {
    return (
      <TopicView
        topicId={openTopic}
        languageCode={language}
        onBack={() => setOpenTopic(null)}
      />
    );
  }

  const topics = data?.topics ?? [];
  const flagged = topics.filter((t) => t.flagged);
  const rest = topics.filter((t) => !t.flagged);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight">Estruturas</h1>
        <p className="text-sm font-semibold text-wolf">
          Cada ponto aparece comparado nos cinco idiomas. Você aprende um usando os outros
          como referência — um que confirma sua intuição e um que a quebra.
        </p>
      </header>

      <div className="flex gap-2">
        {LANGUAGES.map((option) => {
          const theme = languageTheme(option.code);
          const active = option.code === language;
          return (
            <button
              key={option.code}
              onClick={() => setLanguage(option.code)}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-b-[4px] px-2 py-2.5 text-sm font-extrabold transition active:translate-y-[2px] active:border-b-2 ${
                active
                  ? `${theme.border} ${theme.soft} ${theme.text}`
                  : 'border-swan bg-white text-wolf hover:bg-snow'
              }`}
            >
              <span aria-hidden>{theme.flag}</span>
              <span className="sm:hidden">{option.short}</span>
              <span className="hidden truncate sm:inline">{option.label}</span>
            </button>
          );
        })}
      </div>

      {/*
        Vem antes da lista de topicos de proposito: o que o aluno esta errando
        de verdade vale mais que o catalogo inteiro em ordem. O painel some
        sozinho quando nao ha interferencia registrada.
      */}
      <InterferencePanel onOpenTopic={setOpenTopic} />

      {isLoading ? (
        <div className="card flex min-h-[12rem] items-center justify-center">
          <span className="animate-float text-5xl">🧩</span>
        </div>
      ) : (
        <div className="space-y-5">
          {flagged.length > 0 && (
            <section className="space-y-2.5">
              <p className="section-label">Você marcou como confuso</p>
              {flagged.map((topic) => (
                <TopicCard key={topic.id} topic={topic} onOpen={() => setOpenTopic(topic.id)} />
              ))}
            </section>
          )}

          <section className="space-y-2.5">
            {flagged.length > 0 && <p className="section-label">Todos os pontos</p>}
            {rest.map((topic) => (
              <TopicCard key={topic.id} topic={topic} onOpen={() => setOpenTopic(topic.id)} />
            ))}
          </section>
        </div>
      )}
    </div>
  );
}

function TopicCard({ topic, onOpen }: { topic: TopicSummary; onOpen: () => void }) {
  const tone = scoreTone(topic.mastery);
  const started = topic.attempts > 0;

  return (
    <button
      onClick={onOpen}
      className="card w-full space-y-2.5 text-left transition hover:bg-snow active:translate-y-[1px]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-black leading-snug">{topic.title}</p>
          <p className="text-sm font-semibold text-wolf">{topic.question}</p>
        </div>
        <span className="chip shrink-0 bg-snow text-wolf">{topic.level}</span>
      </div>

      {/* O par de apoio e a informacao mais importante do card: e ele que diz
          por qual caminho o aluno vai entender o ponto. */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
        {topic.allyName ? (
          <span className="chip bg-grass-soft text-grass-dark">
            {topic.allyName} confirma
          </span>
        ) : (
          <span className="chip bg-snow text-wolf">sem paralelo</span>
        )}
        {topic.contrastName && (
          <span className="chip bg-cardinal-soft text-cardinal-dark">
            {topic.contrastName} contrasta
          </span>
        )}
      </div>

      {started && (
        <div className="flex items-center gap-2.5">
          <ProgressBar value={topic.mastery} max={100} size="sm" tone={tone.bar} />
          <span className={`shrink-0 text-xs font-extrabold ${tone.text}`}>
            {Math.round(topic.mastery)}%
          </span>
        </div>
      )}
    </button>
  );
}
