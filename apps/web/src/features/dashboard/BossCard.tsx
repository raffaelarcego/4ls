import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Hero } from '../../components/Hero';
import { ProgressBar } from '../../components/ProgressBar';
import { languageTheme } from '../../lib/ui';
import { api } from '../../services/api';
import { PromotionGate } from '../../types';

/** Nota composta que abre o chefe — o mesmo número do backend. */
const PROMOTION_SCORE = 85;

/**
 * O chefe de fase no painel.
 *
 * O app não tinha degrau nenhum que falasse de LÍNGUA. O XP sobe todo dia, a
 * sequência conta dias, e o nível do idioma — a única coisa que diz algo sobre
 * o quanto ele avançou em alemão — nunca mudava.
 *
 * Por isso o card tem dois estados, e nenhum deles é "escondido":
 *
 * - CHEFE ABERTO: ocupa o painel. É o momento de recompensa do produto, e
 *   perdê-lo numa lista seria desperdiçá-lo.
 * - CHEFE FECHADO: uma linha com o idioma mais perto de abrir e quanto falta.
 *   Alvo visível vale mais que surpresa: sem ele, subir de nível viraria um
 *   aviso que aparece um dia do nada, sem nunca ter sido uma meta.
 *
 * Quando todos estão longe ou no topo, não aparece nada — um card que só diz
 * "ainda não" todo dia vira ruído e o aluno para de lê-lo.
 */
export function BossCard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery<PromotionGate[]>({
    queryKey: ['promotion', 'status'],
    queryFn: async () => (await api.get('/promotion/status')).data,
    // O portão muda com o desempenho, que muda a cada bloco concluído.
    staleTime: 60_000,
  });

  const start = useMutation({
    mutationFn: async (languageCode: string) => {
      const { data } = await api.post('/study/practice', { languageCode, type: 'promotion' });
      return data as { id: string };
    },
    onSuccess: (activity) => {
      queryClient.invalidateQueries({ queryKey: ['session', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate(`/sessao?activity=${activity.id}`);
    },
  });

  /*
   * `Array.isArray`, e nao so `data`: este card e o unico do painel que consulta
   * uma rota propria, entao uma resposta de formato inesperado (erro serializado,
   * proxy, versao antiga da API) chegaria aqui como objeto -- e um `.find` em
   * objeto derruba o painel INTEIRO, nao so o card. O dia de estudo nao pode cair
   * por causa de um aviso de progressao.
   */
  if (!Array.isArray(data) || data.length === 0) return null;

  const ready = data.find((gate) => gate.state === 'ready');
  if (ready) return <Open gate={ready} onStart={() => start.mutate(ready.languageCode)} pending={start.isPending} />;

  return <Closest gates={data} />;
}

function Open({
  gate,
  onStart,
  pending,
}: {
  gate: PromotionGate;
  onStart: () => void;
  pending: boolean;
}) {
  const theme = languageTheme(gate.languageCode);

  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-bee bg-bee-soft p-5">
      {/* O halo só existe aqui: é a única coisa do painel que espera uma decisão. */}
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-bee opacity-20 blur-2xl"
        aria-hidden
      />

      <div className="relative flex items-center gap-4">
        <Hero mood="focus" size="md" accent="text-bee" className="shrink-0" />

        <div className="min-w-0 flex-1">
          <p className="section-title text-bee-dark">Chefe de fase</p>
          <p className="font-serif text-xl font-bold leading-tight text-eel">
            {gate.languageName} pode subir para {gate.nextLevel}
          </p>
          <p className="mt-1 text-sm leading-snug text-wolf">
            Um exame com gabarito, do que você já estudou. Se passar, o conteúdo deste idioma sobe
            de nível junto.
          </p>
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-3">
        <span className={`chip ${theme.border} ${theme.text}`}>{gate.currentLevel}</span>
        <span className="font-mono text-hare" aria-hidden>
          &rarr;
        </span>
        <span className="chip border-bee text-bee">{gate.nextLevel}</span>
      </div>

      <button className="btn-primary mt-4 w-full py-4 text-base" onClick={onStart} disabled={pending}>
        {pending ? 'Convocando...' : 'Encarar o chefe'}
      </button>
    </section>
  );
}

/**
 * O idioma mais perto de abrir o chefe.
 *
 * "Mais perto" é o de menor `missingScore` entre os que ainda podem subir. Quem
 * está na espera de uma derrota conta como perto de propósito: falta tempo, não
 * desempenho, e dizer isso é mais útil que apontar outro idioma.
 */
function Closest({ gates }: { gates: PromotionGate[] }) {
  const cooling = gates.find((g) => g.state === 'cooldown');

  if (cooling) {
    return (
      <p className="rounded-xl border border-swan bg-white px-4 py-3 text-sm leading-snug text-wolf">
        <span className="font-semibold text-eel">Chefe de {cooling.languageName}:</span>{' '}
        {cooling.reason}
      </p>
    );
  }

  const next = gates
    .filter((g) => g.state === 'growing' || g.state === 'unprepared')
    .sort((a, b) => a.missingScore - b.missingScore)[0];

  if (!next) return null;

  // Perto o bastante para ser meta. Mais longe que isso, o card vira ruído
  // diário -- e um alvo que não se move em semanas desmotiva em vez de puxar.
  if (next.missingScore > 25) return null;

  const theme = languageTheme(next.languageCode);
  const reached = PROMOTION_SCORE - next.missingScore;

  return (
    <div className="card space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-eel">
          <span className="font-semibold">{next.languageName}</span> a caminho do{' '}
          <span className="font-mono">{next.nextLevel}</span>
        </p>
        <span className="shrink-0 font-mono text-xs text-hare">
          {reached}/{PROMOTION_SCORE}
        </span>
      </div>
      <ProgressBar value={reached} max={PROMOTION_SCORE} size="sm" tone={theme.bg} />
      <p className="text-xs leading-snug text-wolf">{next.reason}</p>
    </div>
  );
}
