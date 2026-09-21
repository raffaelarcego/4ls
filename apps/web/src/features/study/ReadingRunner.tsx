import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AnswerOption } from '../../components/AnswerOption';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter, SkipButton } from '../../components/LessonFooter';
import { ProgressBar } from '../../components/ProgressBar';
import { languageTheme } from '../../lib/ui';
import { api, errorMessage } from '../../services/api';
import { ReadingLesson, SessionActivity } from '../../types';

/**
 * Bloco de leitura: a MESMA historia nos quatro idiomas.
 *
 * Este era o ultimo bloco sem conteudo proprio -- ele caia nos exercicios
 * gerados, e "compreensao de texto" sem texto e um quiz com outro nome.
 *
 * O que ele faz de diferente de qualquer leitura de app de idioma: o texto de
 * hoje em alemao e a MESMA historia que ele leu semana passada em ingles,
 * alinhada frase a frase. Isso muda as duas pontas da leitura:
 *
 * - ENTRAR NO TEXTO. Ele ja sabe o que esta escrito ali, e e isso que permite
 *   ler acima do proprio nivel sem travar na terceira linha. A tela diz isso na
 *   cara, logo no topo: "voce ja leu esta historia em ingles".
 * - SAIR DA DUVIDA. Tocar numa frase abre a mesma frase nos outros tres
 *   idiomas. O contraste aparece no ponto exato em que a duvida apareceu, que e
 *   o unico lugar onde ele ensina.
 *
 * A traducao em portugues vem antes das outras linguas, e nao junto: a pergunta
 * de quem travou e "o que isso quer dizer", e so depois "como fica nas outras".
 * Abrir as quatro de uma vez transforma a leitura numa tabela.
 */
export function ReadingRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const [phase, setPhase] = useState<'read' | 'quiz'>('read');

  const lesson = useQuery<ReadingLesson>({
    queryKey: ['reading', 'lesson', activity.languageCode],
    queryFn: async () => {
      const { data } = await api.get('/reading/lesson', {
        params: { language: activity.languageCode },
      });
      return data;
    },
    retry: false,
  });

  if (lesson.isPending) {
    return (
      <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
        <p className="font-serif text-lg font-semibold text-eel">Abrindo o texto...</p>
        <p className="max-w-sm text-sm text-wolf">
          A mesma história que você lê nos outros três idiomas.
        </p>
      </div>
    );
  }

  if (lesson.isError || !lesson.data) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <p className="font-serif text-lg font-semibold text-eel">Não consegui abrir o texto</p>
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

  if (phase === 'quiz') {
    return <Comprehension lesson={lesson.data} onFinish={onFinish} onSkip={onSkip} />;
  }

  return <Passage lesson={lesson.data} onContinue={() => setPhase('quiz')} onSkip={onSkip} />;
}

function Passage({
  lesson,
  onContinue,
  onSkip,
}: {
  lesson: ReadingLesson;
  onContinue: () => void;
  onSkip: () => void;
}) {
  /** Qual frase esta aberta. Uma por vez: duas abertas viram tabela. */
  const [open, setOpen] = useState<number | null>(null);
  /** Nas quais ele ja pediu para ver os outros idiomas. */
  const [compared, setCompared] = useState<number[]>([]);

  const theme = languageTheme(lesson.languageCode);

  return (
    <>
      <div className="space-y-4">
        <div className="card space-y-2">
          <p className="font-mono text-xs text-hare">
            {lesson.genre}, nível {lesson.level}
          </p>
          <h2 lang={lesson.languageCode} className="font-serif text-xl font-semibold leading-tight text-eel">
            {lesson.version.title}
          </h2>
          <p className="font-serif text-sm italic text-wolf">{lesson.title}</p>

          {lesson.alsoRead.length > 0 && (
            /*
              O aviso mais util da tela, e ele e curto de proposito: saber que a
              historia ja e conhecida e o que faz o aluno entrar num texto russo
              que, sem isso, ele fecharia na segunda linha.
            */
            <p className="rounded-md border border-grass bg-grass-soft px-3 py-2 text-sm text-grass-dark">
              Você já leu esta história em{' '}
              <span className="font-semibold">{lesson.alsoRead.map(languageName).join(' e ')}</span>.
              O conteúdo você já tem — aqui o que muda é a língua.
            </p>
          )}
        </div>

        <p className="border-l-2 border-swan pl-3 font-serif text-sm italic leading-snug text-wolf">
          Repare: {lesson.focus}
        </p>

        <div className="card space-y-1">
          {lesson.version.sentences.map((sentence, i) => {
            const isOpen = open === i;
            const showsOthers = compared.includes(i);

            return (
              <div key={i} className="border-b border-swan py-2 last:border-0">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="min-w-0 flex-1 text-left"
                    aria-expanded={isOpen}
                  >
                    <p lang={lesson.languageCode} className="leading-relaxed text-eel">
                      {sentence.text}
                    </p>
                    {sentence.romanization && (
                      <p className="font-mono text-xs text-macaw-dark">{sentence.romanization}</p>
                    )}
                  </button>
                  <AudioButton text={sentence.text} languageCode={lesson.languageCode} size="sm" />
                </div>

                {isOpen && (
                  <div className="mt-2 space-y-2 rounded-md bg-snow p-3">
                    <p className="text-sm text-wolf">{sentence.translation}</p>

                    {showsOthers ? (
                      <div className="space-y-2">
                        {lesson.others.map((other) => {
                          const line = other.sentences[i];
                          if (!line) return null;
                          const otherTheme = languageTheme(other.languageCode);

                          return (
                            <div key={other.languageCode} className="flex items-start gap-2">
                              <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs ${otherTheme.soft} ${otherTheme.text}`}
                              >
                                {otherTheme.mark}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p lang={other.languageCode} className="text-sm leading-snug text-eel">
                                  {line.text}
                                </p>
                                {line.romanization && (
                                  <p className="font-mono text-xs text-macaw-dark">
                                    {line.romanization}
                                  </p>
                                )}
                              </div>
                              <AudioButton
                                text={line.text}
                                languageCode={other.languageCode}
                                size="sm"
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-ghost w-full"
                        onClick={() => setCompared((list) => [...list, i])}
                      >
                        Esta frase nos outros idiomas
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {lesson.version.glossary && lesson.version.glossary.length > 0 && (
          <div className="card">
            <p className="section-title mb-2">Palavras do texto</p>
            <ul className="space-y-1">
              {lesson.version.glossary.map((item) => (
                <li key={item.term} className="text-sm">
                  <span lang={lesson.languageCode} className={`font-semibold ${theme.text}`}>
                    {item.term}
                  </span>{' '}
                  <span className="text-wolf">— {item.meaning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="card">
          <p className="section-title mb-1">Os quatro lado a lado</p>
          <p className="text-sm leading-relaxed text-wolf">{lesson.contrast}</p>
        </div>
      </div>

      <LessonFooter detail="Toque em qualquer frase para ver o que ela diz — e como ela fica nos outros idiomas.">
        <SkipButton onSkip={onSkip} />
        <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={onContinue}>
          Responder
        </button>
      </LessonFooter>
    </>
  );
}

/**
 * As perguntas de compreensao.
 *
 * Elas sao de DETALHE, e no idioma do texto, por uma razao que so existe neste
 * bloco: na segunda, terceira e quarta leitura ele ja sabe a historia. Pergunta
 * de ideia geral ele acertaria de memoria, sem ler uma linha -- e a nota diria
 * que ele le alemao quando ele so lembra do ingles.
 *
 * Por isso o texto continua ao alcance aqui: procurar o detalhe na versao deste
 * idioma e justamente o que o bloco mede.
 */
function Comprehension({
  lesson,
  onFinish,
  onSkip,
}: {
  lesson: ReadingLesson;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [showText, setShowText] = useState(false);

  const record = useMutation({
    mutationFn: async (result: { correct: number; total: number }) => {
      const { data } = await api.post('/reading/record', {
        passageId: lesson.passageId,
        languageCode: lesson.languageCode,
        correct: result.correct,
        total: result.total,
      });
      return data;
    },
  });

  const questions = lesson.version.questions;
  const question = questions[index];

  if (!question) {
    const score = Math.round((correct / questions.length) * 100);
    /*
     * Quantos idiomas ainda vão receber esta história.
     *
     * Sai de `others`, e não de um "4" escrito à mão: `others` é exatamente o
     * conjunto dos outros idiomas matriculados, então a conta continua certa se
     * um quinto idioma entrar — ou se um sair.
     */
    const missing = lesson.others.length - lesson.alsoRead.length;

    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <p className="font-serif text-xl font-semibold text-eel">
            {correct} de {questions.length} acertos
          </p>
          <p className="max-w-sm text-sm text-wolf">
            {missing > 0
              ? `Esta história ainda volta em mais ${missing} ${
                  missing === 1 ? 'idioma' : 'idiomas'
                } — e aí você já sabe o que ela diz.`
              : 'Você leu esta história nos quatro idiomas.'}
          </p>
        </div>
        <LessonFooter tone={score >= 70 ? 'correct' : 'neutral'} title={`${score}% de acerto`}>
          <button
            className="btn-primary px-8"
            onClick={() => {
              // O registro e o que faz a historia voltar no proximo idioma; se
              // ele falhar, o bloco ainda conclui e credita o XP.
              record.mutate({ correct, total: questions.length });
              onFinish(score);
            }}
          >
            Continuar
          </button>
        </LessonFooter>
      </>
    );
  }

  const isCorrect = answer === question.answer;

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
          <ProgressBar value={index} max={questions.length} size="sm" tone="bg-macaw" />
          <span className="shrink-0 font-mono text-xs text-hare">
            {index + 1}/{questions.length}
          </span>
        </div>

        <div className="flex items-start gap-3">
          <p lang={lesson.languageCode} className="min-w-0 flex-1 text-xl font-medium leading-snug">
            {question.prompt}
          </p>
          <AudioButton text={question.prompt} languageCode={lesson.languageCode} />
        </div>

        {/*
          Reler fica ACIMA das alternativas: entre elas e o rodape fixo, o botao
          cairia embaixo da barra justo para quem precisa voltar ao texto.
        */}
        <button className="btn-ghost w-full" onClick={() => setShowText((v) => !v)}>
          {showText ? 'Esconder o texto' : 'Ver o texto de novo'}
        </button>

        {showText && (
          <div className="card space-y-2">
            {lesson.version.sentences.map((sentence, i) => (
              <p key={i} lang={lesson.languageCode} className="text-sm leading-relaxed text-eel">
                {sentence.text}
              </p>
            ))}
          </div>
        )}

        <div className="grid gap-2.5">
          {question.options.map((option) => (
            <AnswerOption
              key={option}
              lang={lesson.languageCode}
              disabled={checked}
              state={
                !checked
                  ? 'idle'
                  : option === question.answer
                    ? 'correct'
                    : answer === option
                      ? 'wrong'
                      : 'idle'
              }
              onClick={() => {
                if (checked) return;
                setAnswer(option);
                setChecked(true);
              }}
            >
              {option}
            </AnswerOption>
          ))}
        </div>
      </div>

      <LessonFooter
        tone={checked ? (isCorrect ? 'correct' : 'wrong') : 'neutral'}
        title={checked ? (isCorrect ? 'Isso mesmo' : `Resposta certa: ${question.answer}`) : undefined}
        detail={checked ? question.explanation : 'A resposta está no texto — pode voltar nele.'}
      >
        <SkipButton onSkip={onSkip} />
        <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={next} disabled={!checked}>
          Continuar
        </button>
      </LessonFooter>
    </>
  );
}

const LANGUAGE_NAME: Record<string, string> = {
  en: 'inglês',
  es: 'espanhol',
  de: 'alemão',
  ru: 'russo',
};

function languageName(code: string): string {
  return LANGUAGE_NAME[code] ?? code;
}
