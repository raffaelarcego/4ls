import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { LessonFooter } from '../../components/LessonFooter';
import { ProgressBar } from '../../components/ProgressBar';
import { useSpeaker } from '../../lib/speech';
import { api, errorMessage } from '../../services/api';
import { SessionActivity } from '../../types';

interface Sentence {
  text: string;
  translation: string;
  focus: string;
}

/**
 * Ditado: o app fala, o aluno escreve.
 *
 * Junta escuta e ortografia num exercicio so, e a correcao e palavra a palavra
 * -- ver exatamente qual palavra saiu errada ensina mais que um "errou" seco.
 */
export function DictationRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const speaker = useSpeaker();
  const [sentences, setSentences] = useState<Sentence[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [plays, setPlays] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const generate = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/tutor/dictation', {
        languageCode: activity.languageCode,
        count: 5,
      });
      return data.sentences as Sentence[];
    },
    onSuccess: (data) => setSentences(data),
  });

  const sentence = sentences?.[index];

  // Fala a frase automaticamente ao chegar nela: e um ditado, o audio e o
  // enunciado. O primeiro play acontece depois do clique em "Gerar", entao a
  // politica de autoplay do navegador ja foi satisfeita.
  useEffect(() => {
    if (!sentence) return;
    setPlays(1);
    void speaker.speak(sentence.text, activity.languageCode);
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentence?.text]);

  if (!sentences) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <span className={`text-6xl ${generate.isPending ? 'animate-float' : ''}`}>
            {generate.isError ? '🔌' : '✏️'}
          </span>
          <p className="text-lg font-black">
            {generate.isPending ? 'Preparando as frases...' : 'Ditado'}
          </p>
          <p className="max-w-sm text-sm font-semibold text-wolf">
            {generate.isError
              ? errorMessage(generate.error)
              : 'Você ouve a frase e escreve o que ouviu. Escuta e ortografia no mesmo exercício.'}
          </p>
        </div>

        <LessonFooter tone={generate.isError ? 'wrong' : 'neutral'}>
          <button className="btn-plain" onClick={onSkip}>
            Pular bloco
          </button>
          <button
            className="btn-primary flex-1 px-10 sm:flex-none"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? 'Gerando...' : generate.isError ? 'Tentar de novo' : 'Começar'}
          </button>
        </LessonFooter>
      </>
    );
  }

  if (!sentence) {
    const score = Math.round((correct / sentences.length) * 100);
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <span className="animate-pop text-6xl">{score >= 70 ? '🎉' : '💪'}</span>
          <p className="text-xl font-black">
            {correct} de {sentences.length} frases exatas
          </p>
          <p className="text-sm font-semibold text-wolf">
            {score >= 70 ? 'Ouvido e grafia batendo.' : 'As palavras que escaparam voltam depois.'}
          </p>
        </div>
        <LessonFooter tone={score >= 70 ? 'correct' : 'neutral'} title={`${score}% de acerto`}>
          <button className="btn-primary px-8" onClick={() => onFinish(score)}>
            Continuar
          </button>
        </LessonFooter>
      </>
    );
  }

  const diff = compareWords(answer, sentence.text);
  const isPerfect = diff.every((word) => word.ok);

  function replay() {
    setPlays((p) => p + 1);
    void speaker.speak(sentence!.text, activity.languageCode);
  }

  function next() {
    if (checked && isPerfect) setCorrect((c) => c + 1);
    setChecked(false);
    setAnswer('');
    setIndex((i) => i + 1);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={sentences.length} size="sm" tone="bg-macaw" />
          <span className="shrink-0 text-xs font-extrabold uppercase tracking-wider text-hare">
            {index + 1}/{sentences.length}
          </span>
        </div>

        <div className="card flex flex-col items-center gap-3 text-center">
          <button
            onClick={replay}
            className={`flex h-24 w-24 items-center justify-center rounded-full border-2 border-b-[6px] text-4xl transition active:translate-y-[3px] active:border-b-2 ${
              speaker.isSpeaking
                ? 'border-macaw-dark bg-macaw text-white'
                : 'border-macaw bg-macaw-soft'
            }`}
            aria-label="Ouvir a frase de novo"
          >
            🔊
          </button>
          <p className="text-xs font-extrabold uppercase tracking-wider text-hare">
            {plays} {plays === 1 ? 'escuta' : 'escutas'} · toque para repetir
          </p>
          <p className="chip bg-snow text-wolf">{sentence.focus}</p>
        </div>

        <input
          ref={inputRef}
          className="input text-lg"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !checked && answer.trim()) setChecked(true);
          }}
          disabled={checked}
          placeholder="Escreva o que você ouviu"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {checked && (
          <div className="card space-y-3">
            <div>
              <p className="section-title mb-1.5">Palavra a palavra</p>
              <p className="flex flex-wrap gap-1.5">
                {diff.map((word, i) => (
                  <span
                    key={i}
                    className={`rounded-lg px-2 py-1 text-sm font-bold ${
                      word.ok
                        ? 'bg-grass-soft text-grass-dark'
                        : 'bg-cardinal-soft text-cardinal-dark line-through decoration-2'
                    }`}
                    title={word.ok ? undefined : `você escreveu: ${word.typed || '—'}`}
                  >
                    {word.expected}
                  </span>
                ))}
              </p>
            </div>
            <div className="rounded-xl bg-snow p-3">
              <p className="text-sm font-bold">{sentence.text}</p>
              <p className="text-xs font-semibold text-wolf">{sentence.translation}</p>
            </div>
          </div>
        )}
      </div>

      {checked ? (
        <LessonFooter
          tone={isPerfect ? 'correct' : 'wrong'}
          title={isPerfect ? 'Exato!' : 'Quase lá'}
          detail={
            isPerfect
              ? undefined
              : `${diff.filter((w) => !w.ok).length} ${
                  diff.filter((w) => !w.ok).length === 1 ? 'palavra saiu' : 'palavras saíram'
                } diferente do áudio.`
          }
        >
          <button
            className={`${isPerfect ? 'btn-primary' : 'btn-danger'} flex-1 px-10 sm:flex-none`}
            onClick={next}
          >
            Continuar
          </button>
        </LessonFooter>
      ) : (
        <LessonFooter>
          <button className="btn-plain" onClick={onSkip}>
            Pular bloco
          </button>
          <button
            className="btn-primary flex-1 px-10 sm:flex-none"
            onClick={() => setChecked(true)}
            disabled={!answer.trim()}
          >
            Verificar
          </button>
        </LessonFooter>
      )}
    </>
  );
}

interface WordDiff {
  expected: string;
  typed: string;
  ok: boolean;
}

/**
 * Compara posicao a posicao, ignorando caixa e pontuacao.
 *
 * Nao e um diff de edicao: se o aluno pula uma palavra, o resto desalinha e
 * aparece como errado. Num ditado isso e aceitavel -- a frase e curta e o que
 * importa e ele ver onde parou de acompanhar.
 */
function compareWords(typed: string, expected: string): WordDiff[] {
  const typedWords = tokenize(typed);
  const expectedWords = expected.split(/\s+/).filter(Boolean);

  return expectedWords.map((word, i) => ({
    expected: word,
    typed: typedWords[i] ?? '',
    ok: normalizeWord(typedWords[i] ?? '') === normalizeWord(word),
  }));
}

function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[.,!?;:¿¡"'»«]/g, '')
    .trim();
}
