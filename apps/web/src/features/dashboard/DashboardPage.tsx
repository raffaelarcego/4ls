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
      <div className="card border-cardinal bg-cardinal-soft text-center">
        <p className="text-4xl">😵</p>
        <p className="mt-2 font-extrabold text-cardinal-dark">Não deu para carregar seu dia.</p>
        <p className="text-sm font-semibold text-wolf">
          Verifique se a API está no ar e recarregue.
        </p>
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
        <h1 className="text-2xl font-black tracking-tight">
          {greeting()}
          {streak.current > 0 && (
            <span className="ml-2 align-middle text-base font-extrabold text-beak">
              🔥 {streak.current} {streak.current === 1 ? 'dia' : 'dias'} seguidos
            </span>
          )}
        </h1>
        <p className="text-sm font-semibold text-wolf">
          {session.plannedMinutes} minutos montados a partir do seu desempenho.
        </p>
      </header>

      {/*
        O "porque" da sessao e um requisito do produto: o usuario precisa
        entender qual criterio gerou o plano de hoje. Aqui ele vira a fala
        da coruja, em vez de uma nota de rodape.
      */}
      {session.rationale && (
        <div className="flex items-start gap-3">
          <span aria-hidden className="animate-float text-4xl leading-none">
            🦉
          </span>
          <div className="relative flex-1 rounded-2xl border-2 border-swan bg-white p-3.5 text-sm font-semibold text-eel">
            <span className="absolute -left-[9px] top-4 h-4 w-4 rotate-45 border-b-2 border-l-2 border-swan bg-white" />
            {session.rationale}
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border-2 border-swan">
        <div className="bg-grass p-5 text-white">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-white/75">
                Missão de hoje
              </p>
              <p className="text-2xl font-black">
                {total > 0 && done === total ? 'Tudo feito!' : `${total - done} blocos restantes`}
              </p>
            </div>
            <span className="text-4xl font-black tabular-nums text-white/90">
              {done}
              <span className="text-xl text-white/60">/{total}</span>
            </span>
          </div>
          <div className="mt-3 rounded-full bg-black/15 p-0.5">
            <ProgressBar value={done} max={total || 1} tone="bg-white" size="lg" />
          </div>
        </div>

        <div className="bg-white p-3">
          {session.activities.map((activity, index) => (
            <PathNode
              key={activity.id}
              activity={activity}
              isNext={index === nextIndex}
              isLast={index === session.activities.length - 1}
              onStart={() => navigate(`/sessao?activity=${activity.id}`)}
            />
          ))}
        </div>

        <div className="border-t-2 border-swan p-4">
          <button
            className="btn-primary w-full py-4 text-base"
            onClick={() => navigate('/sessao')}
            disabled={session.completed}
          >
            {session.completed
              ? 'Missão concluída'
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
        <div className="card flex items-start gap-3 border-bee bg-bee-soft">
          <span aria-hidden className="text-2xl">
            🔌
          </span>
          <p className="text-sm font-semibold text-eel">
            Nenhum provider de IA configurado. O tutor e a geração de exercícios ficam
            indisponíveis até você preencher <code className="font-black">MIMO_API_KEY</code> ou{' '}
            <code className="font-black">OPENROUTER_API_KEY</code> no .env do backend. O resto do
            sistema funciona normalmente.
          </p>
        </div>
      )}
    </div>
  );
}

/** Um passo da trilha: bolinha colorida, o que e, e por que foi recomendado. */
function PathNode({
  activity,
  isNext,
  isLast,
  onStart,
}: {
  activity: SessionActivity;
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
        activity.completed ? '' : 'rounded-2xl transition hover:bg-snow'
      }`}
    >
      {/* Fio que liga um passo ao proximo. */}
      {!isLast && (
        <span
          aria-hidden
          className={`absolute left-[29px] top-[3.75rem] h-[calc(100%-2.75rem)] w-1 rounded-full ${
            activity.completed ? 'bg-grass/40' : 'bg-swan'
          }`}
        />
      )}

      <span
        className={`relative z-[1] mt-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl ${
          activity.completed
            ? 'bg-grass text-white shadow-[0_4px_0_theme(colors.grass-dark)]'
            : `${language.soft} border-2 ${language.border}`
        } ${isNext ? 'ring-4 ring-macaw/25' : ''}`}
      >
        {activity.completed ? '✓' : theme.emoji}
      </span>

      <div className="min-w-0 flex-1 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={`truncate font-extrabold ${
              activity.completed ? 'text-hare line-through' : 'text-eel'
            }`}
          >
            <span aria-hidden>{language.flag} </span>
            {theme.label}
          </p>
          <span className="shrink-0 text-xs font-extrabold uppercase tracking-wider text-hare">
            {activity.plannedMinutes} min
          </span>
        </div>
        <p className="truncate text-xs font-semibold text-wolf">{activity.reason ?? theme.blurb}</p>
        {isNext && <span className="chip mt-1.5 bg-macaw-soft text-macaw-dark">Você está aqui</span>}
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
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 text-2xl ${theme.soft} ${theme.border}`}
        >
          {theme.flag}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-black">{language.name}</h3>
          <p className="text-xs font-extrabold uppercase tracking-wider text-hare">
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
              <span className="w-24 shrink-0 truncate text-xs font-extrabold text-wolf">
                <span aria-hidden>{meta.emoji}</span> {meta.label}
              </span>
              <ProgressBar value={value} size="sm" tone={tone.bar} />
              <span className={`w-9 shrink-0 text-right text-xs font-black tabular-nums ${tone.text}`}>
                {Math.round(value)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-t-2 border-swan pt-3">
        <span className="text-xs font-extrabold uppercase tracking-wider text-hare">
          {language.vocabulary.total} termos
        </span>
        <span
          className={`chip ${
            language.dueReviews > 0 ? 'bg-beak/15 text-beak' : 'bg-grass-soft text-grass-dark'
          }`}
        >
          {language.dueReviews > 0 ? `${language.dueReviews} p/ revisar` : 'em dia'}
        </span>
      </div>

      {language.topErrors.length > 0 && (
        <div className="rounded-xl bg-snow p-3">
          <p className="section-title mb-1.5">Onde você tropeça</p>
          <ul className="space-y-1">
            {language.topErrors.map((error) => (
              <li
                key={error.id}
                className="flex items-baseline justify-between gap-2 text-xs font-semibold text-eel"
              >
                <span className="truncate">{error.description}</span>
                <span className="shrink-0 font-black text-cardinal">{error.occurrenceCount}x</span>
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
  if (hour < 6) return 'Ainda acordado? 🌙';
  if (hour < 12) return 'Bom dia! ☀️';
  if (hour < 18) return 'Boa tarde! 👋';
  return 'Boa noite! 🌆';
}
