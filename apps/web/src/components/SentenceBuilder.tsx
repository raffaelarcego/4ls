import { useState } from 'react';

/** Um pedaço da frase, com o papel que ele cumpre. */
export interface BuilderChunk {
  text: string;
  /** QUEM, SER, ONDE, AÇÃO... em português. */
  label: string;
}

/**
 * Montar a frase pondo os pedaços na ordem.
 *
 * É o exercício central do produto: saber o que "nicht" quer dizer não prova
 * nada sobre saber onde ele entra, e "onde entra" é a única pergunta que o
 * aluno realmente tem. Também é o único formato de produção que dá para
 * corrigir objetivamente — comparar texto livre com a frase-modelo marcaria
 * variante legítima como erro, que ensina o contrário do certo.
 *
 * Vive aqui, e não dentro de um runner, porque dois blocos precisam dele com
 * intenções opostas:
 *
 * - Nos Fundamentos ele ENSINA, e por isso mostra os rótulos: a aula não é
 *   adivinhar qual palavra vem primeiro, é ver que neste idioma o papel "SER"
 *   ocupa aquela posição.
 * - Na avaliação ele MEDE, e aí os rótulos saem. Com eles à vista, a ordem
 *   vira dedução a partir da dica em português em vez de lembrança do idioma —
 *   e a prova passaria a medir raciocínio, não retenção.
 */
export function SentenceBuilder({
  prompt,
  chunks,
  answer,
  languageCode,
  answered,
  onAnswer,
  showLabels = true,
}: {
  /** O que dizer, em português. */
  prompt: string;
  /** Os pedaços JÁ embaralhados por quem chama. */
  chunks: BuilderChunk[];
  /** A ordem certa, já juntada por espaços. */
  answer: string;
  languageCode: string;
  answered: boolean;
  onAnswer: (correct: boolean) => void;
  /** Mostra o papel de cada peça. Ensino sim, medição não. */
  showLabels?: boolean;
}) {
  const [placed, setPlaced] = useState<number[]>([]);
  const available = chunks.map((_, i) => i).filter((i) => !placed.includes(i));
  const complete = placed.length === chunks.length;

  const Piece = ({
    index,
    onClick,
    placedStyle,
  }: {
    index: number;
    onClick: () => void;
    placedStyle: boolean;
  }) => {
    const chunk = chunks[index];
    return (
      <button
        type="button"
        disabled={answered}
        onClick={onClick}
        className={`tap-target rounded-md border px-3 py-2 text-left transition-colors ${
          placedStyle ? 'border-macaw bg-white' : 'border-swan bg-white'
        }`}
      >
        {showLabels && (
          <span className="block font-mono text-[10px] uppercase leading-tight text-hare">
            {chunk.label}
          </span>
        )}
        <span lang={languageCode} className="block font-serif text-xl text-eel">
          {chunk.text}
        </span>
      </button>
    );
  };

  return (
    <>
      <div className="space-y-2">
        <p className="font-serif text-lg font-semibold leading-snug text-eel">Monte a frase:</p>
        <p className="font-serif text-xl leading-snug text-macaw-dark">{prompt}</p>
      </div>

      {/* Altura mínima para a tela não pular a cada toque. */}
      <div className="flex min-h-[5rem] flex-wrap items-end gap-2 rounded-xl border border-swan bg-snow p-3">
        {placed.length === 0 && (
          <p className="self-center text-sm text-hare">Toque nas peças abaixo, na ordem.</p>
        )}
        {placed.map((chunkIndex, position) => (
          <Piece
            key={`${chunkIndex}-${position}`}
            index={chunkIndex}
            placedStyle
            onClick={() => setPlaced((p) => p.filter((_, i) => i !== position))}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {available.map((chunkIndex) => (
          <Piece
            key={chunkIndex}
            index={chunkIndex}
            placedStyle={false}
            onClick={() => setPlaced((p) => [...p, chunkIndex])}
          />
        ))}
      </div>

      {!answered && (
        <button
          className="btn-primary w-full py-3"
          disabled={!complete}
          onClick={() => onAnswer(placed.map((i) => chunks[i].text).join(' ') === answer)}
        >
          {complete ? 'Verificar' : 'Use todas as peças'}
        </button>
      )}
    </>
  );
}
