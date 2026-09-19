import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Hero } from '../../components/Hero';
import { ProgressBar } from '../../components/ProgressBar';
import { activityTheme, languageTheme, scoreTone, SKILL_LABEL } from '../../lib/ui';
import { api } from '../../services/api';
import { DashboardData, DashboardLanguage, SessionActivity, XpSummary } from '../../types';
import { PracticePicker } from './PracticePicker';

/** XP de cada tipo de bloco -- a mesma tabela do backend (`xp.rules.ts`). */
const XP_BY_TYPE: Record<string, number> = {
  review: 10,
  listening: 10,
  reading: 10,
  vocabulary: 15,
  structure: 20,
  alphabet: 20,
  foundation: 20,
  contrast: 15,
  compare: 30,
  grammar: 15,
  dictation: 15,
  writing: 20,
  speaking: 25,
  production: 40,
  tutor: 50,
};

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
        <p className="font-serif font-bold text-cardinal-dark">Não deu para carregar seu dia.</p>
        <p className="text-sm text-wolf">Verifique se a API está no ar e recarregue.</p>
      </div>
    );
  }

  const { session, languages, streak, xp } = data;
  const done = session.activities.filter((a) => a.completed).length;
  const total = session.activities.length;
  const nextIndex = session.activities.findIndex((a) => !a.completed);
  const allDone = total > 0 && done === total;

  // O XP que ainda esta em jogo hoje: e o que transforma a lista de blocos numa
  // recompensa pendente em vez de uma lista de tarefas.
  const xpLeft = session.activities
    .filter((a) => !a.completed)
    .reduce((sum, a) => sum + (XP_BY_TYPE[a.type] ?? 10), 0);

  return (
    <div className="space-y-6">
      <LevelBanner xp={xp} streak={streak.current} allDone={allDone} />

      {/*
        O "porque" da sessao continua sendo requisito do produto: o aluno precisa
        entender qual criterio gerou o plano de hoje. Virou fala do personagem --
        a informacao e a mesma, mas agora tem alguem dizendo.
      */}
      {session.rationale && (
        <p className="rounded-xl border border-swan bg-white px-4 py-3 text-sm leading-snug text-wolf">
          {session.rationale}
        </p>
      )}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="section-title">Missão de hoje</h2>
            <p className="text-xs text-hare">
              {allDone ? 'Tudo conquistado.' : `${total - done} de ${total} blocos restantes`}
            </p>
          </div>
          {xpLeft > 0 && (
            <span className="chip border-bee text-bee">+{xpLeft} XP em jogo</span>
          )}
        </div>

        <div className="relative">
          {session.activities.map((activity, index) => (
            <TrailNode
              key={activity.id}
              activity={activity}
              index={index}
              isNext={index === nextIndex}
              isLast={index === session.activities.length - 1}
              onStart={() => navigate(`/sessao?activity=${activity.id}`)}
            />
          ))}
        </div>

        <button
          className="btn-primary w-full py-4 text-base"
          onClick={() => navigate('/sessao')}
          disabled={session.completed}
        >
          {session.completed
            ? 'Missão concluída'
            : done > 0
              ? 'Continuar missão'
              : 'Iniciar missão'}
        </button>
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

/**
 * O topo: quem voce e, quanto falta para subir, e o personagem reagindo.
 *
 * O nivel fica acima de tudo porque e a unica coisa da tela que responde "estou
 * chegando aonde?". A sequencia entra ao lado e nao no meio de uma frase, como
 * estava antes -- sequencia escondida em texto corrido nao segura ninguem.
 */
function LevelBanner({
  xp,
  streak,
  allDone,
}: {
  xp: XpSummary;
  streak: number;
  allDone: boolean;
}) {
  const { progress } = xp;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-swan bg-white p-5">
      {/* Halo do nivel atras do personagem. */}
      <div
        className="pointer-events-none absolute -right-6 -top-10 h-40 w-40 rounded-full bg-macaw opacity-[0.07] blur-2xl"
        aria-hidden
      />

      <div className="relative flex items-center gap-4">
        <Hero
          mood={allDone ? 'cheer' : streak === 0 ? 'sad' : 'idle'}
          size="md"
          accent={allDone ? 'text-grass' : 'text-macaw'}
          className="shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl font-bold leading-none text-eel">
              Nível {progress.level}
            </span>
            <span className="truncate text-xs font-bold uppercase tracking-wide text-macaw">
              {progress.title}
            </span>
          </div>

          <div className="mt-2.5">
            {/* A barra ganha um brilho que atravessa: e o unico lugar do app com
                movimento continuo, e e ele que diz "isto aqui enche". */}
            <div className="relative overflow-hidden rounded-full">
              <ProgressBar
                value={progress.xpIntoLevel}
                max={progress.xpForLevel}
                tone="bg-bee"
                size="lg"
                trackClassName="bg-snow"
              />
              <span
                className="animate-sheen pointer-events-none absolute inset-y-0 w-8 bg-white/25 blur-sm"
                aria-hidden
              />
            </div>
            <p className="mt-1.5 text-[11px] text-hare">
              <span className="stat">{progress.xpIntoLevel}</span>
              <span className="text-hare">/{progress.xpForLevel} XP</span>
              {' · faltam '}
              <span className="stat">{progress.xpRemaining}</span>
              {' para o nível '}
              {progress.level + 1}
            </p>
          </div>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-2 border-t border-swan pt-3">
        <Stat value={streak} label={streak === 1 ? 'dia seguido' : 'dias seguidos'} tone="text-bee" />
        <Stat value={xp.today} label="XP hoje" tone="text-grass" />
        <Stat value={xp.total} label="XP total" tone="text-macaw" />
      </div>
    </section>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="text-center">
      <p className={`font-mono text-xl font-bold tabular-nums leading-none ${tone}`}>{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-hare">{label}</p>
    </div>
  );
}

/**
 * Um no da trilha.
 *
 * O zigue-zague nao e enfeite: ele e o que transforma uma lista numa TRILHA.
 * Uma coluna reta de cartoes le como lista de tarefas -- e lista de tarefas e
 * exatamente a sensacao que este redesenho veio tirar. O deslocamento
 * alternado, com a linha ligando um no ao seguinte, faz o olho ler percurso.
 *
 * Tres estados, e so o do meio e clicavel a primeira vista:
 * - conquistado: preenchido, com o visto.
 * - atual: halo pulsando, e o unico com brilho.
 * - a seguir: apagado, mas ainda tocavel -- o aluno pode pular a ordem se
 *   quiser, e tirar isso dele seria uma regressao do que ja funcionava.
 */
function TrailNode({
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
  const xpValue = XP_BY_TYPE[activity.type] ?? 10;

  // Quatro posicoes ciclicas: centro, direita, centro, esquerda. Um seno
  // discreto -- o suficiente para ler caminho, longe o bastante de virar
  // labirinto em 360px de largura.
  const offsets = ['translate-x-0', 'translate-x-6', 'translate-x-0', '-translate-x-6'];
  const offset = offsets[index % offsets.length];

  const done = activity.completed;
  const Wrapper = done ? 'div' : 'button';

  return (
    <div className="relative flex flex-col items-center">
      <Wrapper
        {...(done
          ? {}
          : { onClick: onStart, type: 'button' as const, 'aria-label': `Começar ${theme.label}` })}
        className={`relative z-10 flex w-full max-w-sm items-center gap-3 rounded-xl border p-3 transition-transform ${offset} ${
          done
            ? 'border-swan bg-snow opacity-60'
            : isNext
              ? 'border-macaw bg-white'
              : 'border-swan bg-white active:scale-[0.98]'
        }`}
      >
        <span
          className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 font-mono text-base font-bold ${
            done
              ? 'border-grass bg-grass text-snow'
              : `${language.border} ${language.soft} ${language.text}`
          }`}
        >
          {/* Halo pulsando, so no no atual. */}
          {isNext && (
            <span
              className={`absolute inset-0 -z-10 animate-halo rounded-full ${language.bg} opacity-40`}
              aria-hidden
            />
          )}
          {done ? '✓' : language.mark}
        </span>

        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-baseline justify-between gap-2">
            <p className={`truncate font-bold ${done ? 'text-hare line-through' : 'text-eel'}`}>
              {theme.label}
            </p>
            <span className={`shrink-0 font-mono text-xs font-bold ${done ? 'text-hare' : 'text-bee'}`}>
              {done ? '✓' : `+${xpValue}`}
            </span>
          </div>
          <p className="line-clamp-2 text-xs leading-snug text-wolf">
            {activity.reason ?? theme.blurb}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-hare">
            {activity.languageName} · {activity.plannedMinutes} min
          </p>
        </div>
      </Wrapper>

      {/* O trecho de caminho ate o proximo no. */}
      {!isLast && (
        <span
          className={`h-4 w-1 rounded-full ${done ? 'bg-grass opacity-50' : 'bg-swan'}`}
          aria-hidden
        />
      )}
    </div>
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
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 font-mono text-lg font-bold ${theme.soft} ${theme.border} ${theme.text}`}
        >
          {theme.mark}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-serif font-bold text-eel">{language.name}</h3>
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
            language.dueReviews > 0 ? 'border-bee text-bee' : 'border-grass text-grass'
          }`}
        >
          {language.dueReviews > 0 ? `${language.dueReviews} p/ revisar` : 'em dia'}
        </span>
      </div>

      {language.topErrors.length > 0 && (
        <div className="rounded-xl bg-snow p-3">
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
      <div className="h-40 animate-pulse rounded-2xl bg-white" />
      <div className="h-8 w-56 animate-pulse rounded-xl bg-white" />
      <div className="space-y-2">
        <div className="h-20 animate-pulse rounded-xl bg-white" />
        <div className="h-20 animate-pulse rounded-xl bg-white" />
        <div className="h-20 animate-pulse rounded-xl bg-white" />
      </div>
    </div>
  );
}
