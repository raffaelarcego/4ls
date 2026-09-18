import { KeyboardEvent, useRef } from 'react';

/**
 * Campo de resposta escrito no idioma que esta sendo estudado.
 *
 * O motivo de existir e um bug de produto, nao de estilo: o teclado do celular
 * esta em portugues e "corrige" o que ele digita -- `der` vira `de`, `hablo`
 * vira `falo`, `ich` vira `icho` -- e a correcao compara string literal, entao a
 * resposta certa aparece em vermelho. E o pior tipo de erro que um app de idioma
 * pode cometer, porque ensina o contrario do certo.
 *
 * Declarar `lang` tambem faz o teclado do sistema oferecer o alfabeto do idioma
 * (cirilico no russo) e o corretor certo, em vez do portugues.
 */
const FIELD_PROPS = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
} as const;

/**
 * Traz o campo para a area visivel depois que o teclado abre.
 *
 * O teclado ocupa cerca de metade da tela e o rodape fixo come mais um pedaco;
 * sem isto, o cursor da terceira e da quarta caixa da producao fica atras dos
 * dois. O atraso espera a animacao do teclado -- rolar antes dela nao adianta,
 * porque a altura da janela ainda nao mudou.
 */
function revealOnFocus(element: HTMLElement | null) {
  if (!element) return;
  window.setTimeout(() => element.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
}

export function AnswerInput({
  value,
  onChange,
  languageCode,
  onSubmit,
  placeholder,
  disabled,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  /** Idioma da resposta -- define teclado, corretor e leitura por voz. */
  languageCode: string;
  /** Enter confirma. Sem isto, responder exige viajar ate o rodape. */
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || !onSubmit) return;
    event.preventDefault();
    onSubmit();
  }

  return (
    <input
      {...FIELD_PROPS}
      ref={ref}
      lang={languageCode}
      enterKeyHint="go"
      className={`input ${className}`}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onFocus={() => revealOnFocus(ref.current)}
    />
  );
}

export function AnswerTextarea({
  value,
  onChange,
  languageCode,
  placeholder,
  disabled,
  rows = 3,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  languageCode: string;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  return (
    <textarea
      {...FIELD_PROPS}
      ref={ref}
      lang={languageCode}
      rows={rows}
      className={`input ${className}`}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => revealOnFocus(ref.current)}
    />
  );
}
