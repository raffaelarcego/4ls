import { useQuery } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../stores/auth.store';
import { DashboardData } from '../types';
import { CardsIcon, ChartIcon, ChatIcon, HomeIcon, LogoutIcon, PuzzleIcon } from './Icons';

const NAV = [
  { to: '/', label: 'Aprender', Icon: HomeIcon, tone: 'text-macaw' },
  { to: '/vocabulario', label: 'Palavras', Icon: CardsIcon, tone: 'text-grass' },
  { to: '/estruturas', label: 'Estruturas', Icon: PuzzleIcon, tone: 'text-cardinal' },
  { to: '/tutor', label: 'Tutor', Icon: ChatIcon, tone: 'text-humpback' },
  { to: '/progresso', label: 'Progresso', Icon: ChartIcon, tone: 'text-beak' },
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

  return (
    <div className="min-h-screen bg-white">
      {/* Barra lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r-2 border-swan bg-white px-3 py-5 lg:flex">
        <span className="mb-6 px-3 text-2xl font-black tracking-tight text-grass">
          4L<span className="text-macaw">.</span>
        </span>

        <nav className="flex flex-1 flex-col gap-1.5">
          {NAV.map(({ to, label, Icon, tone }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-sm font-extrabold uppercase tracking-wide transition ${
                  isActive
                    ? 'border-macaw bg-macaw-soft text-macaw-dark'
                    : 'border-transparent text-wolf hover:bg-snow'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-6 w-6 ${isActive ? '' : tone}`} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 border-t-2 border-swan pt-3">
          <p className="truncate px-3 text-sm font-extrabold text-eel">{user?.name}</p>
          <button
            onClick={signOut}
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold uppercase tracking-wider text-hare transition hover:bg-snow hover:text-cardinal"
          >
            <LogoutIcon className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="lg:pl-60">
        {/* Placar: ofensiva e XP, sempre a vista */}
        <header className="sticky top-0 z-10 border-b-2 border-swan bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-xl font-black tracking-tight text-grass lg:hidden">
              4L<span className="text-macaw">.</span>
            </span>
            <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
              <Score emoji="🔥" value={data ? `${data.streak.current}` : '—'} label="ofensiva" tone="text-beak" />
              <Score emoji="⚡" value={data ? `${data.xp.today}` : '—'} label="xp hoje" tone="text-bee-dark" />
              <Score emoji="💎" value={data ? `${data.xp.total}` : '—'} label="xp total" tone="text-macaw" />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 pb-28 pt-5 lg:pb-12">{children}</main>
      </div>

      {/* Abas (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t-2 border-swan bg-white lg:hidden">
        {NAV.map(({ to, label, Icon, tone }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-extrabold uppercase tracking-wider transition ${
                isActive ? `${tone}` : 'text-hare'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`rounded-xl px-3.5 py-1 transition ${isActive ? 'bg-snow' : ''}`}
                >
                  <Icon className="h-6 w-6" />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Score({
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
    <span className="flex items-center gap-1.5" title={label}>
      <span aria-hidden className="text-lg leading-none">
        {emoji}
      </span>
      <span className={`text-base font-black leading-none ${tone}`}>{value}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
