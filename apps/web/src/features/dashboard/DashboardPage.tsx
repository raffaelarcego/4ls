import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ProgressBar } from '../../components/ProgressBar';
import { activityTheme, languageTheme, scoreTone, SKILL_LABEL } from '../../lib/ui';
import { api } from '../../services/api';
import { DashboardData, DashboardLanguage, SessionActivity } from '../../types';
import { PracticePicker } from './PracticePicker';

export function DashboardPage() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard');
      return data;
    },
  });

  if (isLoading) return <LoadingState />;

  if (isError || !data) {
    return (
      <div className="card border-cardinal bg-cardinal-soft">
        <p className="font-serif font-semibold text-cardinal-dark">Não deu para carregar seu dia.</p>
        <p className="text-sm text-wolf">Verifique se a API está no ar e recarregue.</p>
      </div>
    );
  }

  const { session, languages, streak } = data;
  const done = session.activities.filter((a) => a.completed).length;
  const total = session.activities.length;
  const nextIndex = session.activities.findIndex((a) => !a.completed);

  return (
    <div className="space-y-7">
      <header>
        <p className="font-mono text-xs text-hare">{today()}</p>
        <h1 className="mt-0.5 font-serif text-2xl font-semibold tracking-tight text-eel">
          {greeting()}
        </h1>
        <p className="text-sm text-wolf">
          {session.plannedMinutes} minutos montados a partir do seu desempenho
          {streak.current > 0 &&
            `, ${streak.current}${streak.current === 1 ? 'º dia seguido' : 'º dia seguido de sequência'}`}
          .
        </p>
      </header>

      {/*
        O "porque" da sessao e um requisito do produto: o usuario precisa
        entender qual criterio gerou o plano de hoje. Uma nota de margem,
        como quem anota o motivo ao lado do registro.
      */}
      {session.rationale && (
        <p className="border-l-2 border-swan pl-3 font-serif text-sm italic leading-snug text-wolf">
          {session.rationale}
        </p>
      )}

      <section className="overflow-hidden rounded-lg border border-swan">
        <div className="bg-grass p-5 text-snow">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs text-snow/70">Sessão de hoje</p>
              <p className="font-serif text-xl font-semibold">
                {total > 0 && done === total ? 'Tudo feito' : `${total - done} blocos restantes`}
              </p>
            </div>
            <span className="font-mono text-2xl tabular-nums text-snow/90">
              {done}
              <span className="text-base text-snow/50">/{total}</span>
            </span>
          </div>
          <div className="mt-3">
            <ProgressBar value={done} max={total || 1} tone="bg-snow" size="lg" trackClassName="bg-black/15" />
          </div>
        </div>

        <div className="bg-white p-3">
          {session.activities.map((activity, index) => (
            <PathNode
              key={activity.id}
              activity={activity}
              index={index}
              isNext={index === nextIndex}
              isLast={index === session.activities.length - 1}
              onStart={() => navigate(`/sessao?activity=${activity.id}`)}
            />
          ))}
        </div>

        <div className="border-t border-swan p-4">
          <button
            className="btn-primary w-full py-4 text-base"
            onClick={() => navigate('/sessao')}
            disabled={session.completed}
          >
            {session.completed
              ? 'Sessão concluída'
              : done > 0
                ? 'Continuar de onde parei'
                : 'Começar agora'}
          </button>
        </div>
      </section>

      <PracticePicker languages={languages} />

      <section className="space-y-3">
        <h2 className="section-title">Seus idiomas</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {languages.map((language) => (
            <LanguageCard key={language.code} language={language} />
          ))}
        </div>
      </section>

      {!data.aiEnabled && (
        <div className="card border-bee bg-bee-soft">
          <p className="text-sm text-eel">
            Nenhum provider de IA configurado. O tutor e a geração de exercícios ficam
            indisponíveis até você preencher <code className="font-mono">MIMO_API_KEY</code> ou{' '}
            <code className="font-mono">OPENROUTER_API_KEY</code> no .env do backend. O resto do
            sistema funciona normalmente.
          </p>
        </div>
      )}
    </div>
  );
}

/** Uma linha de registro: numero da entrada, o que e, e por que foi recomendado. */
function PathNode({
  activity,
  index,
  isNext,
  isLast,
  onStart,
}: {
  activity: SessionActivity;
  index: number;
  isNext: boolean;
  isLast: boolean;
  onStart: () => void;
}) {
  const theme = activityTheme(activity.type);
  const language = languageTheme(activity.languageCode);

  // Bloco ja feito nao volta atras; os demais podem ser iniciados fora de ordem.
  const Wrapper = activity.completed ? 'div' : 'button';

  return (
    <Wrapper
      {...(activity.completed
        ? {}
        : { onClick: onStart, type: 'button' as const, 'aria-label': `Começar ${theme.label}` })}
      className={`relative flex w-full gap-3 pl-1 text-left ${
        activity.completed ? '' : 'rounded-md transition hover:bg-snow'
      } ${!isLast ? 'border-b border-swan' : ''}`}
    >
      <span
        className={`mt-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border font-mono text-sm ${
          activity.completed
            ? 'border-grass bg-grass text-snow'
            : `${language.soft} ${language.border} ${language.text}`
        } ${isNext ? 'ring-1 ring-offset-1 ring-macaw' : ''}`}
      >
        {activity.completed ? '✓' : index + 1}
      </span>

      <div className="min-w-0 flex-1 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`truncate font-medium ${activity.completed ? 'text-hare line-through' : 'text-eel'}`}>
            <span className={`mr-1 font-mono ${language.text}`}>{language.mark}</span>
            {theme.label}
          </p>
          <span className="shrink-0 font-mono text-xs text-hare">{activity.plannedMinutes} min</span>
        </div>
        {/* Duas linhas, nao uma. O motivo do bloco e o que responde "por que
            isto hoje?" -- cortado em "Como este idioma monta a frase. Saber ..."
            ele deixa de responder e vira ruido. Duas linhas cobrem os motivos
            que o planejador realmente escreve. */}
        <p className="line-clamp-2 text-xs leading-snug text-wolf">{activity.reason ?? theme.blurb}</p>
        {isNext && <span className="chip mt-1.5 border-macaw bg-macaw-soft text-macaw-dark">você está aqui</span>}
      </div>
    </Wrapper>
  );
}

function LanguageCard({ language }: { language: DashboardLanguage }) {
  const theme = languageTheme(language.code);
  const skills = (['listening', 'reading', 'writing', 'speaking', 'grammar'] as const).map(
    (key) => ({ key, value: language.skills[key] }),
  );

  return (
    <div className="card space-y-3.5">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border font-mono text-lg ${theme.soft} ${theme.border} ${theme.text}`}
        >
          {theme.mark}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-serif font-semibold text-eel">{language.name}</h3>
          <p className="font-mono text-xs text-hare">
            {language.currentLevel} → {language.targetLevel}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {skills.map(({ key, value }) => {
          const meta = SKILL_LABEL[key];
          const tone = scoreTone(value);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-xs text-wolf">{meta.label}</span>
              <ProgressBar value={value} size="sm" tone={tone.bar} />
              <span className={`w-9 shrink-0 text-right font-mono text-xs ${tone.text}`}>
                {Math.round(value)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-swan pt-3">
        <span className="font-mono text-xs text-hare">{language.vocabulary.total} termos</span>
        <span
          className={`chip ${
            language.dueReviews > 0 ? 'border-beak text-beak' : 'border-grass-soft bg-grass-soft text-grass-dark'
          }`}
        >
          {language.dueReviews > 0 ? `${language.dueReviews} p/ revisar` : 'em dia'}
        </span>
      </div>

      {language.topErrors.length > 0 && (
        <div className="rounded-md bg-snow p-3">
          <p className="mb-1.5 text-xs text-wolf">Onde você tropeça</p>
          <ul className="space-y-1">
            {language.topErrors.map((error) => (
              <li key={error.id} className="flex items-baseline justify-between gap-2 text-xs text-eel">
                <span className="truncate">{error.description}</span>
                <span className="shrink-0 font-mono text-cardinal">{error.occurrenceCount}×</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-56 animate-pulse rounded-xl bg-snow" />
      <div className="h-44 animate-pulse rounded-2xl bg-snow" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-56 animate-pulse rounded-2xl bg-snow" />
        <div className="h-56 animate-pulse rounded-2xl bg-snow" />
      </div>
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Ainda acordado?';
  if (hour < 12) return 'Bom dia.';
  if (hour < 18) return 'Boa tarde.';
  return 'Boa noite.';
}

function today(): string {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}
