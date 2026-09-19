/**
 * O personagem.
 *
 * Desenhado em SVG e animado por CSS, e nao montado a partir de sprites
 * gerados. A razao e pratica: sprite sheet exige consistencia exata entre
 * quadros, fundo transparente e alinhamento de pixel, e modelo de imagem erra
 * os tres -- cada quadro volta com um personagem levemente diferente, e a
 * animacao "treme". Aqui cada membro e um grupo com nome, entao a pose e
 * controlada, escala sem perder nitidez em qualquer tela, pesa poucos KB e nao
 * depende de nenhuma chamada de rede para aparecer.
 *
 * Ele existe para uma coisa so: dar a quem abre o app alguem esperando do outro
 * lado. Por isso ele REAGE -- comemora quando o bloco fecha bem, murcha quando
 * a sequencia cai -- em vez de ser um enfeite parado no topo da tela.
 *
 * A cor vem de fora (`accent`), e e sempre a do contexto: a do idioma do bloco,
 * a do nivel, a do erro. Assim ele pertence a tela em que esta, em vez de
 * carregar uma paleta propria que brigaria com o resto.
 */

export type HeroMood = 'idle' | 'cheer' | 'sad' | 'focus';

const SIZES = {
  sm: 56,
  md: 88,
  lg: 132,
} as const;

export function Hero({
  mood = 'idle',
  size = 'md',
  accent = 'text-macaw',
  className = '',
}: {
  mood?: HeroMood;
  size?: keyof typeof SIZES;
  /** Classe de COR (text-*): tinge o capuz, o cachecol e o brilho. */
  accent?: string;
  className?: string;
}) {
  const px = SIZES[size];

  // O corpo inteiro ganha o movimento do humor; os olhos e a boca sao trocados
  // por pose. Separar os dois e o que permite comemorar sem redesenhar o rosto.
  const bodyAnimation =
    mood === 'cheer'
      ? 'animate-cheer'
      : mood === 'sad'
        ? 'animate-slump'
        : mood === 'focus'
          ? 'animate-float'
          : 'animate-breathe';

  return (
    <div
      className={`${accent} ${className}`}
      // Decorativo: quem le com leitor de tela nao ganha nada em ouvir a
      // descricao de um boneco, e o estado real ja esta escrito na tela ao lado.
      aria-hidden="true"
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        {/* Sombra no chao: ancora o personagem, senao ele flutua no vazio. */}
        <ellipse
          cx="50"
          cy="92"
          rx={mood === 'cheer' ? 14 : 18}
          ry="3.5"
          fill="currentColor"
          opacity="0.18"
          className="transition-all duration-300"
        />

        <g className={bodyAnimation} style={{ transformOrigin: '50px 90px' }}>
          {/* --- Corpo / manto --- */}
          <path
            d="M50 44
               C38 44 31 53 29 66
               L26 86
               C26 88.5 28 90 31 90
               L69 90
               C72 90 74 88.5 74 86
               L71 66
               C69 53 62 44 50 44 Z"
            fill="currentColor"
            opacity="0.9"
          />
          {/* Dobra do manto: uma linha so, para o volume nao ficar chapado. */}
          <path
            d="M50 52 L50 90"
            stroke="#0B0E1A"
            strokeWidth="1.5"
            opacity="0.25"
            strokeLinecap="round"
          />

          {/* --- Bracos --- */}
          {/* Comemorando, os dois sobem. Nos outros humores descem ao lado. */}
          <g className="transition-transform duration-300">
            <path
              d={
                mood === 'cheer'
                  ? 'M31 62 L20 44'
                  : mood === 'sad'
                    ? 'M31 64 L25 82'
                    : 'M31 62 L26 78'
              }
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="round"
              opacity="0.9"
            />
            <path
              d={
                mood === 'cheer'
                  ? 'M69 62 L80 44'
                  : mood === 'sad'
                    ? 'M69 64 L75 82'
                    : 'M69 62 L74 78'
              }
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="round"
              opacity="0.9"
            />
          </g>

          {/* --- Cachecol: o acento claro que separa cabeca de corpo --- */}
          <path
            d="M36 46 C42 51 58 51 64 46 L64 52 C58 56 42 56 36 52 Z"
            fill="currentColor"
            opacity="0.55"
          />

          {/* --- Cabeca --- */}
          <circle cx="50" cy="30" r="17" fill="#F2F4FF" />

          {/* Capuz por cima da cabeca, cobrindo o topo. */}
          <path
            d="M33 30 C33 20 40 13 50 13 C60 13 67 20 67 30 L67 26 C67 24 65 23 63 24 C59 20 55 18 50 18 C45 18 41 20 37 24 C35 23 33 24 33 26 Z"
            fill="currentColor"
          />

          {/* --- Rosto --- */}
          {mood === 'sad' ? (
            // Olhos fechados em arco para baixo: desanimo sem virar choro.
            <>
              <path d="M40 30 q4 4 8 0" stroke="#0B0E1A" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M52 30 q4 4 8 0" stroke="#0B0E1A" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M44 39 q6 -4 12 0" stroke="#0B0E1A" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              {/*
                A piscada e uma escala vertical dos olhos, com origem no centro
                deles -- por isso cada olho tem o proprio `transformOrigin`.
                Comemorando ninguem pisca: o olho fica fechado de felicidade.
              */}
              {mood === 'cheer' ? (
                <>
                  <path d="M40 32 q4 -5 8 0" stroke="#0B0E1A" strokeWidth="2.6" strokeLinecap="round" fill="none" />
                  <path d="M52 32 q4 -5 8 0" stroke="#0B0E1A" strokeWidth="2.6" strokeLinecap="round" fill="none" />
                  {/* Boca aberta de sorriso. */}
                  <path d="M44 38 q6 7 12 0 q-6 3 -12 0 Z" fill="#0B0E1A" />
                </>
              ) : (
                <>
                  <ellipse
                    cx="44"
                    cy="31"
                    rx="2.6"
                    ry="3.4"
                    fill="#0B0E1A"
                    className="animate-blink"
                    style={{ transformOrigin: '44px 31px' }}
                  />
                  <ellipse
                    cx="56"
                    cy="31"
                    rx="2.6"
                    ry="3.4"
                    fill="#0B0E1A"
                    className="animate-blink"
                    style={{ transformOrigin: '56px 31px' }}
                  />
                  <path
                    d="M45 38 q5 4 10 0"
                    stroke="#0B0E1A"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    fill="none"
                  />
                </>
              )}
            </>
          )}

          {/*
            Faiscas da comemoracao. So existem neste humor -- particula parada
            na tela o tempo todo vira sujeira, e o brilho perde o significado.
          */}
          {mood === 'cheer' && (
            <g className="animate-pop">
              <path d="M22 26 l2 -6 2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 Z" fill="currentColor" />
              <path d="M76 34 l1.5 -4.5 1.5 4.5 4.5 1.5 -4.5 1.5 -1.5 4.5 -1.5 -4.5 -4.5 -1.5 Z" fill="currentColor" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
