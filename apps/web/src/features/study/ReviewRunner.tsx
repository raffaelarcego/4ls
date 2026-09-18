import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter, SkipButton } from '../../components/LessonFooter';
import { ProgressBar } from '../../components/ProgressBar';
import { languageTheme } from '../../lib/ui';
import { api } from '../../services/api';
import { ReviewGrade, ReviewItem } from '../../types';

const GRADES: Array<{ grade: ReviewGrade; label: string; className: string }> = [
  { grade: 'again', label: 'Errei', className: 'border-cardinal bg-cardinal text-snow' },
  { grade: 'hard', label: 'Difícil', className: 'border-bee bg-bee text-snow' },
  { grade: 'good', label: 'Acertei', className: 'border-grass bg-grass text-snow' },
  { grade: 'easy', label: 'Fácil', className: 'border-macaw bg-macaw text-snow' },
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
  /** O aluno pediu o andaime neste card -- ele so aparece a pedido. */
  const [hinted, setHinted] = useState(false);

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
    return <div className="h-56 animate-pulse rounded-lg bg-snow" />;
  }

  if (!items || items.length === 0) {
    return (
      <>
        <EmptyOrDone title="Revisão em dia" text="Nenhum card venceu neste idioma." />
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
          title={`${correct} de ${items.length} acertos`}
          text={
            score >= 70
              ? 'Os que você errou voltam mais cedo.'
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
    setHinted(false);
    setIndex((i) => i + 1);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={items.length} size="sm" tone="bg-macaw" />
          <span className="shrink-0 font-mono text-xs text-hare">
            {index + 1}/{items.length}
          </span>
        </div>

        <div
          key={item.id}
          className="card flex min-h-[16rem] flex-col items-center justify-center gap-4 text-center"
        >
          <div className="flex w-full items-center justify-center gap-3">
            {/* min-w-0: composto alemao ou termo russo longo empurrava a tela em 360px. */}
            <p lang={languageCode} className="min-w-0 font-serif text-3xl font-semibold text-eel">
              {item.term}
            </p>
            <AudioButton text={item.term} languageCode={languageCode} />
          </div>

          {revealed ? (
            <div className="w-full space-y-3">
              <p className="text-xl font-medium text-macaw-dark">{item.meaning}</p>
              {item.example && (
                <div className="flex items-start gap-2.5 rounded-md bg-snow p-3.5 text-left">
                  <div className="min-w-0 flex-1">
                    <p lang={languageCode} className="italic text-eel">
                      {item.example}
                    </p>
                    {item.translation && (
                      <p className="mt-1 text-sm text-wolf">{item.translation}</p>
                    )}
                  </div>
                  <AudioButton text={item.example} languageCode={languageCode} size="sm" />
                </div>
              )}
            </div>
          ) : (
            <div className="w-full space-y-3">
              <p className="text-sm text-wolf">Tente lembrar o significado antes de revelar.</p>

              {/*
                O andaime: a mesma coisa num idioma que o aluno ja domina.
                So existe quando o significado ja firmou em outro idioma e a
                forma deste ainda nao -- ou seja, exatamente quando o problema e
                puxar a palavra, e nao entender o conceito. E ele fica atras de
                um botao porque a dica dada cedo demais rouba o esforco de
                recuperacao, que e o que consolida a memoria.
              */}
              {item.scaffold &&
                (hinted ? (
                  <div
                    className={`mx-auto flex max-w-xs items-center justify-center gap-2.5 rounded-md border px-3.5 py-2.5 ${
                      languageTheme(item.scaffold.languageCode).border
                    } ${languageTheme(item.scaffold.languageCode).soft}`}
                  >
                    <span aria-hidden className="font-mono text-lg">
                      {languageTheme(item.scaffold.languageCode).mark}
                    </span>
                    <div className="min-w-0 text-left">
                      <p
                        lang={item.scaffold.languageCode}
                        className="font-serif text-base font-semibold leading-tight"
                      >
                        {item.scaffold.term}
                      </p>
                      <p className="section-label">você já sabe esta</p>
                    </div>
                  </div>
                ) : (
                  <button
                    className="btn-ghost tap-target mx-auto w-full max-w-xs"
                    onClick={() => setHinted(true)}
                  >
                    Dica: como é em outro idioma
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {revealed ? (
        <LessonFooter
          title="Quão fácil foi?"
          detail={
            /*
             * A mensagem muda conforme o que o conceito ja mostrou. Quando o
             * significado esta firme em outros idiomas e este card nao, a tela
             * para de tratar o erro como "nao sabe a palavra" e diz o que
             * realmente esta acontecendo -- e o aluno para de achar que esta
             * recomecando do zero num idioma em que ja avancou.
             */
            item.scaffold
              ? 'Você já sabe este conceito em outro idioma — aqui falta só a forma.'
              : 'Isso define quando o card volta.'
          }
        >
          {/*
            2x2 no celular: quatro botoes lado a lado em 360px sobravam ~80px
            cada, e "Difícil"/"Acertei" so cabiam encolhendo a fonte abaixo do
            legivel. Em 2x2 cada alvo fica com largura de sobra e 44px de altura.
          */}
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-4">
            {GRADES.map((option) => (
              <button
                key={option.grade}
                onClick={() => handleGrade(option.grade)}
                className={`btn tap-target px-3 py-2.5 text-sm ${option.className}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </LessonFooter>
      ) : (
        <LessonFooter>
          <SkipButton onSkip={onSkip} />
          <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={() => setRevealed(true)}>
            Revelar
          </button>
        </LessonFooter>
      )}
    </>
  );
}

function EmptyOrDone({ title, text }: { title: string; text: string }) {
  return (
    <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
      <p className="font-serif text-xl font-semibold text-eel">{title}</p>
      <p className="text-sm text-wolf">{text}</p>
    </div>
  );
}
