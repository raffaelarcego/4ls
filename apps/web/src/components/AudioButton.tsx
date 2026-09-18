import { useSpeaker } from '../lib/speech';

/**
 * Botao de ouvir. Nao decide nada sobre voz -- delega ao useSpeaker, que
 * escolhe entre a voz natural do servidor e a do navegador.
 */
export function AudioButton({
  text,
  languageCode,
  size = 'md',
  label,
  className = '',
}: {
  text: string;
  languageCode: string;
  size?: 'sm' | 'md' | 'lg';
  /** Texto ao lado do icone. Sem ele, o botao e so o alto-falante. */
  label?: string;
  className?: string;
}) {
  const speaker = useSpeaker();
  const key = `${languageCode}|${text.trim()}`;
  const isThis = speaker.speakingKey === key;

  if (!speaker.available) return null;

  /*
    O tamanho `sm` era 32px -- abaixo do minimo tocavel, e justamente no botao
    que aparece ao lado de cada termo, cada exemplo e cada fala do tutor. Agora
    o menor ainda e 44px; o que encolhe e o icone dentro dele, nao o alvo.
  */
  const box =
    size === 'lg' ? 'h-14 w-14 text-2xl' : size === 'sm' ? 'h-11 w-11 text-sm' : 'h-11 w-11 text-lg';

  return (
    <button
      type="button"
      onClick={() => (isThis ? speaker.stop() : void speaker.speak(text, languageCode))}
      aria-label={label ?? `Ouvir: ${text}`}
      title={speaker.naturalVoice ? 'Ouvir' : 'Ouvir (voz do navegador)'}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors ${
        isThis
          ? 'border-macaw-dark bg-macaw text-snow'
          : 'border-macaw bg-macaw-soft text-macaw-dark'
      } ${label ? 'px-4 py-3' : box} ${className}`}
    >
      <SpeakerIcon animated={isThis} />
      {label}
    </button>
  );
}

function SpeakerIcon({ animated }: { animated: boolean }) {
  return (
    <svg
      className={`h-[1.15em] w-[1.15em] ${animated ? 'animate-pulse' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}
