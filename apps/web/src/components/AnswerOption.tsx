import { ReactNode } from 'react';

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong';

const STATE: Record<OptionState, string> = {
  idle: 'border-swan bg-white text-eel',
  selected: 'border-macaw bg-macaw-soft text-macaw-dark',
  correct: 'border-grass bg-grass-soft text-grass-dark',
  wrong: 'border-cardinal bg-cardinal-soft text-cardinal-dark',
};

/**
 * Uma alternativa de multipla escolha.
 *
 * Estava copiada byte a byte em quatro runners, com divergencias que so
 * apareciam no uso (um tinha duas colunas no `sm`, outro nao). Aqui tambem
 * saiu o cracha numerado que cada opcao exibia: ele prometia atalho de teclado
 * `1..4` que nunca existiu, e no celular ocupava largura util sem fazer nada.
 *
 * A altura minima e 44px porque esta e, junto com as pecas de montagem, a coisa
 * mais tocada do app.
 */
export function AnswerOption({
  children,
  state = 'idle',
  onClick,
  disabled,
  lang,
}: {
  children: ReactNode;
  state?: OptionState;
  onClick?: () => void;
  disabled?: boolean;
  /** Idioma do texto da alternativa, para a leitura por voz do sistema. */
  lang?: string;
}) {
  return (
    <button
      type="button"
      lang={lang}
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-12 w-full items-center rounded-md border px-4 py-3 text-left text-base
                  transition-colors disabled:cursor-default ${STATE[state]}`}
    >
      {children}
    </button>
  );
}
