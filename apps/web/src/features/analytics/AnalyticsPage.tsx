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
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-eel">Progresso</h1>
        <p className="text-sm text-wolf">XP mede consistência. CEFR mede competência.</p>
      </header>

      {weekly.data && (
        <div className="grid grid-cols-3 gap-2">
          <Stat value={`${weekly.data.totalHours}h`} label="na semana" />
          <Stat value={`${weekly.data.sessionsCompleted}`} label="sessões" />
          <Stat value={`${weekly.data.xpEarned}`} label="xp" />
        </div>
      )}

      <section className="card space-y-3">
        <h2 className="section-title">Tempo por idioma</h2>
        {(time.data ?? []).length === 0 ? (
          <p className="text-sm text-hare">Ainda sem atividades concluídas.</p>
        ) : (
          (time.data ?? []).map((row) => {
            const theme = languageTheme(row.languageCode);
            return (
              <div key={row.languageCode} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-xs text-wolf">
                  <span className={`mr-1 font-mono ${theme.text}`}>{theme.mark}</span>
                  {row.languageName}
                </span>
                <ProgressBar value={row.hours} max={maxHours} tone={theme.bg} />
                <span className="w-12 shrink-0 text-right font-mono text-xs text-eel">{row.hours}h</span>
              </div>
            );
          })
        )}
      </section>

      <section className="card space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="section-title">Consistência (30 dias)</h2>
          {consistency.data && (
            <span className="font-mono text-xl text-grass-dark">{consistency.data.percentage}%</span>
          )}
        </div>
        {consistency.data && (
          <>
            <ProgressBar value={consistency.data.percentage} size="lg" />
            <p className="text-sm text-wolf">
              Você estudou em {consistency.data.activeDays} dos últimos {consistency.data.days} dias.
            </p>
          </>
        )}
      </section>

      {weekly.data && (
        <section className="card space-y-3">
          <h2 className="section-title">Revisão semanal</h2>

          <div className="space-y-2">
            {weekly.data.languages.map((language) => {
              const theme = languageTheme(language.code);
              const weakest = SKILL_LABEL[language.weakestSkill];
              return (
                <div
                  key={language.code}
                  className="space-y-1.5 rounded-md bg-snow px-3 py-2.5 sm:flex sm:items-center sm:justify-between sm:gap-3 sm:space-y-0"
                >
                  {/*
                    Empilha no celular. Em linha unica, o nome do idioma disputava
                    espaco com dois chips de largura fixa e perdia: "Espanol A2"
                    aparecia como "ES Es...", que nao identifica nada. Um rotulo
                    truncado a duas letras e pior que uma linha a mais.
                  */}
                  <span className="min-w-0 truncate text-sm font-medium text-eel">
                    <span className={`mr-1 font-mono ${theme.text}`}>{theme.mark}</span>
                    {language.name}
                    <span className="ml-1.5 font-mono text-xs text-hare">{language.level}</span>
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className={`chip border-transparent ${scoreTone(language.average).text} bg-white`}>
                      média {language.average}%
                    </span>
                    <span className="chip border-cardinal/30 bg-cardinal-soft text-cardinal-dark">
                      {weakest?.label ?? language.weakestSkill} {language.weakestScore}%
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <p className="border-l-2 border-humpback pl-3 font-serif text-sm italic leading-snug text-humpback-dark">
            {weekly.data.recommendation}
          </p>
        </section>
      )}

      {speechCache.data && speechCache.data.clips > 0 && (
        <section className="card space-y-3">
          <div>
            <h2 className="section-title">Cache de voz</h2>
            <p className="text-xs text-hare">
              Cada frase é sintetizada uma vez só. Toda reprodução depois disso sai de graça.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <Stat value={`${speechCache.data.clips}`} label="frases" />
            <Stat value={`${speechCache.data.plays}`} label="reproduções" />
            <Stat value={`${speechCache.data.savedSyntheses}`} label="poupadas" />
          </div>

          {speechCache.data.topPlayed.length > 0 && (
            <div>
              <p className="section-title mb-1.5">Mais ouvidas</p>
              <ul className="space-y-1">
                {speechCache.data.topPlayed.map((clip, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2 text-xs text-eel">
                    <span className="truncate">
                      <span className={`mr-1 font-mono ${languageTheme(clip.languageCode).text}`}>
                        {languageTheme(clip.languageCode).mark}
                      </span>
                      {clip.text}
                    </span>
                    <span className="shrink-0 font-mono text-macaw">{clip.playCount}×</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-hare">{speechCache.data.megabytes} MB guardados no banco.</p>
        </section>
      )}

      <section className="card space-y-3">
        <div>
          <h2 className="section-title">Uso de IA</h2>
          <p className="text-xs text-hare">
            Custo e latência por modelo — é o que permite trocar de provider com dados.
          </p>
        </div>
        {(aiUsage.data ?? []).length === 0 ? (
          <p className="text-sm text-hare">Nenhuma chamada de IA registrada ainda.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[34rem] text-left font-mono text-sm">
              <thead>
                <tr className="text-xs text-hare">
                  <th className="pb-2 font-normal">Modelo</th>
                  <th className="pb-2 text-right font-normal">Chamadas</th>
                  <th className="pb-2 text-right font-normal">Falhas</th>
                  <th className="pb-2 text-right font-normal">Tokens</th>
                  <th className="pb-2 text-right font-normal">Latência</th>
                  <th className="pb-2 text-right font-normal">USD</th>
                </tr>
              </thead>
              <tbody>
                {(aiUsage.data ?? []).map((row) => (
                  <tr key={row.provider + row.model} className="border-t border-swan">
                    <td className="py-2.5 text-eel">
                      <span className="text-hare">{row.provider}</span> {row.model}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-eel">{row.calls}</td>
                    <td
                      className={`py-2.5 text-right tabular-nums ${
                        row.failures > 0 ? 'text-cardinal' : 'text-hare'
                      }`}
                    >
                      {row.failures}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-wolf">
                      {row.inputTokens + row.outputTokens}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-wolf">{row.avgLatencyMs}ms</td>
                    <td className="py-2.5 text-right tabular-nums text-eel">
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-swan bg-white p-2.5 text-center sm:p-3">
      <p className="font-mono text-xl text-eel">{value}</p>
      {/* Tres desses cabem em 360px com pouco mais de 100px cada. */}
      <p className="truncate text-[11px] leading-tight text-hare">{label}</p>
    </div>
  );
}
