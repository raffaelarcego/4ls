import { ReactNode, useEffect, useState } from 'react';
import { useHeightVar } from '../lib/metrics';

type Tone = 'neutral' | 'correct' | 'wrong';

const TONE: Record<Tone, { wrap: string; title: string; detail: string }> = {
  neutral: { wrap: 'border-swan bg-white', title: 'text-eel', detail: 'text-wolf' },
  correct: {
    wrap: 'border-grass bg-grass-soft',
    title: 'text-grass-dark',
    detail: 'text-grass-dark/80',
  },
  wrong: {
    wrap: 'border-cardinal bg-cardinal-soft',
    title: 'text-cardinal-dark',
    detail: 'text-cardinal-dark/80',
  },
};

/**
 * Barra fixa no pe da tela onde toda licao decide o proximo passo.
 * Ter um unico lugar para "verificar / continuar / avaliar" e o que faz a
 * sessao parecer um fluxo, e nao uma sequencia de paginas diferentes.
 *
 * Duas coisas aqui sao menos obvias do que parecem:
 *
 * 1. Ela se posiciona ACIMA das abas do Layout, nao no fundo absoluto. Antes as
 *    duas barras disputavam `bottom-0` no mesmo z-index e as abas, por virem
 *    depois no DOM, pintavam por cima -- boa parte do botao "Verificar" ficava
 *    fisicamente intocavel nas telas de gramatica.
 * 2. Ela publica a propria altura, porque ela cresce: um resultado longo
 *    ("Resposta certa: <frase inteira>") ocupa varias linhas. Quem rola o
 *    conteudo usa `.lesson-pad` e reserva a altura real.
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
  const ref = useHeightVar<HTMLDivElement>('--lesson-footer-h');

  return (
    <div
      ref={ref}
      className={`fixed inset-x-0 bottom-[var(--tabbar-h,0px)] z-40 border-t pb-[var(--footer-safe,0px)] ${style.wrap}`}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          {title && <p className={`font-serif text-base font-semibold ${style.title}`}>{title}</p>}
          {detail && <div className={`text-sm ${style.detail}`}>{detail}</div>}
        </div>
        <div className="flex shrink-0 gap-2 sm:w-auto">{children}</div>
      </div>
    </div>
  );
}

/**
 * "Pular bloco", com confirmacao.
 *
 * Ele fica a poucos pixels do botao principal, e um toque errado nao custava
 * uma questao -- abandonava o bloco inteiro e avancava a sessao, sem desfazer.
 * Em vez de brigar com o layout num celular de 360px, o primeiro toque so arma
 * a acao; o segundo e que pula. Desarma sozinho, para nao ficar uma bomba
 * armada no rodape enquanto ele responde.
 */
export function SkipButton({
  onSkip,
  label = 'Pular bloco',
  confirmLabel = 'Pular mesmo?',
}: {
  onSkip: () => void;
  /** "Sair" e "Voltar" correm o mesmo risco e usam o mesmo mecanismo. */
  label?: string;
  confirmLabel?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      className={`btn-plain ${armed ? 'text-cardinal' : ''}`}
      onClick={() => (armed ? onSkip() : setArmed(true))}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
