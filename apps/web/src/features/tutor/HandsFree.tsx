import { useCallback, useEffect, useRef, useState } from 'react';
import { Hero } from '../../components/Hero';
import { browserCanRecognize, recognizeInBrowser, useSpeaker } from '../../lib/speech';
import { languageTheme } from '../../lib/ui';

/**
 * Quantos silêncios seguidos encerram a conversa sozinha.
 *
 * O modo abre o microfone de novo assim que termina de falar, então sem este
 * limite ele ficaria escutando para sempre depois que a pessoa guardou o
 * telefone — gastando bateria e, pior, mandando ruído de rua para o tutor.
 */
const MAX_SILENCES = 2;

export type HandsFreeState = 'off' | 'listening' | 'thinking' | 'speaking';

export interface HandsFreeReply {
  reply: string;
  /** A frase corrigida, quando houve erro. Vai para a fala antes da resposta. */
  corrected?: string | null;
}

/**
 * Tutor de mãos livres: conversa por voz, sem tocar na tela.
 *
 * O tutor por escrito exige as duas mãos e os olhos, então ele só acontece
 * sentado — e o tempo em que dava para praticar falando (caminhada, trânsito,
 * cozinha) simplesmente não existia no produto. Este modo é sobre esse tempo.
 *
 * O laço é: ouvir → mandar → falar a resposta → ouvir de novo. Três decisões
 * sustentam ele:
 *
 * 1. NUNCA ESCUTA ENQUANTO FALA. O reconhecimento ouviria a própria voz do
 *    tutor e a mandaria de volta como se fosse do aluno — a conversa entraria
 *    em laço sozinha. Por isso os estados são exclusivos, e não paralelos.
 * 2. A CORREÇÃO É FALADA, NÃO EXPLICADA. No texto, o tutor mostra a categoria
 *    do erro e o porquê; falar isso tudo transformaria cada frase em aula e
 *    mataria a conversa. Aqui sai só a frase certa, no idioma — que é o que
 *    dá para absorver ouvindo. A explicação continua no histórico, para depois.
 * 3. O SILÊNCIO ENCERRA. Dois silêncios seguidos e ele se desliga: o telefone
 *    foi guardado, e um microfone aberto no bolso não serve a ninguém.
 */
export function HandsFree({
  languageCode,
  languageName,
  onSpeak,
  onStop,
  busy,
}: {
  languageCode: string;
  languageName: string;
  /** Manda o que foi ouvido e devolve o que o tutor responde. */
  onSpeak: (transcript: string) => Promise<HandsFreeReply>;
  onStop: () => void;
  busy: boolean;
}) {
  const speaker = useSpeaker();
  const [state, setState] = useState<HandsFreeState>('off');
  const [heard, setHeard] = useState('');
  const [said, setSaid] = useState('');
  const [failure, setFailure] = useState<string | null>(null);

  /*
   * O laço vive em refs, não em estado.
   *
   * Ele é assíncrono e longo (ouvir, mandar, falar), e a cada `setState` o
   * componente re-renderiza -- se a condição de parada fosse lida do estado,
   * a volta em andamento continuaria com o valor capturado no fechamento e
   * seguiria conversando depois de o aluno ter mandado parar.
   */
  const running = useRef(false);
  const silences = useRef(0);
  const stopRecognition = useRef<(() => void) | null>(null);

  const halt = useCallback(() => {
    running.current = false;
    stopRecognition.current?.();
    stopRecognition.current = null;
    speaker.stop();
    setState('off');
    onStop();
  }, [onStop, speaker]);

  // Sair da tela no meio da conversa não pode deixar o microfone aberto.
  useEffect(() => () => {
    running.current = false;
    stopRecognition.current?.();
    stopRecognition.current = null;
  }, []);

  const loop = useCallback(async () => {
    while (running.current) {
      setState('listening');
      setHeard('');

      let transcript = '';
      try {
        const session = recognizeInBrowser(languageCode);
        stopRecognition.current = session.stop;
        transcript = (await session.promise).trim();
      } catch (error) {
        setFailure((error as Error).message);
        break;
      } finally {
        stopRecognition.current = null;
      }

      if (!running.current) break;

      if (!transcript) {
        silences.current += 1;
        if (silences.current >= MAX_SILENCES) {
          setFailure('Ficou em silêncio — encerrei para não deixar o microfone aberto.');
          break;
        }
        continue;
      }

      silences.current = 0;
      setHeard(transcript);
      setState('thinking');

      let answer: HandsFreeReply;
      try {
        answer = await onSpeak(transcript);
      } catch (error) {
        setFailure((error as Error).message);
        break;
      }

      if (!running.current) break;

      setState('speaking');
      setSaid(answer.reply);

      /*
       * A frase corrigida vem ANTES da resposta, e sozinha.
       *
       * Antes porque é sobre o que ele acabou de dizer -- depois da resposta do
       * tutor, ela chegaria fora de contexto. E sozinha, sem "você errou": o
       * tutor repetir a frase certa é como um nativo corrige de verdade numa
       * conversa, e é o que não interrompe a conversa.
       */
      if (answer.corrected) {
        await speaker.speak(answer.corrected, languageCode);
        if (!running.current) break;
      }

      await speaker.speak(answer.reply, languageCode);
    }

    running.current = false;
    stopRecognition.current = null;
    setState('off');
    onStop();
  }, [languageCode, onSpeak, onStop, speaker]);

  function start() {
    setFailure(null);
    setHeard('');
    setSaid('');
    silences.current = 0;
    running.current = true;
    void loop();
  }

  if (!browserCanRecognize()) {
    return (
      <div className="card border-bee bg-bee-soft">
        <p className="text-sm text-bee-dark">
          Este navegador não reconhece fala, então o modo mãos livres não funciona aqui. No celular,
          ele roda no Chrome (Android) e no Safari (iPhone).
        </p>
      </div>
    );
  }

  const theme = languageTheme(languageCode);
  const label: Record<HandsFreeState, string> = {
    off: 'Parado',
    listening: 'Ouvindo você',
    thinking: 'Pensando',
    speaking: 'Falando',
  };

  return (
    <section className="card space-y-4 text-center">
      <div>
        <p className="section-title">Mãos livres</p>
        <p className="text-xs text-wolf">
          Conversa em {languageName} sem tocar na tela. Fale, espere a resposta e responda de volta.
        </p>
      </div>

      <Hero
        mood={state === 'speaking' ? 'cheer' : state === 'off' ? 'idle' : 'focus'}
        size="md"
        accent={state === 'off' ? 'text-hare' : 'text-macaw'}
        className="mx-auto"
      />

      <div className="flex items-center justify-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            state === 'listening'
              ? 'animate-halo bg-cardinal'
              : state === 'off'
                ? 'bg-swan'
                : `${theme.bg}`
          }`}
          aria-hidden
        />
        <span className="font-mono text-xs uppercase tracking-wide text-hare">
          {busy && state !== 'off' ? 'Pensando' : label[state]}
        </span>
      </div>

      {/*
        O texto aparece grande e curto: este modo é para quem NÃO está olhando.
        Quando ele olha, é de relance, e o que importa é "ele me entendeu?".
      */}
      {heard && (
        <p lang={languageCode} className="font-serif text-lg leading-snug text-eel">
          “{heard}”
        </p>
      )}
      {said && state !== 'listening' && (
        <p className="text-sm leading-snug text-wolf">{said}</p>
      )}

      {failure && (
        <p className="rounded-md border border-cardinal bg-cardinal-soft px-3 py-2 text-sm text-cardinal-dark">
          {failure}
        </p>
      )}

      {state === 'off' ? (
        <button className="btn-primary w-full py-4 text-base" onClick={start}>
          Começar a conversar
        </button>
      ) : (
        <button className="btn-danger w-full py-4 text-base" onClick={halt}>
          Parar
        </button>
      )}

      {!speaker.naturalVoice && state === 'off' && (
        <p className="text-xs text-hare">
          Usando a voz do navegador. Com um provider de voz no backend a conversa fica bem mais
          natural de ouvir.
        </p>
      )}
    </section>
  );
}
