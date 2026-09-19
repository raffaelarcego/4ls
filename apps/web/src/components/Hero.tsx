import { useEffect, useRef, useState } from 'react';

/**
 * O personagem, animado a partir de uma SPRITE SHEET.
 *
 * A primeira versao desenhava o boneco em SVG a mao. Estava ruim, e a razao e
 * estrutural, nao de capricho: um personagem de jogo depende de peso, timing e
 * deformacao entre quadros -- o corpo se estica no pulo, o pe achata no chao --
 * e nada disso sai de formas geometricas interpoladas por CSS. Quadro desenhado
 * por ilustrador resolve em cinco poses o que o SVG nao alcanca com vinte
 * keyframes.
 *
 * COMO OS QUADROS ANDAM
 *
 * O passo de quadro e feito em JavaScript, e nao com `steps()` do CSS. Parece
 * mais trabalho e e menos: `steps()` so sabe repetir em laco, e metade das
 * poses aqui NAO repete -- cair e machucar tocam uma vez e SEGURAM o ultimo
 * quadro. Em CSS isso vira `animation-fill-mode` mais `animationend` mais um
 * keyframe por contagem de quadros; aqui e um indice e um `setInterval`.
 *
 * Sao no maximo dois personagens na tela ao mesmo tempo (rodape da licao e
 * cabecalho), entao o custo de um timer por instancia nao aparece em lugar
 * nenhum.
 */

/* ------------------------------------------------------------------ *
 * CONFIGURACAO DA FOLHA
 *
 * Estes numeros sao a unica coisa que muda quando a arte muda. Estao no topo,
 * juntos e sozinhos, exatamente por isso.
 *
 * ATENCAO -- os valores abaixo sao uma LEITURA da folha, nao uma medicao: a
 * imagem foi descrita, nao medida. Se o personagem aparecer cortado ou
 * "pulando" entre poses, o erro esta aqui e em mais lugar nenhum: confira
 * `FRAME` contra a largura real do PNG dividida pelo numero de colunas.
 * ------------------------------------------------------------------ */

/** Onde o arquivo vive, servido a partir de `apps/web/public/`. */
const SHEET_URL = '/hero-sprite.png';

/** A folha inteira, em celulas. A linha mais cheia define as colunas. */
const GRID = { cols: 6, rows: 3 };

/** O tamanho de UMA celula, em pixels da imagem original. */
const FRAME = { w: 100, h: 173 };

/** Uma sequencia de quadros: as colunas que ela usa, na linha em que ela vive. */
interface Clip {
  row: number;
  cols: number[];
  /** Quadros por segundo. Corrida pede mais que caminhada. */
  fps: number;
  /** Repete em laco, ou toca uma vez e segura o ultimo quadro. */
  loop: boolean;
}

/**
 * As poses da folha.
 *
 * A leitura da imagem: a primeira linha caminha (quatro poses) e termina numa
 * queda; a segunda e um ciclo de corrida de seis; a terceira avanca empurrando
 * e termina se machucando. Os nomes aqui descrevem a POSE, nao o uso -- quem
 * decide qual pose serve a qual momento e o `MOOD_CLIP` logo abaixo.
 */
const CLIPS = {
  walk: { row: 0, cols: [0, 1, 2, 3], fps: 8, loop: true },
  slide: { row: 0, cols: [4], fps: 1, loop: false },
  run: { row: 1, cols: [0, 1, 2, 3, 4, 5], fps: 12, loop: true },
  push: { row: 2, cols: [0, 1, 2, 3], fps: 8, loop: true },
  hurt: { row: 2, cols: [4], fps: 1, loop: false },
} satisfies Record<string, Clip>;

/**
 * Que pose cada humor usa.
 *
 * Esta camada existe para o resto do app nunca falar em "linha 2, coluna 4".
 * As telas pedem `mood="cheer"`; trocar a folha de arte por outra, com outra
 * ordem de quadros, mexe so nesta tabela e em `CLIPS`.
 */
const MOOD_CLIP: Record<HeroMood, keyof typeof CLIPS> = {
  // Parado nao existe nesta folha. Caminhar devagar le como "esperando voce",
  // que e exatamente o papel dele na tela inicial.
  idle: 'walk',
  cheer: 'push',
  sad: 'hurt',
  focus: 'run',
};

export type HeroMood = 'idle' | 'cheer' | 'sad' | 'focus';

/** Altura renderizada. A largura sai da proporcao real do quadro. */
const SIZES = { sm: 64, md: 104, lg: 156 } as const;

export function Hero({
  mood = 'idle',
  size = 'md',
  accent = 'text-macaw',
  className = '',
}: {
  mood?: HeroMood;
  size?: keyof typeof SIZES;
  /** Classe de COR (text-*): tinge o halo atras do personagem. */
  accent?: string;
  className?: string;
}) {
  const clip = CLIPS[MOOD_CLIP[mood]];
  const [frame, setFrame] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');

  // Sem o arquivo em disco a tela nao pode quebrar: o app inteiro ja usa o
  // personagem, e um 404 deixaria buracos no rodape de toda licao.
  useEffect(() => {
    const img = new Image();
    img.onload = () => setStatus('ready');
    img.onerror = () => setStatus('missing');
    img.src = SHEET_URL;
  }, []);

  /*
   * O laco de quadros.
   *
   * Reinicia quando o humor muda -- por isso `mood` esta nas dependencias e
   * nao so o clip: voltar ao quadro zero e o que faz a comemoracao ser vista
   * desde o comeco a cada acerto, em vez de entrar no meio do movimento.
   */
  const frames = clip.cols.length;
  const holdRef = useRef(false);

  useEffect(() => {
    setFrame(0);
    holdRef.current = false;

    // Quem pediu menos movimento recebe a pose parada, nao a sequencia.
    const still =
      frames <= 1 ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    if (still) return;

    const timer = window.setInterval(() => {
      setFrame((current) => {
        const next = current + 1;
        if (next < frames) return next;
        if (clip.loop) return 0;
        // Sequencia que nao repete para no ultimo quadro e fica la.
        holdRef.current = true;
        return current;
      });
    }, 1000 / clip.fps);

    return () => window.clearInterval(timer);
  }, [mood, frames, clip.fps, clip.loop]);

  const height = SIZES[size];
  const scale = height / FRAME.h;
  const width = Math.round(FRAME.w * scale);
  const col = clip.cols[Math.min(frame, frames - 1)];

  if (status === 'missing') {
    return <MissingSheet width={width} height={height} accent={accent} className={className} />;
  }

  return (
    <div
      className={`relative ${accent} ${className}`}
      style={{ width, height }}
      // Decorativo: o estado real ja esta escrito em texto ao lado, e descrever
      // um boneco nao acrescenta nada a quem usa leitor de tela.
      aria-hidden="true"
    >
      {/* Halo do contexto atras do personagem -- e o que o liga a cor da tela
          em que ele esta (verde no acerto, rosa no erro, violeta no russo). */}
      <span
        className="absolute inset-x-0 bottom-0 top-1/4 rounded-full bg-current opacity-[0.12] blur-xl"
        aria-hidden
      />

      <div
        className="relative h-full w-full transition-opacity duration-200"
        style={{
          opacity: status === 'ready' ? 1 : 0,
          backgroundImage: `url(${SHEET_URL})`,
          // A folha inteira e escalada junto com o quadro, e so entao deslocada.
          backgroundSize: `${GRID.cols * FRAME.w * scale}px ${GRID.rows * FRAME.h * scale}px`,
          backgroundPosition: `-${col * FRAME.w * scale}px -${clip.row * FRAME.h * scale}px`,
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
}

/**
 * O lugar do personagem enquanto a arte nao chegou.
 *
 * Nao desenha um substituto: mostra um vazio silencioso do tamanho certo, para
 * o layout ficar identico ao que sera com a folha no lugar. Um boneco
 * provisorio aqui seria confundido com o resultado final.
 */
function MissingSheet({
  width,
  height,
  accent,
  className,
}: {
  width: number;
  height: number;
  accent: string;
  className: string;
}) {
  return (
    <div
      className={`relative ${accent} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
      title="Falta apps/web/public/hero-sprite.png"
    >
      <span className="absolute inset-0 rounded-full bg-current opacity-[0.08]" />
    </div>
  );
}
