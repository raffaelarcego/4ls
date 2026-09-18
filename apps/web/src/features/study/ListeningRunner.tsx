import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { AnswerOption } from '../../components/AnswerOption';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter, SkipButton } from '../../components/LessonFooter';
import { ProgressBar } from '../../components/ProgressBar';
import { useSpeaker } from '../../lib/speech';
import { api, errorMessage } from '../../services/api';
import { SessionActivity } from '../../types';

interface DialogueLine {
  speaker: string;
  text: string;
  translation: string;
}

interface Question {
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface Listening {
  title: string;
  context: string;
  lines: DialogueLine[];
  questions: Question[];
  vocabulary?: Array<{ term: string; meaning: string }>;
}

/**
 * Bloco de escuta com conteudo proprio.
 *
 * Antes este bloco so mandava o aluno "ouvir algo por conta propria" e se
 * autoavaliar. Agora a IA gera um dialogo no nivel dele, o Speech Gateway fala
 * o dialogo e as perguntas dao uma nota objetiva -- que e o que alimenta a
 * subcompetencia de listening de verdade.
 *
 * A transcricao comeca escondida de proposito: ler junto vira leitura, nao
 * escuta.
 */
export function ListeningRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const speaker = useSpeaker();
  const [listening, setListening] = useState<Listening | null>(null);
  const [phase, setPhase] = useState<'listen' | 'quiz'>('listen');
  const [showTranscript, setShowTranscript] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(0);

  const generate = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/tutor/listening', {
        languageCode: activity.languageCode,
        seconds: Math.min(120, Math.max(20, activity.plannedMinutes * 10)),
      });
      return data as Listening;
    },
    onSuccess: (data) => setListening(data),
  });

  async function playAll(lines: DialogueLine[]) {
    setPlayCount((c) => c + 1);
    await speaker.speakSequence(
      lines.map((line) => ({ text: line.text, languageCode: activity.languageCode })),
    );
  }

  if (!listening) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <p className="font-serif text-lg font-semibold text-eel">
            {generate.isPending ? 'Escrevendo o diálogo...' : 'Escuta sob medida'}
          </p>
          <p className="max-w-sm text-sm text-wolf">
            {generate.isError
              ? errorMessage(generate.error)
              : 'Um diálogo curto no seu nível, falado em voz alta, com perguntas de compreensão no fim.'}
          </p>
        </div>

        <LessonFooter tone={generate.isError ? 'wrong' : 'neutral'}>
          <SkipButton onSkip={onSkip} />
          <button
            className="btn-primary flex-1 px-10 sm:flex-none"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? 'Gerando...' : generate.isError ? 'Tentar de novo' : 'Gerar diálogo'}
          </button>
        </LessonFooter>
      </>
    );
  }

  if (phase === 'listen') {
    return (
      <>
        <div className="space-y-4">
          <div className="card space-y-4 text-center">
            <div>
              <p className="section-title">{listening.title}</p>
              <p className="mt-1 text-sm font-semibold text-wolf">{listening.context}</p>
            </div>

            <button
              onClick={() => (speaker.isSpeaking ? speaker.stop() : void playAll(listening.lines))}
              className={`btn mx-auto w-full max-w-xs ${
                speaker.isSpeaking
                  ? 'border-macaw-dark bg-macaw text-snow'
                  : 'border-macaw bg-macaw-soft text-macaw-dark'
              }`}
            >
              {speaker.isSpeaking ? 'Parar' : playCount === 0 ? 'Ouvir o diálogo' : 'Ouvir de novo'}
            </button>

            <p className="font-mono text-xs text-hare">
              {playCount === 0
                ? 'ainda não ouviu'
                : `${playCount} ${playCount === 1 ? 'escuta' : 'escutas'}`}
            </p>

            {!speaker.naturalVoice && (
              <p className="text-xs text-hare">
                Usando a voz do navegador — configure um provider de voz no backend para ouvir uma
                voz natural.
              </p>
            )}
          </div>

          {showTranscript ? (
            <div className="card space-y-3">
              <p className="section-title">Transcrição</p>
              {listening.lines.map((line, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-xs ${
                      i % 2 === 0
                        ? 'bg-macaw-soft text-macaw-dark'
                        : 'bg-humpback-soft text-humpback-dark'
                    }`}
                  >
                    {line.speaker}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p lang={activity.languageCode} className="font-medium">
                      {line.text}
                    </p>
                    <p className="text-xs text-wolf">{line.translation}</p>
                  </div>
                  <AudioButton
                    text={line.text}
                    languageCode={activity.languageCode}
                    size="sm"
                  />
                </div>
              ))}
            </div>
          ) : (
            <button className="btn-ghost w-full" onClick={() => setShowTranscript(true)}>
              Não entendi — mostrar transcrição
            </button>
          )}

          {listening.vocabulary && listening.vocabulary.length > 0 && showTranscript && (
            <div className="card">
              <p className="section-title mb-2">Palavras do diálogo</p>
              <ul className="space-y-1">
                {listening.vocabulary.map((item) => (
                  <li key={item.term} className="text-sm">
                    <span lang={activity.languageCode} className="font-semibold">
                      {item.term}
                    </span>{' '}
                    <span className="text-wolf">— {item.meaning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <LessonFooter
          detail={
            playCount === 0 ? 'Ouça pelo menos uma vez antes de responder.' : undefined
          }
        >
          <SkipButton onSkip={onSkip} />
          <button
            className="btn-primary flex-1 px-10 sm:flex-none"
            onClick={() => {
              speaker.stop();
              setPhase('quiz');
            }}
            disabled={playCount === 0}
          >
            {listening.questions.length > 0 ? 'Responder' : 'Concluir'}
          </button>
        </LessonFooter>
      </>
    );
  }

  // Sem perguntas validas, a nota vem de quantas vezes precisou ouvir.
  if (listening.questions.length === 0) {
    const score = playCount <= 1 ? 90 : playCount === 2 ? 70 : 50;
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <p className="font-serif text-xl font-semibold text-eel">Escuta concluída</p>
          <p className="text-sm text-wolf">
            Você ouviu {playCount} {playCount === 1 ? 'vez' : 'vezes'}.
          </p>
        </div>
        <LessonFooter tone="correct" title="Bloco feito">
          <button className="btn-primary px-8" onClick={() => onFinish(score)}>
            Continuar
          </button>
        </LessonFooter>
      </>
    );
  }

  const question = listening.questions[index];

  if (!question) {
    const score = Math.round((correct / listening.questions.length) * 100);
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <p className="font-serif text-xl font-semibold text-eel">
            {correct} de {listening.questions.length} acertos
          </p>
          <p className="text-sm text-wolf">
            {score >= 70
              ? 'Seu ouvido pegou o essencial.'
              : 'Vale reouvir este diálogo amanhã — ele fica no cache.'}
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
          <ProgressBar value={index} max={listening.questions.length} size="sm" tone="bg-macaw" />
          <span className="shrink-0 font-mono text-xs text-hare">
            {index + 1}/{listening.questions.length}
          </span>
        </div>

        <div className="flex items-start gap-3">
          <p lang={activity.languageCode} className="min-w-0 flex-1 text-xl font-medium leading-snug">
            {question.prompt}
          </p>
          <AudioButton text={question.prompt} languageCode={activity.languageCode} />
        </div>

        {/*
          Reouvir fica ACIMA das alternativas: entre elas e o rodape fixo, o
          botao caia embaixo da barra e ficava intocavel justo em quem nao
          entendeu o dialogo.
        */}
        <button
          className="btn-ghost w-full"
          onClick={() => void playAll(listening.lines)}
          disabled={speaker.isSpeaking}
        >
          Ouvir o diálogo de novo
        </button>

        <div className="grid gap-2.5">
          {question.options.map((option) => (
            <AnswerOption
              key={option}
              lang={activity.languageCode}
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
              // Tocar ja corrige: o "Verificar" no rodape era um terceiro toque
              // que nao decidia nada.
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

      {/*
        O rodape mantem os mesmos dois botoes nos dois estados, para o primario
        nao trocar de lugar debaixo do polegar quando o resultado aparece.
      */}
      <LessonFooter
        tone={checked ? (isCorrect ? 'correct' : 'wrong') : 'neutral'}
        title={checked ? (isCorrect ? 'Isso mesmo' : `Resposta certa: ${question.answer}`) : undefined}
        detail={checked ? question.explanation : 'Toque na alternativa para responder.'}
      >
        <SkipButton onSkip={onSkip} />
        <button
          className="btn-primary flex-1 px-10 sm:flex-none"
          onClick={next}
          disabled={!checked}
        >
          Continuar
        </button>
      </LessonFooter>
    </>
  );
}
