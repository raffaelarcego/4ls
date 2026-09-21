import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { LessonFooter, SkipButton } from '../../components/LessonFooter';
import { ProgressBar } from '../../components/ProgressBar';
import {
  browserCanRecognize,
  recognizeInBrowser,
  transcribe,
  useRecorder,
  useSpeaker,
  useSpeechStatus,
} from '../../lib/speech';
import { api, errorMessage } from '../../services/api';
import { SessionActivity, ShadowingLesson, ShadowingScore } from '../../types';

const SOURCE_LABEL: Record<string, string> = {
  cando: 'da função do dia',
  reading: 'de um texto que você leu',
  structure: 'da aula de estrutura',
};

/**
 * Shadowing: ouvir e repetir, na hora.
 *
 * O Speaking Lab mede produção — ele dá uma missão e você fala o que quiser.
 * Este bloco mede outra coisa: pegar uma frase pronta, dita por uma voz nativa,
 * e devolvê-la inteira. É o exercício mais antigo que existe para soltar a
 * língua, e o único que ataca a distância entre "eu sei a frase" e "eu consigo
 * dizer a frase".
 *
 * A decisão que faz o bloco ser shadowing e não leitura em voz alta: **a frase
 * fica escondida até você tentar**. Com o texto na tela o exercício vira
 * decifrar e ler, e o ritmo — que é o que se treina aqui — deixa de ser
 * imitado. Só a tradução em português aparece antes, para você repetir sabendo
 * o que está dizendo.
 */
export function ShadowingRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const speaker = useSpeaker();
  const status = useSpeechStatus();
  const recorder = useRecorder(20);

  const [index, setIndex] = useState(0);
  const [listens, setListens] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<ShadowingScore | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const browserStop = useRef<(() => void) | null>(null);

  const serverStt = status.data?.stt ?? false;
  const canRecord = serverStt ? recorder.supported : browserCanRecognize();

  const lesson = useQuery<ShadowingLesson>({
    queryKey: ['shadowing', 'lesson', activity.languageCode],
    queryFn: async () =>
      (await api.get('/shadowing/lesson', { params: { language: activity.languageCode } })).data,
    retry: false,
    staleTime: Infinity,
  });

  const score = useMutation({
    mutationFn: async (input: { target: string; transcript: string }) => {
      const { data } = await api.post('/shadowing/attempt', input);
      return data as ShadowingScore;
    },
    onSuccess: (data) => {
      setResult(data);
      setRevealed(true);
      setScores((s) => [...s, data.score]);
    },
  });

  const sentence = lesson.data?.sentences[index];

  if (lesson.isPending) {
    return (
      <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
        <p className="font-serif text-lg font-semibold text-eel">Separando as frases...</p>
        <p className="max-w-sm text-sm text-wolf">
          Frases que você já estudou — é por já saber o que elas dizem que dá para imitar o ritmo.
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

  /*
   * Sem microfone não há shadowing com nota — mas há shadowing.
   *
   * Repetir em voz alta continua valendo mesmo sem ninguém ouvindo, e é o que
   * a maioria dos métodos faz há décadas. O que muda é que a nota passa a ser
   * dele. A alternativa seria esconder o bloco de quem está num navegador sem
   * reconhecimento — e aí ele perde o exercício inteiro por causa da nota.
   */
  if (!canRecord) {
    return <Unscored lesson={lesson.data} onFinish={onFinish} onSkip={onSkip} />;
  }

  if (!sentence) {
    const average = scores.length
      ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      : 0;

    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <p className="font-mono text-4xl font-bold tabular-nums text-macaw">{average}%</p>
          <p className="font-serif text-lg font-semibold text-eel">das palavras saíram</p>
          <p className="max-w-sm text-sm text-wolf">
            {average >= 70
              ? 'A frase está saindo inteira. É isso que a fala livre precisa por baixo.'
              : 'Repetir a mesma frase várias vezes seguidas é o atalho aqui — não é trapaça, é o método.'}
          </p>
        </div>
        <LessonFooter tone={average >= 70 ? 'correct' : 'neutral'} title={`${scores.length} frases`}>
          <button className="btn-primary px-8" onClick={() => onFinish(average)}>
            Continuar
          </button>
        </LessonFooter>
      </>
    );
  }

  async function listen() {
    setListens((n) => n + 1);
    await speaker.speak(sentence!.text, activity.languageCode);
  }

  async function startRecording() {
    setFailure(null);

    if (serverStt) {
      await recorder.start();
      return;
    }

    const session = recognizeInBrowser(activity.languageCode);
    browserStop.current = session.stop;
    setBusy('ouvindo');
    session.promise
      .then((text) => score.mutate({ target: sentence!.text, transcript: text }))
      .catch((err: Error) => setFailure(err.message))
      .finally(() => {
        setBusy(null);
        browserStop.current = null;
      });
  }

  async function stopRecording() {
    if (!serverStt) {
      browserStop.current?.();
      return;
    }

    const recording = await recorder.stop();
    if (!recording) {
      setFailure('Não saiu áudio da gravação. Tente de novo.');
      return;
    }

    setBusy('conferindo');
    try {
      // A própria frase vai como dica: o transcritor acerta muito mais quando
      // sabe o que esperar, e aqui nós sabemos exatamente o que ele deveria ter
      // dito -- o gabarito é a frase.
      const text = await transcribe(recording, activity.languageCode, sentence!.text);
      score.mutate({ target: sentence!.text, transcript: text });
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function next() {
    setResult(null);
    setRevealed(false);
    setListens(0);
    setFailure(null);
    setIndex((i) => i + 1);
  }

  const recording = serverStt ? recorder.isRecording : busy === 'ouvindo';
  const total = lesson.data.sentences.length;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={total} size="sm" tone="bg-macaw" />
          <span className="shrink-0 font-mono text-xs text-hare">
            {index + 1}/{total}
          </span>
        </div>

        <div className="card space-y-3 text-center">
          <p className="font-mono text-xs text-hare">{SOURCE_LABEL[sentence.source] ?? ''}</p>

          {/* A tradução vem antes: repetir sem saber o que se diz é papagaio. */}
          <p className="font-serif text-lg italic leading-snug text-wolf">
            {sentence.translation}
          </p>

          <button
            onClick={() => (speaker.isSpeaking ? speaker.stop() : void listen())}
            className={`btn mx-auto w-full max-w-xs ${
              speaker.isSpeaking
                ? 'border-macaw-dark bg-macaw text-snow'
                : 'border-macaw bg-macaw-soft text-macaw-dark'
            }`}
          >
            {speaker.isSpeaking ? 'Parar' : listens === 0 ? 'Ouvir a frase' : 'Ouvir de novo'}
          </button>

          <p className="font-mono text-xs text-hare">
            {listens === 0 ? 'ainda não ouviu' : `${listens} ${listens === 1 ? 'escuta' : 'escutas'}`}
          </p>
        </div>

        {/*
          A frase escrita só aparece DEPOIS da tentativa. Com ela na tela o
          exercício vira ler em voz alta, e o ritmo deixa de ser imitado.
        */}
        {revealed && result ? (
          <div className="card space-y-2">
            <p className="section-title">Como ficou</p>
            <p lang={activity.languageCode} className="text-xl leading-relaxed">
              {result.words.map((word, i) => (
                <span
                  key={i}
                  className={word.ok ? 'text-grass-dark' : 'text-cardinal-dark line-through'}
                >
                  {word.expected}{' '}
                </span>
              ))}
            </p>
            {sentence.romanization && (
              <p className="font-mono text-xs text-macaw-dark">{sentence.romanization}</p>
            )}
            {result.extra.length > 0 && (
              <p className="text-xs text-wolf">
                Também ouvi: {result.extra.join(', ')}. Se for tudo assim, provavelmente é o
                microfone ou o idioma do reconhecimento — não a sua fala.
              </p>
            )}
          </div>
        ) : (
          <button className="btn-ghost w-full" onClick={() => setRevealed(true)} disabled={revealed}>
            Não peguei — mostrar a frase
          </button>
        )}

        {revealed && !result && (
          <div className="card">
            <p lang={activity.languageCode} className="text-xl leading-relaxed text-eel">
              {sentence.text}
            </p>
            {sentence.romanization && (
              <p className="font-mono text-xs text-macaw-dark">{sentence.romanization}</p>
            )}
          </div>
        )}

        {failure && (
          <p className="rounded-md border border-cardinal bg-cardinal-soft px-3 py-2 text-sm text-cardinal-dark">
            {failure}
          </p>
        )}

        {!speaker.naturalVoice && (
          <p className="text-xs text-hare">
            Usando a voz do navegador — configure um provider de voz no backend para imitar uma voz
            natural.
          </p>
        )}
      </div>

      {result ? (
        <LessonFooter
          tone={result.score >= 70 ? 'correct' : 'wrong'}
          title={`${result.matched} de ${result.total} palavras`}
          detail={
            result.score >= 70
              ? 'Saiu inteira. Ouça mais uma vez e repita junto, por cima da voz.'
              : 'Ouça de novo e repita imediatamente, sem pausa entre ouvir e falar.'
          }
        >
          <button className="btn-plain" onClick={() => setResult(null)}>
            Repetir esta
          </button>
          <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={next}>
            Próxima
          </button>
        </LessonFooter>
      ) : (
        <LessonFooter
          detail={
            listens === 0
              ? 'Ouça primeiro. Depois repita assim que o áudio terminar.'
              : busy === 'conferindo'
                ? 'Conferindo o que você falou...'
                : 'Fale agora, imitando o ritmo — não só as palavras.'
          }
        >
          <SkipButton onSkip={onSkip} />
          <button
            className={`flex-1 px-10 sm:flex-none ${recording ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => (recording ? void stopRecording() : void startRecording())}
            disabled={listens === 0 || score.isPending || busy === 'conferindo'}
          >
            {recording ? 'Terminei' : score.isPending ? 'Conferindo...' : 'Repetir'}
          </button>
        </LessonFooter>
      )}
    </>
  );
}

/**
 * Shadowing sem reconhecimento de fala.
 *
 * Sem nota automática, mas com o exercício inteiro: ouvir, repetir, conferir
 * contra o texto. A autoavaliação no fim é o mesmo recurso dos outros blocos
 * que ainda não têm medida objetiva — e aqui ela é honesta, porque só ele sabe
 * se a frase saiu.
 */
function Unscored({
  lesson,
  onFinish,
  onSkip,
}: {
  lesson: ShadowingLesson;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const speaker = useSpeaker();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [self, setSelf] = useState<number | null>(null);

  const sentence = lesson.sentences[index];
  const last = index >= lesson.sentences.length - 1;

  if (!sentence) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <p className="font-serif text-lg font-semibold text-eel">Rodada feita</p>
        </div>
        <LessonFooter>
          <button className="btn-primary px-8" onClick={() => onFinish(self ?? 65)}>
            Continuar
          </button>
        </LessonFooter>
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={lesson.sentences.length} size="sm" tone="bg-macaw" />
          <span className="shrink-0 font-mono text-xs text-hare">
            {index + 1}/{lesson.sentences.length}
          </span>
        </div>

        <p className="rounded-md border border-bee bg-bee-soft px-3 py-2 text-xs leading-snug text-bee-dark">
          Este navegador não reconhece fala, então a nota é sua. O exercício é o mesmo: ouça,
          repita em voz alta e só depois confira o texto.
        </p>

        <div className="card space-y-3 text-center">
          <p className="font-serif text-lg italic leading-snug text-wolf">{sentence.translation}</p>
          <button
            className="btn mx-auto w-full max-w-xs border-macaw bg-macaw-soft text-macaw-dark"
            onClick={() => void speaker.speak(sentence.text, lesson.languageCode)}
          >
            Ouvir a frase
          </button>
        </div>

        {revealed ? (
          <div className="card">
            <p lang={lesson.languageCode} className="text-xl leading-relaxed text-eel">
              {sentence.text}
            </p>
            {sentence.romanization && (
              <p className="font-mono text-xs text-macaw-dark">{sentence.romanization}</p>
            )}
          </div>
        ) : (
          <button className="btn-ghost w-full" onClick={() => setRevealed(true)}>
            Já repeti — mostrar a frase
          </button>
        )}

        {last && revealed && (
          <div>
            <p className="section-title mb-2">Como saiu?</p>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Travei', value: 35 },
                { label: 'Quase', value: 65 },
                { label: 'Saiu inteira', value: 90 },
              ].map((option) => (
                <button
                  key={option.label}
                  onClick={() => setSelf(option.value)}
                  className={`tap-target flex items-center justify-center rounded-md border px-2 py-4 text-sm transition-colors ${
                    self === option.value
                      ? 'border-macaw bg-macaw-soft text-macaw-dark'
                      : 'border-swan bg-white text-wolf'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <LessonFooter>
        <SkipButton onSkip={onSkip} />
        <button
          className="btn-primary flex-1 px-10 sm:flex-none"
          onClick={() => {
            if (last) {
              if (self !== null) onFinish(self);
              return;
            }
            setRevealed(false);
            setIndex((i) => i + 1);
          }}
          disabled={!revealed || (last && self === null)}
        >
          {last ? 'Concluir' : 'Próxima'}
        </button>
      </LessonFooter>
    </>
  );
}
