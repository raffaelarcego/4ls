import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AnswerOption } from '../../components/AnswerOption';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter, SkipButton } from '../../components/LessonFooter';
import { ProgressBar } from '../../components/ProgressBar';
import { languageTheme } from '../../lib/ui';
import { api, errorMessage } from '../../services/api';
import { SessionActivity, TrapsLesson } from '../../types';

const LANGUAGE_NAME: Record<string, string> = {
  pt: 'português',
  en: 'inglês',
  es: 'espanhol',
  de: 'alemão',
  ru: 'russo',
};

/**
 * Armadilhas cruzadas: escolher a forma certa com a importada do lado.
 *
 * O painel de interferência já dizia qual idioma estava contaminando qual, e
 * mandava estudar o contraste. Mas aula sobre interferência não desfaz
 * interferência — o que desfaz é escolher a forma certa muitas vezes, com a
 * errada à vista, até a primeira que vem à cabeça deixar de ser a importada.
 *
 * O que torna este bloco diferente de qualquer outro do app: boa parte do
 * conteúdo é **dele**. A alternativa errada é, literalmente, a frase que ele
 * escreveu e que o tutor corrigiu. Por isso a tela marca esses itens — ver "isto
 * foi você que escreveu" muda o peso da escolha.
 *
 * E é o único lugar do produto onde um erro se resolve sozinho: acertar a mesma
 * armadilha algumas vezes fecha o registro dele no Error Intelligence.
 */
export function TrapsRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{ id: string; correct: boolean }>>([]);

  const lesson = useQuery<TrapsLesson>({
    queryKey: ['traps', 'lesson', activity.languageCode],
    queryFn: async () =>
      (await api.get('/traps/lesson', { params: { language: activity.languageCode } })).data,
    retry: false,
    // A rodada não pode ser remontada no meio dela: os itens sairiam de ordem.
    staleTime: Infinity,
  });

  const record = useMutation({
    mutationFn: async (all: Array<{ id: string; correct: boolean }>) => {
      const { data } = await api.post('/traps/record', {
        languageCode: activity.languageCode,
        results: all,
      });
      return data as { score: number; resolved: number };
    },
  });

  if (lesson.isPending) {
    return (
      <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
        <p className="font-serif text-lg font-semibold text-eel">Separando as armadilhas...</p>
        <p className="max-w-sm text-sm text-wolf">
          As suas primeiro — os erros que outra língua sua já causou.
        </p>
      </div>
    );
  }

  if (lesson.isError || !lesson.data) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <p className="font-serif text-lg font-semibold text-eel">Não consegui montar a rodada</p>
          <p className="max-w-sm text-sm text-wolf">{errorMessage(lesson.error)}</p>
        </div>
        <LessonFooter tone="wrong">
          <SkipButton onSkip={onSkip} />
          <button className="btn-primary px-8" onClick={() => lesson.refetch()}>
            Tentar de novo
          </button>
        </LessonFooter>
      </>
    );
  }

  const { items } = lesson.data;
  const item = items[index];

  if (items.length === 0) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <p className="font-serif text-lg font-semibold text-eel">Nenhuma armadilha por aqui</p>
          <p className="max-w-sm text-sm text-wolf">
            Não há erro de interferência aberto em {lesson.data.languageName}, e o catálogo deste
            nível já foi todo visto.
          </p>
        </div>
        <LessonFooter>
          <button className="btn-primary px-8" onClick={() => onFinish(90)}>
            Seguir
          </button>
        </LessonFooter>
      </>
    );
  }

  if (!item) {
    const correct = results.filter((r) => r.correct).length;
    const score = Math.round((correct / results.length) * 100);
    const resolved = record.data?.resolved ?? 0;

    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <p className="font-serif text-xl font-semibold text-eel">
            {correct} de {results.length} armadilhas evitadas
          </p>
          <p className="max-w-sm text-sm text-wolf">
            {resolved > 0
              ? `${resolved} ${resolved === 1 ? 'erro seu foi fechado' : 'erros seus foram fechados'} — eles saem do seu perfil e param de puxar o plano do dia.`
              : score >= 70
                ? 'A forma certa está vindo primeiro. Continue acertando e esses erros fecham sozinhos.'
                : 'As que você errou voltam: é a repetição entre os dias que desfaz a importação.'}
          </p>
        </div>
        <LessonFooter tone={score >= 70 ? 'correct' : 'neutral'} title={`${score}% de acerto`}>
          <button
            className="btn-primary px-8"
            onClick={() => {
              // A gravação é o que fecha os erros; se ela falhar, o bloco ainda
              // conclui e credita o XP.
              record.mutate(results);
              onFinish(score);
            }}
            disabled={record.isPending}
          >
            Continuar
          </button>
        </LessonFooter>
      </>
    );
  }

  const answered = picked !== null;
  const isCorrect = picked === item.answer;
  const target = languageTheme(lesson.data.languageCode);
  const source = languageTheme(item.sourceCode);

  function next() {
    setPicked(null);
    setIndex((i) => i + 1);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={items.length} size="sm" tone="bg-bee" />
          <span className="shrink-0 font-mono text-xs text-hare">
            {index + 1}/{items.length}
          </span>
        </div>

        {/*
          A origem aparece ANTES da escolha, e não depois.
          Saber que "o espanhol está entrando aqui" é a informação que faz o
          aluno desconfiar da forma que lhe parece natural — que é exatamente o
          hábito que o bloco existe para criar. Guardá-la para a explicação
          deixaria a dica chegar quando ela já não muda nada.
        */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${source.soft} ${source.text}`}>
            {LANGUAGE_NAME[item.sourceCode] ?? item.sourceCode}
          </span>
          <span aria-hidden className="text-sm text-hare">
            →
          </span>
          <span className={`chip ${target.soft} ${target.text}`}>{lesson.data.languageName}</span>
          {item.own && (
            <span className="chip border-cardinal text-cardinal-dark">erro seu</span>
          )}
        </div>

        <div>
          {item.gloss ? (
            <p className="font-serif text-xl font-semibold leading-snug text-eel">{item.gloss}</p>
          ) : (
            <p className="font-serif text-lg italic leading-snug text-wolf">
              Qual das duas está certa?
            </p>
          )}
        </div>

        <div className="grid gap-2.5">
          {item.options.map((option) => (
            <AnswerOption
              key={option}
              lang={lesson.data!.languageCode}
              disabled={answered}
              state={
                !answered
                  ? 'idle'
                  : option === item.answer
                    ? 'correct'
                    : picked === option
                      ? 'wrong'
                      : 'idle'
              }
              onClick={() => {
                if (answered) return;
                setPicked(option);
                setResults((r) => [...r, { id: item.id, correct: option === item.answer }]);
              }}
            >
              {option}
            </AnswerOption>
          ))}
        </div>
      </div>

      <LessonFooter
        tone={answered ? (isCorrect ? 'correct' : 'wrong') : 'neutral'}
        title={answered ? (isCorrect ? 'Isso mesmo' : 'A outra é a importada') : undefined}
        detail={
          answered ? (
            <span className="flex items-start gap-2">
              <span className="min-w-0">{item.why}</span>
              <AudioButton
                text={item.answer}
                languageCode={lesson.data!.languageCode}
                size="sm"
              />
            </span>
          ) : (
            'Uma delas é a frase que sai quando a outra língua vaza.'
          )
        }
      >
        <SkipButton onSkip={onSkip} />
        <button
          className="btn-primary flex-1 px-10 sm:flex-none"
          onClick={next}
          disabled={!answered}
        >
          Continuar
        </button>
      </LessonFooter>
    </>
  );
}
