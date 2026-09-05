import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter } from '../../components/LessonFooter';
import { ProgressBar } from '../../components/ProgressBar';
import { api } from '../../services/api';
import { ReviewGrade, ReviewItem } from '../../types';

const GRADES: Array<{ grade: ReviewGrade; emoji: string; label: string; className: string }> = [
  {
    grade: 'again',
    emoji: '😵',
    label: 'Errei',
    className: 'bg-cardinal text-white shadow-[0_4px_0_theme(colors.cardinal-dark)]',
  },
  {
    grade: 'hard',
    emoji: '😅',
    label: 'Difícil',
    className: 'bg-beak text-white shadow-[0_4px_0_#D97E00]',
  },
  {
    grade: 'good',
    emoji: '🙂',
    label: 'Acertei',
    className: 'bg-grass text-white shadow-[0_4px_0_theme(colors.grass-dark)]',
  },
  {
    grade: 'easy',
    emoji: '😎',
    label: 'Fácil',
    className: 'bg-macaw text-white shadow-[0_4px_0_theme(colors.macaw-dark)]',
  },
];

/** Flashcards com repeticao espacada, para atividades do tipo "review". */
export function ReviewRunner({
  languageCode,
  onFinish,
  onSkip,
}: {
  languageCode: string;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);

  const { data: items, isLoading } = useQuery<ReviewItem[]>({
    queryKey: ['review', 'due', languageCode],
    queryFn: async () => {
      const { data } = await api.get('/review/due', {
        params: { language: languageCode, limit: 15 },
      });
      return data;
    },
  });

  const grade = useMutation({
    mutationFn: async ({ id, grade }: { id: string; grade: ReviewGrade }) => {
      const { data } = await api.post(`/review/${id}/grade`, { grade });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
    },
  });

  if (isLoading) {
    return <div className="h-56 animate-pulse rounded-2xl bg-snow" />;
  }

  if (!items || items.length === 0) {
    return (
      <>
        <EmptyOrDone emoji="✨" title="Revisão em dia" text="Nenhum card venceu neste idioma." />
        <LessonFooter tone="correct" title="Nada para revisar" detail="Você está em dia por aqui.">
          <button className="btn-primary px-8" onClick={() => onFinish(100)}>
            Continuar
          </button>
        </LessonFooter>
      </>
    );
  }

  const item = items[index];

  // Acabaram os cards: a nota da atividade e a taxa de acerto.
  if (!item) {
    const score = Math.round((correct / items.length) * 100);
    return (
      <>
        <EmptyOrDone
          emoji={score >= 70 ? '🎉' : '💪'}
          title={`${correct} de ${items.length} acertos`}
          text={
            score >= 70
              ? 'Boa! Os que você errou voltam mais cedo.'
              : 'Os difíceis voltam logo — é assim que fixam.'
          }
        />
        <LessonFooter tone={score >= 70 ? 'correct' : 'neutral'} title={`${score}% de acerto`}>
          <button className="btn-primary px-8" onClick={() => onFinish(score)}>
            Continuar
          </button>
        </LessonFooter>
      </>
    );
  }

  function handleGrade(value: ReviewGrade) {
    grade.mutate({ id: item.id, grade: value });
    if (value !== 'again') setCorrect((c) => c + 1);
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={items.length} size="sm" tone="bg-macaw" />
          <span className="shrink-0 text-xs font-extrabold uppercase tracking-wider text-hare">
            {index + 1}/{items.length}
          </span>
        </div>

        <div
          key={item.id}
          className="animate-pop card flex min-h-[16rem] flex-col items-center justify-center gap-4 text-center"
        >
          <div className="flex items-center gap-3">
            <p className="text-3xl font-black">{item.term}</p>
            <AudioButton text={item.term} languageCode={languageCode} />
          </div>

          {revealed ? (
            <div className="w-full space-y-3">
              <p className="text-xl font-extrabold text-macaw-dark">{item.meaning}</p>
              {item.example && (
                <div className="flex items-start gap-2.5 rounded-2xl bg-snow p-3.5 text-left">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold italic text-eel">{item.example}</p>
                    {item.translation && (
                      <p className="mt-1 text-sm font-semibold text-wolf">{item.translation}</p>
                    )}
                  </div>
                  <AudioButton text={item.example} languageCode={languageCode} size="sm" />
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm font-semibold text-hare">
              Tente lembrar o significado antes de revelar.
            </p>
          )}
        </div>
      </div>

      {revealed ? (
        <LessonFooter title="Quão fácil foi?" detail="Isso define quando o card volta.">
          <div className="grid w-full grid-cols-4 gap-2 sm:w-auto">
            {GRADES.map((option) => (
              <button
                key={option.grade}
                onClick={() => handleGrade(option.grade)}
                className={`btn flex-col gap-0.5 px-2 py-2.5 text-[11px] active:translate-y-[4px] active:shadow-none sm:px-4 ${option.className}`}
              >
                <span aria-hidden className="text-lg leading-none">
                  {option.emoji}
                </span>
                {option.label}
              </button>
            ))}
          </div>
        </LessonFooter>
      ) : (
        <LessonFooter>
          <button className="btn-plain" onClick={onSkip}>
            Pular bloco
          </button>
          <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={() => setRevealed(true)}>
            Revelar
          </button>
        </LessonFooter>
      )}
    </>
  );
}

function EmptyOrDone({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
      <span className="animate-pop text-6xl">{emoji}</span>
      <p className="text-xl font-black">{title}</p>
      <p className="text-sm font-semibold text-wolf">{text}</p>
    </div>
  );
}
