import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AnswerInput } from '../../components/AnswerField';
import { LessonFooter, SkipButton } from '../../components/LessonFooter';
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
  //
  // O foco no campo NAO e dado aqui: no celular o teclado subia junto com o
  // audio e cobria metade da tela antes de ele ter lido qualquer coisa. Ele
  // toca no campo quando estiver pronto para escrever.
  useEffect(() => {
    if (!sentence) return;
    setPlays(1);
    void speaker.speak(sentence.text, activity.languageCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentence?.text]);

  if (!sentences) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <p className="font-serif text-lg font-semibold text-eel">
            {generate.isPending ? 'Preparando as frases...' : 'Ditado'}
          </p>
          <p className="max-w-sm text-sm text-wolf">
            {generate.isError
              ? errorMessage(generate.error)
              : 'Você ouve a frase e escreve o que ouviu. Escuta e ortografia no mesmo exercício.'}
          </p>
        </div>

        <LessonFooter tone={generate.isError ? 'wrong' : 'neutral'}>
          <SkipButton onSkip={onSkip} />
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
          <p className="font-serif text-xl font-semibold text-eel">
            {correct} de {sentences.length} frases exatas
          </p>
          <p className="text-sm text-wolf">
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
          <span className="shrink-0 font-mono text-xs text-hare">
            {index + 1}/{sentences.length}
          </span>
        </div>

        <div className="card flex flex-col items-center gap-3 text-center">
          <button
            onClick={replay}
            className={`btn w-full max-w-xs ${
              speaker.isSpeaking
                ? 'border-macaw-dark bg-macaw text-snow'
                : 'border-macaw bg-macaw-soft text-macaw-dark'
            }`}
          >
            Ouvir a frase de novo
          </button>
          <p className="font-mono text-xs text-hare">
            {plays} {plays === 1 ? 'escuta' : 'escutas'}
          </p>
          <p className="chip bg-snow text-wolf">{sentence.focus}</p>
        </div>

        {/*
          O campo declara o idioma ditado: o corretor em portugues trocava
          `der` por `de` e a comparacao literal marcava como erro o que ele
          tinha escrito certo.
        */}
        <AnswerInput
          value={answer}
          onChange={setAnswer}
          languageCode={activity.languageCode}
          onSubmit={() => {
            if (!checked && answer.trim()) setChecked(true);
          }}
          disabled={checked}
          placeholder="Escreva o que você ouviu"
          className="text-lg"
        />

        {checked && (
          <div className="card space-y-3">
            <div>
              <p className="section-title mb-1.5">Palavra a palavra</p>
              {/*
                O que ele digitou fica VISIVEL embaixo da palavra esperada. Antes
                vivia num `title`, que no celular nao existe: ele via que errou a
                palavra e nunca o que tinha escrito -- justamente a informacao que
                ensina a diferenca.
              */}
              <div className="flex flex-wrap gap-1.5">
                {diff.map((word, i) => (
                  <span
                    key={i}
                    className={`rounded-md px-2 py-1 text-sm ${
                      word.ok
                        ? 'bg-grass-soft text-grass-dark'
                        : 'bg-cardinal-soft text-cardinal-dark'
                    }`}
                  >
                    <span lang={activity.languageCode} className="font-medium">
                      {word.expected}
                    </span>
                    {!word.ok && (
                      <span className="mt-0.5 block text-xs line-through">
                        {word.typed || 'nada'}
                      </span>
                    )}
                  </span>
                ))}
              </div>
              {diff.some((word) => !word.ok) && (
                <p className="section-label mt-1.5">riscado: o que você escreveu</p>
              )}
            </div>
            <div className="rounded-md bg-snow p-3">
              <p lang={activity.languageCode} className="text-sm font-medium">
                {sentence.text}
              </p>
              <p className="text-xs text-wolf">{sentence.translation}</p>
            </div>
          </div>
        )}
      </div>

      {checked ? (
        <LessonFooter
          tone={isPerfect ? 'correct' : 'wrong'}
          title={isPerfect ? 'Exato' : 'Quase lá'}
          detail={
            isPerfect
              ? undefined
              : `${diff.filter((w) => !w.ok).length} ${
                  diff.filter((w) => !w.ok).length === 1 ? 'palavra saiu' : 'palavras saíram'
                } diferente do áudio.`
          }
        >
          <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={next}>
            Continuar
          </button>
        </LessonFooter>
      ) : (
        <LessonFooter>
          <SkipButton onSkip={onSkip} />
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
