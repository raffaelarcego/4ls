import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AnswerOption } from '../../components/AnswerOption';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter, SkipButton } from '../../components/LessonFooter';
import { ProgressBar } from '../../components/ProgressBar';
import { scoreTone } from '../../lib/ui';
import { api, errorMessage } from '../../services/api';
import { MorphologyLesson, SessionActivity } from '../../types';

/**
 * Bloco de casos: a palavra muda de forma conforme a função.
 *
 * O produto ensinava a ORDEM das peças (estrutura, can-do) e o SIGNIFICADO da
 * palavra (conceitos). Nenhum dos dois ensinava que a palavra muda — e em
 * alemão e russo ela muda em toda frase. O aluno montava a ordem certa com a
 * forma errada, que para um nativo soa pior que a ordem trocada.
 *
 * A tela tem duas partes, e a ordem entre elas é a aula:
 *
 * 1. A TABELA VIVA de uma palavra que ele já conhece. Ver "работа / работы /
 *    работе" numa coluna, com a pergunta de cada caso ao lado, ensina a
 *    terminação muito melhor do que ler que "o dativo marca o destinatário".
 * 2. A PRODUÇÃO: a frase com a forma escondida. As alternativas são as outras
 *    formas da mesma palavra — os concorrentes reais, não distratores inventados.
 */
export function MorphologyRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const [phase, setPhase] = useState<'table' | 'drills'>('table');

  const lesson = useQuery<MorphologyLesson>({
    queryKey: ['morphology', 'lesson', activity.languageCode],
    queryFn: async () =>
      (await api.get('/morphology/lesson', { params: { language: activity.languageCode } })).data,
    retry: false,
  });

  if (lesson.isPending) {
    return (
      <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
        <p className="font-serif text-lg font-semibold text-eel">Abrindo a tabela...</p>
        <p className="max-w-sm text-sm text-wolf">
          Uma palavra que você já conhece, em todas as formas que ela assume.
        </p>
      </div>
    );
  }

  if (lesson.isError || !lesson.data) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <p className="font-serif text-lg font-semibold text-eel">Não consegui abrir a tabela</p>
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

  if (phase === 'drills') {
    return <Drills lesson={lesson.data} onFinish={onFinish} onSkip={onSkip} />;
  }

  return <Table lesson={lesson.data} onContinue={() => setPhase('drills')} onSkip={onSkip} />;
}

function Table({
  lesson,
  onContinue,
  onSkip,
}: {
  lesson: MorphologyLesson;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const { word, slot } = lesson;
  const bySlot = new Map(word.forms.map((f) => [f.slotId, f]));

  return (
    <>
      <div className="space-y-4">
        <div className="card space-y-2">
          <p className="font-mono text-xs text-hare">
            casos do {lesson.languageName.toLowerCase()}, nível {lesson.level}
          </p>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 lang={lesson.languageCode} className="font-serif text-2xl font-bold leading-tight text-eel">
                {word.term}
              </h2>
              <p className="text-sm text-wolf">
                {word.gloss}
                {word.gender ? ` · ${word.gender}` : ''} · {word.pattern}
              </p>
            </div>
            <AudioButton text={word.term} languageCode={lesson.languageCode} />
          </div>
        </div>

        {/*
          O caso do dia vem ANTES da tabela, e com a pergunta grande: "dativo"
          não diz nada a quem não sabe o que é dativo, "a quem?" diz. O nome do
          caso é só o rótulo que acompanha.
        */}
        <div className="card space-y-2 border-macaw bg-macaw-soft">
          <p className="section-title text-macaw-dark">Hoje: {slot.name}</p>
          <p className="font-serif text-lg font-semibold leading-snug text-eel">{slot.question}</p>
          <p className="text-sm text-macaw-dark">Aparece com: {slot.triggers.join(', ')}</p>
          <p className="border-l-2 border-macaw pl-3 text-sm italic leading-snug text-wolf">
            {slot.trap}
          </p>
        </div>

        <div className="card space-y-1">
          <p className="section-title mb-2">A tabela inteira</p>
          {lesson.slots.map((info) => {
            const form = bySlot.get(info.id);
            const isFocus = info.id === slot.id;
            const mastery = lesson.mastery[info.id];

            return (
              <div
                key={info.id}
                className={`rounded-md border px-3 py-2 ${
                  isFocus ? 'border-macaw bg-macaw-soft' : 'border-transparent'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] uppercase tracking-wide text-hare">
                      {info.name}
                      {info.locked && ' · ainda não'}
                    </p>
                    <p lang={lesson.languageCode} className="text-lg font-semibold text-eel">
                      {form?.form ?? '—'}
                    </p>
                    {form?.romanization && (
                      <p className="font-mono text-xs text-macaw-dark">{form.romanization}</p>
                    )}
                    <p className="text-xs text-wolf">{info.question}</p>
                    {form?.note && <p className="mt-1 text-xs italic text-wolf">{form.note}</p>}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {form && (
                      <AudioButton
                        text={form.form}
                        languageCode={lesson.languageCode}
                        size="sm"
                      />
                    )}
                    {typeof mastery === 'number' && (
                      <span className={`font-mono text-[11px] ${scoreTone(mastery).text}`}>
                        {mastery}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <LessonFooter detail="A tabela sai da tela no treino — é produzindo a forma que ela firma.">
        <SkipButton onSkip={onSkip} />
        <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={onContinue}>
          Treinar
        </button>
      </LessonFooter>
    </>
  );
}

function Drills({
  lesson,
  onFinish,
  onSkip,
}: {
  lesson: MorphologyLesson;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{ slotId: string; correct: boolean }>>([]);

  const record = useMutation({
    mutationFn: async (all: Array<{ slotId: string; correct: boolean }>) => {
      const { data } = await api.post('/morphology/record', {
        languageCode: lesson.languageCode,
        results: all,
      });
      return data;
    },
  });

  const drill = lesson.drills[index];
  const byId = new Map(lesson.slots.map((s) => [s.id, s]));

  if (lesson.drills.length === 0) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <p className="font-serif text-lg font-semibold text-eel">Tabela vista</p>
          <p className="max-w-sm text-sm text-wolf">
            Esta palavra ainda não tem frases de exemplo para treinar.
          </p>
        </div>
        <LessonFooter>
          <button className="btn-primary px-8" onClick={() => onFinish(70)}>
            Concluir
          </button>
        </LessonFooter>
      </>
    );
  }

  if (!drill) {
    const correct = results.filter((r) => r.correct).length;
    const score = Math.round((correct / results.length) * 100);

    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <p className="font-serif text-xl font-semibold text-eel">
            {correct} de {results.length} formas certas
          </p>
          <p className="max-w-sm text-sm text-wolf">
            {score >= 70
              ? 'A terminação está firmando — e ela vale para todas as palavras deste padrão.'
              : 'O caso mais fraco volta amanhã: é ele que trava as frases desta função.'}
          </p>
        </div>
        <LessonFooter tone={score >= 70 ? 'correct' : 'neutral'} title={`${score}% de acerto`}>
          <button
            className="btn-primary px-8"
            onClick={() => {
              // O progresso é por CASO, e é ele que escolhe a aula de amanhã; se
              // a gravação falhar, o bloco ainda conclui e credita o XP.
              record.mutate(results);
              onFinish(score);
            }}
          >
            Continuar
          </button>
        </LessonFooter>
      </>
    );
  }

  const answered = picked !== null;
  const isCorrect = picked === drill.answer;
  const info = byId.get(drill.slotId);

  function next() {
    setPicked(null);
    setIndex((i) => i + 1);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={lesson.drills.length} size="sm" tone="bg-macaw" />
          <span className="shrink-0 font-mono text-xs text-hare">
            {index + 1}/{lesson.drills.length}
          </span>
        </div>

        {/*
          A PERGUNTA do caso fica na tela durante o exercício, e a tabela não.
          É a pergunta que ele precisa aprender a fazer sozinho na hora de falar;
          a lista de formas seria só copiar de cima.
        */}
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-hare">
            {info?.name ?? drill.slotId}
          </p>
          <p className="font-serif text-base italic text-wolf">{info?.question}</p>
        </div>

        <div className="card space-y-1">
          <p lang={lesson.languageCode} className="text-xl leading-relaxed text-eel">
            {drill.sentence}
          </p>
          <p className="text-sm text-wolf">{drill.translation}</p>
        </div>

        <div className="grid gap-2.5">
          {drill.options.map((option) => (
            <AnswerOption
              key={option}
              lang={lesson.languageCode}
              disabled={answered}
              state={
                !answered
                  ? 'idle'
                  : option === drill.answer
                    ? 'correct'
                    : picked === option
                      ? 'wrong'
                      : 'idle'
              }
              onClick={() => {
                if (answered) return;
                setPicked(option);
                setResults((r) => [...r, { slotId: drill.slotId, correct: option === drill.answer }]);
              }}
            >
              {option}
            </AnswerOption>
          ))}
        </div>
      </div>

      <LessonFooter
        tone={answered ? (isCorrect ? 'correct' : 'wrong') : 'neutral'}
        title={answered ? (isCorrect ? 'Isso mesmo' : `A forma certa é ${drill.answer}`) : undefined}
        detail={
          answered ? (
            <span className="flex items-center gap-2">
              <span lang={lesson.languageCode}>
                {drill.sentence.replace('____', drill.answer)}
              </span>
              <AudioButton
                text={drill.sentence.replace('____', drill.answer)}
                languageCode={lesson.languageCode}
                size="sm"
              />
            </span>
          ) : (
            'Escolha a forma que a frase pede.'
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
