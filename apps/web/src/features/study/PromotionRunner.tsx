import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AnswerOption } from '../../components/AnswerOption';
import { AudioButton } from '../../components/AudioButton';
import { Hero } from '../../components/Hero';
import { LessonFooter, SkipButton } from '../../components/LessonFooter';
import { ProgressBar } from '../../components/ProgressBar';
import { SentenceBuilder } from '../../components/SentenceBuilder';
import { languageTheme } from '../../lib/ui';
import { api, errorMessage } from '../../services/api';
import {
  PromotionAttempt,
  PromotionExam,
  PromotionItem,
  PromotionRound,
  SessionActivity,
} from '../../types';

/** O nome de cada rodada e o que ela cobra — o mesmo texto do backend. */
const ROUND: Record<PromotionRound, { title: string; blurb: string }> = {
  sentences: { title: 'Montar a frase', blurb: 'A ordem das peças, sem rótulo e sem dica.' },
  reading: { title: 'Entender o texto', blurb: 'Detalhes das histórias que você leu.' },
  vocabulary: { title: 'Saber a palavra', blurb: 'Termos que você deu por aprendidos.' },
};

/**
 * O chefe de fase: o exame que sobe o idioma de nível.
 *
 * É o único bloco com CONSEQUÊNCIA. Todos os outros terminam em XP e numa nota
 * que ajusta o plano de amanhã; este muda o nível do idioma, e o nível é o teto
 * de todo o conteúdo que o app serve. Por isso a tela se parece mais com a
 * prova mensal do que com uma aula: sem regra escrita, sem dica, sem segunda
 * tentativa, e o resultado só no fim.
 *
 * Duas decisões que valem explicar, porque em qualquer outro bloco seriam
 * erradas:
 *
 * - NÃO DIZ "certo" OU "errado" item a item. Num exame com consequência, saber
 *   na hora muda como ele encara o resto: dois erros seguidos e ele responde o
 *   final com medo. A resposta certa aparece — esconder seria pior —, mas sem
 *   veredito.
 * - A DERROTA APONTA UMA RODADA. "Não passou" não ensina nada; "a montagem de
 *   frase afundou" é o que ele treina na semana de espera.
 */
export function PromotionRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const [phase, setPhase] = useState<'briefing' | 'exam'>('briefing');

  const exam = useQuery<PromotionExam>({
    queryKey: ['promotion', 'exam', activity.languageCode],
    queryFn: async () =>
      (await api.get('/promotion/exam', { params: { language: activity.languageCode } })).data,
    retry: false,
    // O exame não pode mudar embaixo do aluno no meio dele.
    staleTime: Infinity,
  });

  if (exam.isPending) {
    return (
      <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
        <p className="font-serif text-lg font-semibold text-eel">Convocando o chefe...</p>
        <p className="max-w-sm text-sm text-wolf">
          Só o que você já estudou em {activity.languageName}.
        </p>
      </div>
    );
  }

  /*
   * Erro aqui quase sempre é o portão fechado (403), não uma falha: o bloco
   * pode ter sido aberto num momento em que o chefe ainda estava disponível. A
   * mensagem do backend já diz o que falta, então ela é o texto da tela.
   */
  if (exam.isError || !exam.data) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <p className="font-serif text-lg font-semibold text-eel">O chefe não está disponível</p>
          <p className="max-w-sm text-sm text-wolf">{errorMessage(exam.error)}</p>
        </div>
        <LessonFooter tone="neutral">
          <button className="btn-primary px-8" onClick={onSkip}>
            Voltar
          </button>
        </LessonFooter>
      </>
    );
  }

  if (phase === 'briefing') {
    return <Briefing exam={exam.data} onStart={() => setPhase('exam')} onSkip={onSkip} />;
  }

  return <Exam exam={exam.data} onFinish={onFinish} onSkip={onSkip} />;
}

/**
 * O aviso antes do exame.
 *
 * Existe porque a consequência é real: perder fecha o chefe por uma semana. Um
 * bloco que começasse direto, no meio da sessão, faria o aluno descobrir a
 * aposta depois de tê-la feito.
 */
function Briefing({
  exam,
  onStart,
  onSkip,
}: {
  exam: PromotionExam;
  onStart: () => void;
  onSkip: () => void;
}) {
  const theme = languageTheme(exam.languageCode);
  const rounds = [...new Set(exam.items.map((i) => i.round))];

  return (
    <>
      <div className="space-y-4">
        <div className="card flex flex-col items-center gap-3 text-center">
          <Hero mood="idle" size="md" accent="text-bee" />

          <div>
            <p className="section-title">Chefe de fase</p>
            <p className="font-serif text-2xl font-bold leading-tight text-eel">
              {exam.languageName}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className={`chip ${theme.border} ${theme.text}`}>{exam.currentLevel}</span>
            <span className="font-mono text-hare" aria-hidden>
              &rarr;
            </span>
            <span className="chip border-bee text-bee">{exam.nextLevel}</span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="section-title">As {rounds.length} rodadas</p>
          {rounds.map((round, i) => (
            <div key={round} className="card flex items-start gap-3 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-snow font-mono text-sm text-wolf">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-eel">{ROUND[round].title}</p>
                <p className="text-sm text-wolf">{ROUND[round].blurb}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="rounded-md border border-bee bg-bee-soft px-4 py-3 text-sm leading-snug text-bee-dark">
          Sem dica e sem segunda tentativa. Se não passar, o chefe volta em uma semana — e o plano
          do dia ataca o que faltou até lá.
        </p>
      </div>

      <LessonFooter detail={`${exam.items.length} itens, tudo que você já estudou neste idioma.`}>
        <SkipButton onSkip={onSkip} label="Agora não" confirmLabel="Sair mesmo?" />
        <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={onStart}>
          Encarar
        </button>
      </LessonFooter>
    </>
  );
}

function Exam({
  exam,
  onFinish,
  onSkip,
}: {
  exam: PromotionExam;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Array<{ round: PromotionRound; correct: boolean }>>([]);
  const [answered, setAnswered] = useState(false);

  const attempt = useMutation({
    mutationFn: async (all: Array<{ round: PromotionRound; correct: boolean }>) => {
      const { data } = await api.post('/promotion/attempt', {
        languageCode: exam.languageCode,
        results: all,
      });
      return data as PromotionAttempt;
    },
  });

  const item = exam.items[index];

  if (!item) {
    return (
      <Result
        exam={exam}
        result={attempt.data ?? null}
        pending={attempt.isPending}
        error={attempt.isError ? errorMessage(attempt.error) : null}
        onSettle={() => attempt.mutate(results)}
        onFinish={onFinish}
      />
    );
  }

  // O primeiro item de cada rodada anuncia a rodada: o chefe tem fases, e sem
  // o anuncio a troca de formato parece o exame mudando de ideia.
  const startsRound = index === 0 || exam.items[index - 1].round !== item.round;

  function answer(correct: boolean) {
    setAnswered(true);
    setResults((r) => [...r, { round: item.round, correct }]);
  }

  function next() {
    setAnswered(false);
    setIndex((i) => i + 1);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={exam.items.length} size="sm" tone="bg-bee" />
          <span className="shrink-0 font-mono text-xs text-hare">
            {index + 1}/{exam.items.length}
          </span>
        </div>

        {startsRound && (
          <div className="rounded-md border border-swan bg-white px-4 py-2">
            <p className="section-title">{ROUND[item.round].title}</p>
            <p className="text-xs text-wolf">{ROUND[item.round].blurb}</p>
          </div>
        )}

        {item.scrambled ? (
          <Assembly
            key={index}
            item={item}
            languageCode={exam.languageCode}
            answered={answered}
            onAnswer={answer}
          />
        ) : (
          <Choice
            key={index}
            item={item}
            languageCode={exam.languageCode}
            answered={answered}
            onAnswer={answer}
          />
        )}
      </div>

      {answered ? (
        /*
          Sem "certo" nem "errado", como na prova mensal: o veredito item a item
          transformaria o exame numa sequência de pequenas derrotas, e o que
          importa aqui é o resultado no fim. A resposta certa aparece porque ele
          acabou de tentar e merece vê-la.
        */
        <LessonFooter
          title="Resposta certa"
          detail={
            <span className="flex items-center gap-2">
              <span lang={exam.languageCode} className="font-serif text-base text-eel">
                {item.answer}
              </span>
              <AudioButton text={item.answer} languageCode={exam.languageCode} size="sm" />
            </span>
          }
        >
          <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={next}>
            Continuar
          </button>
        </LessonFooter>
      ) : (
        <LessonFooter detail="Sem dica e sem repetir — é isto que faz o nível valer.">
          <SkipButton onSkip={onSkip} label="Desistir" confirmLabel="Desistir mesmo?" />
        </LessonFooter>
      )}
    </>
  );
}

function Assembly({
  item,
  languageCode,
  answered,
  onAnswer,
}: {
  item: PromotionItem;
  languageCode: string;
  answered: boolean;
  onAnswer: (correct: boolean) => void;
}) {
  // O backend já embaralhou; aqui só se dá o formato do componente. Sem rótulo:
  // com ele, a ordem vira dedução a partir do português.
  const chunks = useMemo(
    () => (item.scrambled ?? []).map((text) => ({ text, label: '' })),
    [item],
  );

  return (
    <SentenceBuilder
      prompt={item.prompt}
      chunks={chunks}
      answer={item.answer}
      languageCode={languageCode}
      answered={answered}
      onAnswer={onAnswer}
      showLabels={false}
    />
  );
}

function Choice({
  item,
  languageCode,
  answered,
  onAnswer,
}: {
  item: PromotionItem;
  languageCode: string;
  answered: boolean;
  onAnswer: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <p lang={languageCode} className="min-w-0 flex-1 text-xl font-medium leading-snug">
          {item.prompt}
        </p>
        <AudioButton text={item.prompt} languageCode={languageCode} />
      </div>

      <div className="grid gap-2.5">
        {(item.options ?? []).map((option) => (
          <AnswerOption
            key={option}
            // As opções de vocabulário são significados em português; as de
            // leitura, alternativas no idioma. O `lang` acompanha.
            lang={item.round === 'vocabulary' ? 'pt' : languageCode}
            disabled={answered}
            state={picked === option ? 'selected' : 'idle'}
            onClick={() => {
              if (answered) return;
              setPicked(option);
              onAnswer(option === item.answer);
            }}
          >
            {option}
          </AnswerOption>
        ))}
      </div>
    </div>
  );
}

/**
 * O resultado, de uma vez.
 *
 * A gravação acontece aqui e não no fim do último item, porque é ela que
 * promove: mandar o resultado antes de a tela existir deixaria o aluno subindo
 * de nível numa tela de carregamento.
 */
function Result({
  exam,
  result,
  pending,
  error,
  onSettle,
  onFinish,
}: {
  exam: PromotionExam;
  result: PromotionAttempt | null;
  pending: boolean;
  error: string | null;
  onSettle: () => void;
  onFinish: (score: number) => void;
}) {
  if (!result) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <p className="font-serif text-lg font-semibold text-eel">
            {error ? 'Não consegui registrar o exame' : 'Contando os acertos...'}
          </p>
          {error && <p className="max-w-sm text-sm text-wolf">{error}</p>}
        </div>
        <LessonFooter tone={error ? 'wrong' : 'neutral'}>
          {error && (
            <button className="btn-plain" onClick={() => onFinish(0)}>
              Sair
            </button>
          )}
          <button
            className="btn-primary flex-1 px-10 sm:flex-none"
            onClick={onSettle}
            disabled={pending}
          >
            {pending ? 'Enviando...' : error ? 'Tentar de novo' : 'Ver o resultado'}
          </button>
        </LessonFooter>
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="card flex flex-col items-center gap-2 text-center">
          <Hero
            mood={result.passed ? 'cheer' : 'sad'}
            size="lg"
            accent={result.passed ? 'text-grass' : 'text-wolf'}
          />

          {result.passed ? (
            <>
              <p className="font-serif text-2xl font-bold text-eel">
                {exam.languageName} agora é {result.level}
              </p>
              <p className="max-w-sm text-sm text-wolf">
                O conteúdo sobe junto: as frases, os textos e as aulas deste idioma passam a vir no
                nível novo.
              </p>
            </>
          ) : (
            <>
              <p className="font-serif text-2xl font-bold text-eel">O chefe resistiu</p>
              <p className="max-w-sm text-sm text-wolf">
                {result.weakest
                  ? `Foi ${ROUND[result.weakest].title.toLowerCase()} que afundou. É isso que o plano do dia vai puxar.`
                  : 'Faltou pouco no conjunto. Ele volta em uma semana.'}
              </p>
            </>
          )}

          <p className="font-mono text-4xl font-bold tabular-nums text-bee">{result.score}%</p>
        </div>

        <div className="space-y-2">
          <p className="section-title">Por rodada</p>
          {result.rounds.map((round) => {
            const pct = Math.round((round.correct / round.total) * 100);
            return (
              <div key={round.round} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-sm text-wolf">
                  {ROUND[round.round].title}
                </span>
                <ProgressBar value={pct} tone={pct >= 60 ? 'bg-grass' : 'bg-cardinal'} />
                <span className="w-12 shrink-0 text-right font-mono text-sm font-bold text-eel">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <LessonFooter
        tone={result.passed ? 'correct' : 'neutral'}
        title={result.passed ? `${result.from} → ${result.level}` : 'Volta em uma semana'}
      >
        <button
          className="btn-primary flex-1 px-10 sm:flex-none"
          onClick={() => onFinish(result.score)}
        >
          Concluir
        </button>
      </LessonFooter>
    </>
  );
}
