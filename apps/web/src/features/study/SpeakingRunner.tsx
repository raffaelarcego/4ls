import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter } from '../../components/LessonFooter';
import {
  browserCanRecognize,
  recognizeInBrowser,
  transcribe,
  useRecorder,
  useSpeechStatus,
} from '../../lib/speech';
import { api, errorMessage } from '../../services/api';
import { SessionActivity } from '../../types';

interface Mission {
  mission: string;
  promptInTarget: string;
  hints: string[];
}

interface Evaluation {
  scores: { grammar: number; vocabulary: number; fluency: number; taskCompletion: number };
  corrected: string;
  feedback: string;
  average: number;
}

const SCORE_LABEL: Record<keyof Evaluation['scores'], string> = {
  grammar: 'Gramática',
  vocabulary: 'Vocabulário',
  fluency: 'Fluência',
  taskCompletion: 'Cumpriu a missão',
};

/**
 * Speaking Lab.
 *
 * O caminho principal manda o audio para o backend transcrever (Whisper). Sem
 * provider de transcricao, cai no reconhecimento do proprio navegador; sem
 * nenhum dos dois, o aluno digita o que falou. Em qualquer um dos tres casos a
 * avaliacao e a mesma e os erros entram no Error Intelligence -- o que muda e
 * so como o texto chega ate la.
 */
export function SpeakingRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const status = useSpeechStatus();
  const recorder = useRecorder(90);

  const [mission, setMission] = useState<Mission | null>(null);
  const [transcript, setTranscript] = useState('');
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const browserStop = useRef<(() => void) | null>(null);

  const serverStt = status.data?.stt ?? false;
  const canRecord = serverStt ? recorder.supported : browserCanRecognize();

  const generateMission = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/tutor/speaking/mission', {
        languageCode: activity.languageCode,
      });
      return data as Mission;
    },
    onSuccess: (data) => setMission(data),
  });

  const evaluate = useMutation({
    mutationFn: async (text: string) => {
      const { data } = await api.post('/tutor/speaking', {
        languageCode: activity.languageCode,
        mission: mission?.mission ?? 'Falar livremente sobre um tema do cotidiano.',
        transcript: text,
      });
      return data as Evaluation;
    },
    onSuccess: (data) => setEvaluation(data),
  });

  async function startRecording() {
    setFailure(null);
    setTranscript('');

    if (serverStt) {
      await recorder.start();
      return;
    }

    // Sem provider no backend: o proprio navegador ouve e transcreve.
    const session = recognizeInBrowser(activity.languageCode);
    browserStop.current = session.stop;
    setBusy('gravando');
    session.promise
      .then((text) => setTranscript(text))
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

    setBusy('transcrevendo');
    try {
      const text = await transcribe(recording, activity.languageCode, mission?.promptInTarget);
      if (!text) {
        setFailure('Não consegui entender nada no áudio. Fale um pouco mais alto e tente de novo.');
        return;
      }
      setTranscript(text);
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  // ----- missao -----
  if (!mission) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <span className={`text-6xl ${generateMission.isPending ? 'animate-float' : ''}`}>
            {generateMission.isError ? '🔌' : '🗣️'}
          </span>
          <p className="text-lg font-black">
            {generateMission.isPending ? 'Pensando numa missão...' : 'Speaking Lab'}
          </p>
          <p className="max-w-sm text-sm font-semibold text-wolf">
            {generateMission.isError
              ? errorMessage(generateMission.error)
              : 'Você recebe uma missão, fala por 20 a 40 segundos e é corrigido.'}
          </p>
        </div>

        <LessonFooter tone={generateMission.isError ? 'wrong' : 'neutral'}>
          <button className="btn-plain" onClick={onSkip}>
            Pular bloco
          </button>
          <button
            className="btn-primary flex-1 px-10 sm:flex-none"
            onClick={() => generateMission.mutate()}
            disabled={generateMission.isPending}
          >
            {generateMission.isPending
              ? 'Gerando...'
              : generateMission.isError
                ? 'Tentar de novo'
                : 'Receber missão'}
          </button>
        </LessonFooter>
      </>
    );
  }

  // ----- resultado -----
  if (evaluation) {
    const score = evaluation.average;
    return (
      <>
        <div className="space-y-4">
          <div className="card flex flex-col items-center gap-2 text-center">
            <span className="animate-pop text-6xl">{score >= 70 ? '🎉' : '💪'}</span>
            <p className="text-3xl font-black tabular-nums">{score}%</p>
            <p className="text-sm font-semibold text-wolf">{evaluation.feedback}</p>
          </div>

          <div className="card space-y-2">
            <p className="section-title">Notas</p>
            {(Object.keys(SCORE_LABEL) as Array<keyof Evaluation['scores']>).map((key) => (
              <div key={key} className="flex items-center justify-between text-sm font-bold">
                <span className="text-wolf">{SCORE_LABEL[key]}</span>
                <span className="tabular-nums">{Math.round(evaluation.scores[key])}%</span>
              </div>
            ))}
          </div>

          <div className="card space-y-2">
            <p className="section-title">Como um nativo diria</p>
            <div className="flex items-start gap-2">
              <p className="flex-1 font-bold">{evaluation.corrected}</p>
              <AudioButton text={evaluation.corrected} languageCode={activity.languageCode} />
            </div>
            <div className="rounded-xl bg-snow p-3">
              <p className="section-title mb-1">Você disse</p>
              <p className="text-sm font-semibold text-wolf">{transcript}</p>
            </div>
          </div>
        </div>

        <LessonFooter tone={score >= 70 ? 'correct' : 'neutral'} title="Avaliado">
          <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={() => onFinish(score)}>
            Continuar
          </button>
        </LessonFooter>
      </>
    );
  }

  // ----- gravacao -----
  const recording = serverStt ? recorder.isRecording : busy === 'gravando';

  return (
    <>
      <div className="space-y-4">
        <div className="card space-y-3">
          <p className="section-title">Sua missão</p>
          <p className="text-lg font-black leading-snug">{mission.mission}</p>
          <div className="flex items-start gap-2 rounded-xl bg-snow p-3">
            <p className="flex-1 text-sm font-bold text-wolf">{mission.promptInTarget}</p>
            <AudioButton
              text={mission.promptInTarget}
              languageCode={activity.languageCode}
              size="sm"
            />
          </div>
          {mission.hints?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {mission.hints.map((hint) => (
                <span key={hint} className="chip bg-humpback-soft text-humpback-dark">
                  {hint}
                </span>
              ))}
            </div>
          )}
        </div>

        {canRecord ? (
          <div className="card flex flex-col items-center gap-3 text-center">
            <button
              onClick={() => (recording ? void stopRecording() : void startRecording())}
              disabled={busy === 'transcrevendo'}
              className={`flex h-28 w-28 items-center justify-center rounded-full border-2 border-b-[6px] text-5xl transition active:translate-y-[3px] active:border-b-2 ${
                recording
                  ? 'animate-pulse border-cardinal-dark bg-cardinal text-white'
                  : 'border-cardinal bg-cardinal-soft'
              }`}
              aria-label={recording ? 'Parar de gravar' : 'Começar a gravar'}
            >
              {recording ? '⏹️' : '🎙️'}
            </button>

            <p className="text-xs font-extrabold uppercase tracking-wider text-hare">
              {busy === 'transcrevendo'
                ? 'transcrevendo...'
                : recording
                  ? serverStt
                    ? `gravando · ${recorder.seconds}s`
                    : 'ouvindo... toque para parar'
                  : 'toque e fale'}
            </p>

            {!serverStt && (
              <p className="text-xs font-semibold text-hare">
                Usando o reconhecimento de fala do navegador (só Chrome/Edge). Configure
                SPEECH_API_KEY no backend para transcrição própria.
              </p>
            )}
          </div>
        ) : (
          <div className="card space-y-2">
            <p className="section-title">Sem microfone disponível</p>
            <p className="text-sm font-semibold text-wolf">
              Este navegador não grava áudio nem reconhece fala. Fale em voz alta e escreva abaixo o
              que você disse — a correção é a mesma.
            </p>
          </div>
        )}

        {(recorder.error || failure) && (
          <p className="rounded-xl bg-cardinal-soft px-3 py-2 text-sm font-bold text-cardinal-dark">
            {recorder.error ?? failure}
          </p>
        )}

        {(transcript || !canRecord) && (
          <div className="space-y-1.5">
            <p className="section-title">
              {canRecord ? 'O que eu ouvi (edite se saiu errado)' : 'O que você falou'}
            </p>
            <textarea
              className="input min-h-24 resize-y"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={`Escreva em ${activity.languageName}...`}
            />
          </div>
        )}

        {evaluate.isError && (
          <p className="rounded-xl bg-cardinal-soft px-3 py-2 text-sm font-bold text-cardinal-dark">
            {errorMessage(evaluate.error)}
          </p>
        )}
      </div>

      <LessonFooter
        detail={
          transcript.trim()
            ? undefined
            : canRecord
              ? 'Grave sua fala para receber a correção.'
              : 'Escreva o que você falou para receber a correção.'
        }
      >
        <button className="btn-plain" onClick={onSkip}>
          Pular bloco
        </button>
        <button
          className="btn-primary flex-1 px-10 sm:flex-none"
          onClick={() => evaluate.mutate(transcript.trim())}
          disabled={!transcript.trim() || evaluate.isPending || recording}
        >
          {evaluate.isPending ? 'Avaliando...' : 'Avaliar minha fala'}
        </button>
      </LessonFooter>
    </>
  );
}
