import { useQuery } from '@tanstack/react-query';
import { ProgressBar } from '../../components/ProgressBar';
import { languageTheme, scoreTone, SKILL_LABEL } from '../../lib/ui';
import { api } from '../../services/api';

interface TimeRow {
  languageCode: string;
  languageName: string;
  hours: number;
}

interface Consistency {
  days: number;
  activeDays: number;
  percentage: number;
}

interface WeeklyReview {
  totalHours: number;
  sessionsCompleted: number;
  xpEarned: number;
  recommendation: string;
  languages: Array<{
    code: string;
    name: string;
    level: string;
    average: number;
    weakestSkill: string;
    weakestScore: number;
  }>;
}

interface SpeechCache {
  clips: number;
  megabytes: number;
  plays: number;
  savedSyntheses: number;
  topPlayed: Array<{ text: string; languageCode: string; playCount: number }>;
}

interface AiUsageRow {
  provider: string;
  model: string;
  calls: number;
  failures: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  avgLatencyMs: number;
}

export function AnalyticsPage() {
  const time = useQuery<TimeRow[]>({
    queryKey: ['analytics', 'time'],
    queryFn: async () => (await api.get('/analytics/time')).data,
  });
  const consistency = useQuery<Consistency>({
    queryKey: ['analytics', 'consistency'],
    queryFn: async () => (await api.get('/analytics/consistency')).data,
  });
  const weekly = useQuery<WeeklyReview>({
    queryKey: ['analytics', 'weekly'],
    queryFn: async () => (await api.get('/analytics/weekly-review')).data,
  });
  const aiUsage = useQuery<AiUsageRow[]>({
    queryKey: ['analytics', 'ai'],
    queryFn: async () => (await api.get('/analytics/ai-usage')).data,
  });
  const speechCache = useQuery<SpeechCache>({
    queryKey: ['speech', 'cache'],
    queryFn: async () => (await api.get('/speech/cache')).data,
    retry: false,
  });

  const maxHours = Math.max(1, ...(time.data ?? []).map((t) => t.hours));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black tracking-tight">Progresso 📈</h1>
        <p className="text-sm font-semibold text-wolf">
          XP mede consistência. CEFR mede competência.
        </p>
      </header>

      {weekly.data && (
        <div className="grid grid-cols-3 gap-2.5">
          <Stat emoji="⏱️" value={`${weekly.data.totalHours}h`} label="na semana" tone="text-macaw" />
          <Stat
            emoji="✅"
            value={`${weekly.data.sessionsCompleted}`}
            label="sessões"
            tone="text-grass-dark"
          />
          <Stat emoji="⚡" value={`${weekly.data.xpEarned}`} label="xp" tone="text-bee-dark" />
        </div>
      )}

      <section className="card space-y-3">
        <h2 className="section-title">Tempo por idioma</h2>
        {(time.data ?? []).length === 0 ? (
          <p className="text-sm font-semibold text-hare">Ainda sem atividades concluídas.</p>
        ) : (
          (time.data ?? []).map((row) => {
            const theme = languageTheme(row.languageCode);
            return (
              <div key={row.languageCode} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-xs font-extrabold text-wolf">
                  <span aria-hidden>{theme.flag}</span> {row.languageName}
                </span>
                <ProgressBar value={row.hours} max={maxHours} tone={theme.bg} />
                <span className="w-12 shrink-0 text-right text-xs font-black tabular-nums text-eel">
                  {row.hours}h
                </span>
              </div>
            );
          })
        )}
      </section>

      <section className="card space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="section-title">Consistência (30 dias)</h2>
          {consistency.data && (
            <span className="text-2xl font-black text-grass-dark">
              {consistency.data.percentage}%
            </span>
          )}
        </div>
        {consistency.data && (
          <>
            <ProgressBar value={consistency.data.percentage} size="lg" />
            <p className="text-sm font-semibold text-wolf">
              Você estudou em {consistency.data.activeDays} dos últimos {consistency.data.days}{' '}
              dias.
            </p>
          </>
        )}
      </section>

      {weekly.data && (
        <section className="card space-y-3">
          <h2 className="section-title">Weekly Review</h2>

          <div className="space-y-2">
            {weekly.data.languages.map((language) => {
              const theme = languageTheme(language.code);
              const weakest = SKILL_LABEL[language.weakestSkill];
              return (
                <div
                  key={language.code}
                  className="flex items-center justify-between gap-3 rounded-xl bg-snow px-3 py-2.5"
                >
                  <span className="min-w-0 truncate text-sm font-extrabold">
                    <span aria-hidden>{theme.flag} </span>
                    {language.name}
                    <span className="ml-1.5 text-xs font-extrabold uppercase text-hare">
                      {language.level}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={`chip ${scoreTone(language.average).text} bg-white`}>
                      média {language.average}%
                    </span>
                    <span className="chip bg-cardinal-soft text-cardinal-dark">
                      <span aria-hidden>{weakest?.emoji ?? '⚠️'}</span>{' '}
                      {weakest?.label ?? language.weakestSkill} {language.weakestScore}%
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-start gap-3 rounded-2xl border-2 border-humpback bg-humpback-soft p-3.5">
            <span aria-hidden className="text-2xl">
              🦉
            </span>
            <p className="text-sm font-bold text-humpback-dark">{weekly.data.recommendation}</p>
          </div>
        </section>
      )}

      {speechCache.data && speechCache.data.clips > 0 && (
        <section className="card space-y-3">
          <div>
            <h2 className="section-title">Cache de voz</h2>
            <p className="text-xs font-semibold text-hare">
              Cada frase é sintetizada uma vez só. Toda reprodução depois disso sai de graça.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <Stat
              emoji="🔊"
              value={`${speechCache.data.clips}`}
              label="frases"
              tone="text-macaw"
            />
            <Stat
              emoji="▶️"
              value={`${speechCache.data.plays}`}
              label="reproduções"
              tone="text-grass-dark"
            />
            <Stat
              emoji="💰"
              value={`${speechCache.data.savedSyntheses}`}
              label="não pagas"
              tone="text-bee-dark"
            />
          </div>

          {speechCache.data.topPlayed.length > 0 && (
            <div>
              <p className="section-title mb-1.5">Mais ouvidas</p>
              <ul className="space-y-1">
                {speechCache.data.topPlayed.map((clip, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-2 text-xs font-semibold"
                  >
                    <span className="truncate">
                      <span aria-hidden>{languageTheme(clip.languageCode).flag} </span>
                      {clip.text}
                    </span>
                    <span className="shrink-0 font-black text-macaw">{clip.playCount}x</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs font-semibold text-hare">
            {speechCache.data.megabytes} MB guardados no banco.
          </p>
        </section>
      )}

      <section className="card space-y-3">
        <div>
          <h2 className="section-title">Uso de IA</h2>
          <p className="text-xs font-semibold text-hare">
            Custo e latência por modelo — é o que permite trocar de provider com dados.
          </p>
        </div>
        {(aiUsage.data ?? []).length === 0 ? (
          <p className="text-sm font-semibold text-hare">Nenhuma chamada de IA registrada ainda.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="text-[10px] font-extrabold uppercase tracking-wider text-hare">
                  <th className="pb-2">Modelo</th>
                  <th className="pb-2 text-right">Chamadas</th>
                  <th className="pb-2 text-right">Falhas</th>
                  <th className="pb-2 text-right">Tokens</th>
                  <th className="pb-2 text-right">Latência</th>
                  <th className="pb-2 text-right">USD</th>
                </tr>
              </thead>
              <tbody>
                {(aiUsage.data ?? []).map((row) => (
                  <tr key={row.provider + row.model} className="border-t-2 border-swan">
                    <td className="py-2.5 font-bold">
                      <span className="text-hare">{row.provider}</span> {row.model}
                    </td>
                    <td className="py-2.5 text-right font-black tabular-nums">{row.calls}</td>
                    <td
                      className={`py-2.5 text-right font-black tabular-nums ${
                        row.failures > 0 ? 'text-cardinal' : 'text-hare'
                      }`}
                    >
                      {row.failures}
                    </td>
                    <td className="py-2.5 text-right font-bold tabular-nums text-wolf">
                      {row.inputTokens + row.outputTokens}
                    </td>
                    <td className="py-2.5 text-right font-bold tabular-nums text-wolf">
                      {row.avgLatencyMs}ms
                    </td>
                    <td className="py-2.5 text-right font-black tabular-nums">
                      {row.estimatedCost.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  emoji,
  value,
  label,
  tone,
}: {
  emoji: string;
  value: string;
  label: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-swan bg-white p-3 text-center">
      <span aria-hidden className="text-xl">
        {emoji}
      </span>
      <p className={`text-xl font-black tabular-nums ${tone}`}>{value}</p>
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-hare">{label}</p>
    </div>
  );
}
