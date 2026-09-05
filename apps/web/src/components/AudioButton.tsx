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

  const box =
    size === 'lg' ? 'h-14 w-14 text-2xl' : size === 'sm' ? 'h-8 w-8 text-sm' : 'h-11 w-11 text-lg';

  return (
    <button
      type="button"
      onClick={() => (isThis ? speaker.stop() : void speaker.speak(text, languageCode))}
      aria-label={label ?? `Ouvir: ${text}`}
      title={speaker.naturalVoice ? 'Ouvir' : 'Ouvir (voz do navegador)'}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-b-[4px] font-extrabold uppercase tracking-wide transition active:translate-y-[2px] active:border-b-2 ${
        isThis
          ? 'border-macaw-dark bg-macaw text-white'
          : 'border-macaw bg-macaw-soft text-macaw-dark hover:brightness-95'
      } ${label ? 'px-4 py-3 text-sm' : box} ${className}`}
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
