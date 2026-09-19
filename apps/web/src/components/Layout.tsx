import { useQuery } from '@tanstack/react-query';
import { ReactNode, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useHeightVar } from '../lib/metrics';
import { useBottomBanner } from '../lib/pwa';
import { api } from '../services/api';
import { useAuthStore } from '../stores/auth.store';
import { DashboardData, LevelProgress } from '../types';
import { CardsIcon, ChartIcon, ChatIcon, HomeIcon, LogoutIcon, PuzzleIcon } from './Icons';
import { InstallButton, InstallPrompt } from './InstallPrompt';

const NAV = [
  { to: '/', label: 'Aprender', Icon: HomeIcon },
  { to: '/vocabulario', label: 'Palavras', Icon: CardsIcon },
  { to: '/estruturas', label: 'Estruturas', Icon: PuzzleIcon },
  { to: '/tutor', label: 'Tutor', Icon: ChatIcon },
  { to: '/progresso', label: 'Progresso', Icon: ChartIcon },
];

export function Layout({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  // Mesma queryKey do dashboard: o cache e compartilhado, entao streak e XP
  // ficam visiveis em todas as telas sem custar uma requisicao a mais.
  const { data } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get('/dashboard')).data,
  });

  /*
   * A barra fixa do rodape cobre o fim da pagina, e o `pb` do conteudo so
   * reservava espaco para as abas. Com a barra aberta, o ultimo card ficava
   * atras dela -- visivel pela metade e intocavel. Reservar so quando ela
   * existe evita o espaco vazio permanente que um padding fixo deixaria.
   */
  const banner = useBottomBanner();

  // As abas publicam a propria altura para que o rodape das licoes se posicione
  // acima delas em vez de ficar por baixo. Some sozinho no desktop, onde a
  // barra esta escondida por breakpoint e mede zero.
  const tabbarRef = useHeightVar<HTMLElement>('--tabbar-h');

  // Com as abas na tela, sao elas que absorvem a area segura de baixo; somar o
  // mesmo espaco tambem no rodape da licao abriria uma faixa vazia no iPhone.
  useEffect(() => {
    document.documentElement.style.setProperty('--footer-safe', '0px');
    return () => {
      document.documentElement.style.removeProperty('--footer-safe');
    };
  }, []);
  // No desktop a barra fica rente ao rodape (sem abas embaixo), entao ela ocupa
  // bem menos altura -- por isso a reserva e menor la.
  // Agora que a barra cabe em uma linha, a reserva encolheu junto: abas (~58px)
  // mais barra (~56px) contra as abas sozinhas.
  const bottomSpace = banner ? 'pb-40 lg:pb-24' : 'pb-24 lg:pb-12';

  return (
    <div className="min-h-screen bg-snow">
      {/* Barra lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-swan bg-snow px-3 py-5 lg:flex">
        <span className="mb-1 px-3 font-serif text-2xl font-semibold tracking-tight text-eel">4L</span>
        <span className="mb-6 px-3 font-mono text-[11px] uppercase tracking-widest text-macaw">expedição</span>

        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 border-l-2 px-3 py-2.5 text-sm transition ${
                  isActive
                    ? 'border-grass font-medium text-eel'
                    : 'border-transparent text-wolf hover:border-swan hover:text-eel'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 border-t border-swan pt-3">
          <p className="truncate px-3 text-sm font-medium text-eel">{user?.name}</p>
          <button
            onClick={signOut}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-hare transition hover:bg-swan/40 hover:text-cardinal"
          >
            <LogoutIcon className="h-4 w-4" />
            Sair
          </button>
          <InstallButton className="mt-2 w-full justify-center" />
        </div>
      </aside>

      <div className="lg:pl-60">
        {/* Registro do dia: sequencia e minutos, sempre a vista */}
        <header className="sticky top-0 z-10 border-b border-swan bg-snow/90 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
            <span className="font-serif text-xl font-semibold tracking-tight text-eel lg:hidden">4L</span>
            {/* Caminho permanente para instalar. Some sozinho quando o app ja
                esta instalado -- ate la, e o unico ponto que nao depende de o
                navegador decidir oferecer. No desktop ele vive na barra
                lateral, entao aqui some para nao aparecer duas vezes. */}
            <InstallButton className="lg:hidden" />
            {/*
              Sequencia, XP do dia e nivel -- as tres coisas que o aluno olha de
              relance em qualquer tela. As duas primeiras estavam rotuladas como
              "min. hoje" e "min. no total", o que era simplesmente errado: o
              campo sempre foi XP, nunca minuto.
            */}
            <div className="flex flex-1 items-center justify-end gap-3 sm:gap-4">
              <Score value={data ? `${data.streak.current}` : '—'} label="seguidos" tone="text-bee" />
              <span className="h-6 w-px bg-swan" aria-hidden />
              <Score value={data ? `${data.xp.today}` : '—'} label="XP hoje" tone="text-grass" />
              <span className="h-6 w-px bg-swan" aria-hidden />
              <LevelPill progress={data?.xp.progress} />
            </div>
          </div>
        </header>

        <main className={`mx-auto max-w-3xl px-4 pt-5 ${bottomSpace}`}>{children}</main>
      </div>

      {/* Abas (mobile) */}
      {/*
        `grid-flow-col auto-cols-fr` garante UMA linha, sempre, seja qual for a
        quantidade de abas -- a regra e do CSS, nao de uma contagem calculada.
        A versao anterior montava `grid-template-columns` num style inline a
        partir de NAV.length; bastava esse style nao chegar ao DOM para as abas
        caírem no padrao de quatro colunas e a quinta quebrar para uma segunda
        linha, dobrando a altura da barra.

        pb-[env(safe-area-inset-bottom)] mantem as abas acima da barra de gestos
        do iPhone, ja que o viewport e viewport-fit=cover.
      */}
      <nav
        ref={tabbarRef}
        className="fixed inset-x-0 bottom-0 z-20 grid auto-cols-fr grid-flow-col border-t border-swan bg-snow pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex min-w-0 flex-col items-center gap-1 border-t-2 py-2 text-[10px] leading-tight transition ${
                isActive ? 'border-grass text-eel' : 'border-transparent text-hare'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {/* `truncate` e a garantia, nao o acabamento: "Estruturas" e
                "Progresso" ocupam quase os 72px de uma celula num aparelho de
                360px, e bastava uma fonte um pouco mais larga para o rotulo
                pular para a segunda linha e desalinhar a barra inteira. */}
            <span className="w-full truncate px-0.5 text-center">{label}</span>
          </NavLink>
        ))}
      </nav>

      <InstallPrompt />
    </div>
  );
}

function Score({
  value,
  label,
  tone = 'text-eel',
  className = '',
}: {
  value: string;
  label: string;
  tone?: string;
  className?: string;
}) {
  return (
    <span className={`flex flex-col items-end leading-none ${className}`} title={label}>
      <span className={`font-mono text-base font-bold tabular-nums ${tone}`}>{value}</span>
      <span className="mt-0.5 text-[10px] uppercase tracking-wide text-hare">{label}</span>
    </span>
  );
}

/**
 * O nivel, com a barra do progresso dentro da propria pastilha.
 *
 * Numero sozinho ("Nv 7") nao puxa ninguem -- a informacao que move e quanto
 * FALTA. Por isso a barra vive aqui, visivel em todas as telas, e nao so no
 * dashboard: e o lembrete permanente de que a proxima licao empurra alguma
 * coisa para a frente.
 */
function LevelPill({ progress }: { progress?: LevelProgress }) {
  return (
    <span
      className="flex min-w-[3.25rem] flex-col items-end leading-none"
      title={
        progress
          ? `Nível ${progress.level} — ${progress.title}. Faltam ${progress.xpRemaining} XP.`
          : 'Nível'
      }
    >
      <span className="font-mono text-base font-bold tabular-nums text-macaw">
        {progress ? `Nv ${progress.level}` : '—'}
      </span>
      <span className="mt-1 h-1 w-full overflow-hidden rounded-full bg-swan">
        <span
          className="block h-full rounded-full bg-bee transition-[width] duration-500 ease-out"
          style={{ width: `${progress?.percent ?? 0}%` }}
        />
      </span>
    </span>
  );
}
