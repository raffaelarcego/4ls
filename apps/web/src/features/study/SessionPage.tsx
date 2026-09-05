import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CloseIcon } from '../../components/Icons';
import { ProgressBar } from '../../components/ProgressBar';
import { activityTheme, languageTheme, PILLAR_LABEL } from '../../lib/ui';
import { api } from '../../services/api';
import { SessionActivity, StudySession } from '../../types';
import { GenericRunner } from './GenericRunner';
import { ReviewRunner } from './ReviewRunner';

export function SessionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const targetId = searchParams.get('activity');
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState<{ xp: number; achievements: string[] } | null>(null);

  const { data: session, isLoading } = useQuery<StudySession>({
    queryKey: ['session', 'today'],
    queryFn: async () => {
      const { data } = await api.get('/study/today');
      return data;
    },
  });

  /**
   * Normalmente a atividade corrente e a primeira ainda nao concluida. Com
   * `?activity=<id>` na URL, o aluno pediu um bloco especifico -- e assim que
   * ele termina, a sessao volta sozinha para a ordem do planejador.
   */
  const current: SessionActivity | undefined = useMemo(() => {
    if (targetId) {
      const target = session?.activities.find((a) => a.id === targetId);
      if (target && !target.completed) return target;
    }
    return session?.activities.find((a) => !a.completed);
  }, [session, targetId]);

  // Cronometro da atividade: zera sempre que a atividade muda.
  useEffect(() => {
    setElapsed(0);
    if (!current) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [current?.id]);

  const completeActivity = useMutation({
    mutationFn: async ({ id, score }: { id: string; score?: number }) => {
      const { data } = await api.post(`/study/activities/${id}/complete`, {
        durationSeconds: elapsed,
        ...(score !== undefined ? { score } : {}),
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const completeSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await api.post(`/study/sessions/${sessionId}/complete`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['session', 'today'] });
      setFinished({
        xp: data.session?.xpEarned ?? 0,
        achievements: (data.newAchievements ?? []).map((a: { name: string }) => a.name),
      });
    },
  });

  if (isLoading || !session) {
    return (
      <Shell>
        <div className="mx-auto max-w-md space-y-3 pt-20 text-center">
          <span className="inline-block animate-float text-5xl">🦉</span>
          <p className="font-extrabold text-wolf">Montando sua sessão...</p>
        </div>
      </Shell>
    );
  }

  if (finished) {
    return (
      <Shell>
        <div className="mx-auto max-w-md space-y-5 pt-12 text-center">
          <span className="inline-block animate-pop text-7xl">🏆</span>
          <div>
            <h1 className="text-3xl font-black">Sessão concluída!</h1>
            <p className="font-semibold text-wolf">Sua ofensiva de hoje está garantida.</p>
          </div>

          <div className="mx-auto flex max-w-xs justify-center gap-3">
            <Trophy label="XP ganho" value={`+${finished.xp}`} tone="border-bee text-bee-dark" />
            <Trophy
              label="Conquistas"
              value={`${finished.achievements.length}`}
              tone="border-humpback text-humpback-dark"
            />
          </div>

          {finished.achievements.length > 0 && (
            <div className="card border-humpback bg-humpback-soft text-left">
              <p className="section-title mb-1.5">Novas conquistas</p>
              <ul className="space-y-1">
                {finished.achievements.map((name) => (
                  <li key={name} className="font-extrabold text-humpback-dark">
                    🏅 {name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button className="btn-primary w-full py-4 text-base" onClick={() => navigate('/')}>
            Voltar ao início
          </button>
        </div>
      </Shell>
    );
  }

  const done = session.activities.filter((a) => a.completed).length;
  const total = session.activities.length;

  // Todas as atividades feitas: falta apenas fechar a sessao.
  if (!current) {
    return (
      <Shell>
        <div className="mx-auto max-w-md space-y-5 pt-12 text-center">
          <span className="inline-block animate-float text-7xl">🎯</span>
          <div>
            <h1 className="text-2xl font-black">Todos os blocos foram feitos</h1>
            <p className="font-semibold text-wolf">
              Feche a sessão para registrar o streak e receber o bônus de conclusão.
            </p>
          </div>
          <button
            className="btn-primary w-full py-4 text-base"
            onClick={() => completeSession.mutate(session.id)}
            disabled={completeSession.isPending || session.completed}
          >
            {session.completed
              ? 'Sessão já concluída'
              : completeSession.isPending
                ? 'Fechando...'
                : 'Concluir sessão'}
          </button>
          <button className="btn-plain w-full" onClick={() => navigate('/')}>
            Voltar
          </button>
        </div>
      </Shell>
    );
  }

  const theme = activityTheme(current.type);
  const language = languageTheme(current.languageCode);
  const overtime = elapsed > current.plannedMinutes * 60;

  return (
    <Shell
      header={
        <>
          <button
            onClick={() => navigate('/')}
            className="shrink-0 rounded-xl p-1.5 text-hare transition hover:bg-snow hover:text-wolf"
            aria-label="Sair da sessão"
          >
            <CloseIcon className="h-7 w-7" />
          </button>
          <ProgressBar value={done} max={total} size="lg" />
          <span
            className={`shrink-0 text-sm font-black tabular-nums ${
              overtime ? 'text-beak' : 'text-hare'
            }`}
          >
            {formatTime(elapsed)}
          </span>
        </>
      }
    >
      <div className="space-y-5 pb-44">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 text-2xl ${language.soft} ${language.border}`}
          >
            {theme.emoji}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black">
              {theme.label} · {current.languageName}
            </h1>
            <p className="text-xs font-extrabold uppercase tracking-wider text-hare">
              bloco {session.activities.findIndex((a) => a.id === current.id) + 1} de {total} ·{' '}
              {PILLAR_LABEL[current.pillar] ?? current.pillar} · {current.plannedMinutes} min
            </p>
          </div>
        </div>

        {current.reason && (
          <p className="rounded-2xl bg-snow px-4 py-3 text-sm font-semibold text-wolf">
            <span aria-hidden>🎯 </span>
            {current.reason}
          </p>
        )}

        {current.type === 'review' ? (
          <ReviewRunner
            languageCode={current.languageCode}
            onSkip={() => completeActivity.mutate({ id: current.id })}
            onFinish={(score) => completeActivity.mutate({ id: current.id, score })}
          />
        ) : (
          <GenericRunner
            activity={current}
            onSkip={() => completeActivity.mutate({ id: current.id })}
            onFinish={(score) => completeActivity.mutate({ id: current.id, score })}
          />
        )}
      </div>
    </Shell>
  );
}

/** Sessao roda em tela cheia, sem a navegacao do app: um bloco por vez. */
function Shell({ header, children }: { header?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      {header && (
        <header className="sticky top-0 z-10 border-b-2 border-swan bg-white">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">{header}</div>
        </header>
      )}
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}

function Trophy({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`flex-1 rounded-2xl border-2 bg-white p-3 ${tone}`}>
      <p className="text-2xl font-black tabular-nums">{value}</p>
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-hare">{label}</p>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
