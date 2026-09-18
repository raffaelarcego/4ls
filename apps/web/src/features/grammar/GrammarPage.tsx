import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

  /*
   * Qual topico esta aberto vive na URL, e nao num useState.
   *
   * Com estado local o modulo trocava de tela sem trocar de historico: o botao
   * voltar do Android e o gesto de voltar do iOS saiam do modulo inteiro em vez
   * de recuar um nivel. Abrir um topico empilha uma entrada; voltar e sempre
   * `navigate(-1)`, entao o botao da tela e o gesto do sistema fazem a mesma
   * coisa.
   */
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const openTopic = params.get('topico');

  // Cada nivel comeca do proprio topo -- herdar a rolagem do nivel anterior
  // abria o topico no meio da tabela de comparacao.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [openTopic]);

  const { data, isLoading } = useQuery<{ topics: TopicSummary[] }>({
    queryKey: ['grammar', 'topics', language],
    queryFn: async () => (await api.get('/grammar/topics', { params: { language } })).data,
  });

  function openTopicById(topicId: string) {
    setParams({ topico: topicId });
  }

  if (openTopic) {
    return (
      <TopicView topicId={openTopic} languageCode={language} onBack={() => navigate(-1)} />
    );
  }

  const topics = data?.topics ?? [];
  const flagged = topics.filter((t) => t.flagged);
  const rest = topics.filter((t) => !t.flagged);

  return (
    // Sem `max-w-3xl px-4` proprio: o <main> do Layout ja centraliza e ja da a
    // margem lateral. Repetir aqui comia 32px dos 360px do celular.
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-serif text-2xl font-semibold text-eel">Estruturas</h1>
        <p className="text-sm text-wolf">
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
              // `tap-target` porque com quatro idiomas o botao ja e estreito;
              // se for tambem baixo (38px) vira o controle mais errado da tela.
              className={`tap-target flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-sm font-medium transition-colors ${
                active
                  ? `${theme.border} ${theme.soft} ${theme.text}`
                  : 'border-swan bg-white text-wolf hover:bg-snow'
              }`}
            >
              <span aria-hidden>{theme.mark}</span>
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
      <InterferencePanel onOpenTopic={openTopicById} />

      {isLoading ? (
        <div className="card flex min-h-[12rem] items-center justify-center">
          <p className="text-sm text-wolf">Carregando os pontos...</p>
        </div>
      ) : (
        <div className="space-y-5">
          {flagged.length > 0 && (
            <section className="space-y-2.5">
              <p className="section-label">Você marcou como confuso</p>
              {flagged.map((topic) => (
                <TopicCard key={topic.id} topic={topic} onOpen={() => openTopicById(topic.id)} />
              ))}
            </section>
          )}

          <section className="space-y-2.5">
            {flagged.length > 0 && <p className="section-label">Todos os pontos</p>}
            {rest.map((topic) => (
              <TopicCard key={topic.id} topic={topic} onOpen={() => openTopicById(topic.id)} />
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
      className="card w-full space-y-2.5 text-left transition-colors hover:bg-snow"
    >
      <div className="flex items-start justify-between gap-3">
        {/* `min-w-0`: sem isso um titulo com composto alemao longo empurra o
            chip de nivel para fora da tela em 360px. */}
        <div className="min-w-0 space-y-1">
          <p className="font-serif font-semibold leading-snug text-eel">{topic.title}</p>
          <p className="text-sm text-wolf">{topic.question}</p>
        </div>
        <span className="chip shrink-0 bg-snow text-wolf">{topic.level}</span>
      </div>

      {/* O par de apoio e a informacao mais importante do card: e ele que diz
          por qual caminho o aluno vai entender o ponto. */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
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
          <span className={`shrink-0 font-mono text-xs ${tone.text}`}>
            {Math.round(topic.mastery)}%
          </span>
        </div>
      )}
    </button>
  );
}
