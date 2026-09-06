import { ReactNode } from 'react';

type Tone = 'neutral' | 'correct' | 'wrong';

const TONE: Record<Tone, { wrap: string; title: string; detail: string; emoji: string }> = {
  neutral: { wrap: 'border-swan bg-white', title: 'text-eel', detail: 'text-wolf', emoji: '' },
  correct: {
    wrap: 'border-grass/40 bg-grass-soft',
    title: 'text-grass-dark',
    detail: 'text-grass-dark/80',
    emoji: '🎉',
  },
  wrong: {
    wrap: 'border-cardinal/40 bg-cardinal-soft',
    title: 'text-cardinal-dark',
    detail: 'text-cardinal-dark/80',
    emoji: '❌',
  },
};

/**
 * Barra fixa no pe da tela onde toda licao decide o proximo passo.
 * Ter um unico lugar para "verificar / continuar / avaliar" e o que faz a
 * sessao parecer um fluxo, e nao uma sequencia de paginas diferentes.
 */
export function LessonFooter({
  tone = 'neutral',
  title,
  detail,
  children,
}: {
  tone?: Tone;
  title?: string;
  detail?: ReactNode;
  children: ReactNode;
}) {
  const style = TONE[tone];

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-20 border-t-2 pb-[env(safe-area-inset-bottom)] ${style.wrap}`}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          {title && (
            <p className={`flex items-center gap-2 text-lg font-black ${style.title}`}>
              {style.emoji && <span aria-hidden>{style.emoji}</span>}
              {title}
            </p>
          )}
          {detail && <div className={`text-sm font-semibold ${style.detail}`}>{detail}</div>}
        </div>
        <div className="flex shrink-0 gap-2 sm:w-auto">{children}</div>
      </div>
    </div>
  );
}
