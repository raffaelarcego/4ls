import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter } from '../../components/LessonFooter';
import { ProgressBar } from '../../components/ProgressBar';
import { api, errorMessage } from '../../services/api';
import { SessionActivity } from '../../types';
import { DictationRunner } from './DictationRunner';
import { ListeningRunner } from './ListeningRunner';
import { SpeakingRunner } from './SpeakingRunner';

interface Exercise {
  prompt: string;
  type: 'multiple_choice' | 'fill_blank' | 'translate';
  options: string[];
  answer: string;
  explanation: string;
}

/** Tipos para os quais a IA consegue gerar exercicios objetivos e corrigiveis. */
const EXERCISE_TYPES = new Set(['grammar', 'vocabulary', 'reading']);

export function GenericRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  // Cada tipo com correcao propria tem seu runner. O bloco autoavaliado deixou
  // de ser o destino de tudo que nao e exercicio: hoje so sobra o que ainda nao
  // tem como ser medido automaticamente.
  if (EXERCISE_TYPES.has(activity.type)) {
    return <ExerciseRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  if (activity.type === 'listening') {
    return <ListeningRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  if (activity.type === 'dictation') {
    return <DictationRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  if (activity.type === 'speaking') {
    return <SpeakingRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  return <SelfAssessedBlock activity={activity} onFinish={onFinish} onSkip={onSkip} />;
}

function ExerciseRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(0);

  const generate = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/tutor/exercises', {
        languageCode: activity.languageCode,
        type: activity.type,
        count: 5,
      });
      return data.exercises as Exercise[];
    },
    onSuccess: (data) => setExercises(data),
  });

  if (!exercises) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <span className={`text-6xl ${generate.isPending ? 'animate-float' : ''}`}>
            {generate.isError ? '🔌' : '🤖'}
          </span>
          <p className="text-lg font-black">
            {generate.isPending ? 'Escrevendo seus exercícios...' : 'Exercícios sob medida'}
          </p>
          <p className="max-w-sm text-sm font-semibold text-wolf">
            {generate.isError
              ? errorMessage(generate.error)
              : 'Eles são gerados a partir dos seus erros recorrentes neste idioma.'}
          </p>
        </div>

        <LessonFooter tone={generate.isError ? 'wrong' : 'neutral'}>
          {generate.isError ? (
            <>
              <button className="btn-plain" onClick={() => onFinish(0)}>
                Seguir sem exercícios
              </button>
              <button className="btn-primary px-8" onClick={() => generate.mutate()}>
                Tentar de novo
              </button>
            </>
          ) : (
            <>
              <button className="btn-plain" onClick={onSkip}>
                Pular bloco
              </button>
              <button
                className="btn-primary flex-1 px-10 sm:flex-none"
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
              >
                {generate.isPending ? 'Gerando...' : 'Gerar exercícios'}
              </button>
            </>
          )}
        </LessonFooter>
      </>
    );
  }

  const exercise = exercises[index];

  if (!exercise) {
    const score = Math.round((correct / exercises.length) * 100);
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <span className="animate-pop text-6xl">{score >= 70 ? '🎉' : '💪'}</span>
          <p className="text-xl font-black">
            {correct} de {exercises.length} acertos
          </p>
          <p className="text-sm font-semibold text-wolf">
            {score >= 70 ? 'Esse ponto está firmando.' : 'Ainda vale insistir aqui.'}
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

  const isCorrect = normalize(answer) === normalize(exercise.answer);

  function next() {
    if (checked && isCorrect) setCorrect((c) => c + 1);
    setChecked(false);
    setAnswer('');
    setIndex((i) => i + 1);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={exercises.length} size="sm" tone="bg-macaw" />
          <span className="shrink-0 text-xs font-extrabold uppercase tracking-wider text-hare">
            {index + 1}/{exercises.length}
          </span>
        </div>

        <div className="flex items-start gap-3">
          <p className="flex-1 text-xl font-black leading-snug">{exercise.prompt}</p>
          <AudioButton text={exercise.prompt} languageCode={activity.languageCode} />
        </div>

        {exercise.options?.length > 0 ? (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {exercise.options.map((option, i) => {
              const selected = answer === option;
              const state = !checked
                ? selected
                  ? 'border-macaw bg-macaw-soft text-macaw-dark'
                  : 'border-swan bg-white hover:bg-snow'
                : option === exercise.answer
                  ? 'border-grass bg-grass-soft text-grass-dark'
                  : selected
                    ? 'border-cardinal bg-cardinal-soft text-cardinal-dark'
                    : 'border-swan bg-white text-hare';

              return (
                <button
                  key={option}
                  onClick={() => !checked && setAnswer(option)}
                  disabled={checked}
                  className={`flex items-center gap-3 rounded-2xl border-2 border-b-[4px] px-4 py-3.5 text-left font-bold transition active:translate-y-[2px] active:border-b-2 ${state}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-current text-xs font-black opacity-60">
                    {i + 1}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            className="input text-lg"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={checked}
            placeholder="Digite sua resposta"
            autoFocus
          />
        )}
      </div>

      {checked ? (
        <LessonFooter
          tone={isCorrect ? 'correct' : 'wrong'}
          title={isCorrect ? 'Isso mesmo!' : `Resposta certa: ${exercise.answer}`}
          detail={exercise.explanation}
        >
          <button
            className={`${isCorrect ? 'btn-primary' : 'btn-danger'} flex-1 px-10 sm:flex-none`}
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
            disabled={!answer}
          >
            Verificar
          </button>
        </LessonFooter>
      )}
    </>
  );
}

/**
 * Blocos sem correcao automatica (listening, speaking, writing, tutor).
 * O usuario cumpre o bloco e registra a propria percepcao -- essa nota
 * alimenta as subcompetencias CEFR ate existir avaliacao automatica.
 */
function SelfAssessedBlock({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const instructions: Record<string, { emoji: string; text: string }> = {
    writing: {
      emoji: '✍️',
      text: 'Escreva um texto curto no idioma. Use o Writing Lab do tutor para receber correção.',
    },
    tutor: { emoji: '🤖', text: 'Converse com o tutor de IA neste idioma.' },
  };
  const instruction = instructions[activity.type] ?? {
    emoji: '⭐',
    text: 'Cumpra este bloco e avalie seu desempenho ao final.',
  };

  const [score, setScore] = useState<number | null>(null);

  const options = [
    { label: 'Difícil', emoji: '😵', score: 35, className: 'border-cardinal bg-cardinal-soft text-cardinal-dark' },
    { label: 'Ok', emoji: '🙂', score: 65, className: 'border-bee bg-bee-soft text-bee-dark' },
    { label: 'Tranquilo', emoji: '😎', score: 90, className: 'border-grass bg-grass-soft text-grass-dark' },
  ];

  return (
    <>
      <div className="space-y-4">
        <div className="card flex flex-col items-center gap-3 text-center">
          <span className="text-6xl">{instruction.emoji}</span>
          <p className="max-w-md text-lg font-bold leading-snug">{instruction.text}</p>
          {activity.type === 'tutor' && (
            <Link to="/tutor" className="btn-blue">
              Abrir o tutor
            </Link>
          )}
        </div>

        <div>
          <p className="section-title mb-2">Como você se saiu?</p>
          <div className="grid grid-cols-3 gap-2.5">
            {options.map((option) => (
              <button
                key={option.label}
                onClick={() => setScore(option.score)}
                className={`flex flex-col items-center gap-1 rounded-2xl border-2 border-b-[4px] px-2 py-4 text-xs font-extrabold uppercase tracking-wide transition active:translate-y-[2px] active:border-b-2 ${
                  score === option.score ? option.className : 'border-swan bg-white text-wolf hover:bg-snow'
                }`}
              >
                <span aria-hidden className="text-3xl">
                  {option.emoji}
                </span>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <LessonFooter
        tone={score === null ? 'neutral' : 'correct'}
        title={score === null ? undefined : 'Anotado!'}
        detail={score === null ? 'Escolha uma nota para concluir o bloco.' : 'Isso ajusta o plano de amanhã.'}
      >
        <button className="btn-plain" onClick={onSkip}>
          Pular bloco
        </button>
        <button
          className="btn-primary flex-1 px-10 sm:flex-none"
          onClick={() => score !== null && onFinish(score)}
          disabled={score === null}
        >
          Concluir
        </button>
      </LessonFooter>
    </>
  );
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[.,!?;:]$/, '');
}
