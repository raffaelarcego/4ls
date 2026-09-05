import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

/**
 * Camada de voz do front.
 *
 * A regra e a mesma do resto do projeto: a plataforma nasce funcional antes de
 * nascer inteligente. Se o backend tem provider de voz, o aluno ouve a voz
 * natural (que fica em cache no servidor e custa uma vez so); se nao tem, cai
 * na sintese do proprio navegador, que e pior mas e gratis e sempre existe.
 * Nenhuma tela precisa saber qual dos dois esta tocando.
 */

export interface SpeechStatus {
  tts: boolean;
  stt: boolean;
  providers: string[];
}

/** O navegador e os providers pedem BCP-47; o banco guarda o codigo curto. */
const LOCALE: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
  pt: 'pt-BR',
};

export function localeFor(languageCode: string): string {
  return LOCALE[languageCode] ?? languageCode;
}

export function useSpeechStatus() {
  return useQuery<SpeechStatus>({
    queryKey: ['speech', 'status'],
    queryFn: async () => (await api.get('/speech/status')).data,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// Sintese
// ---------------------------------------------------------------------------

/**
 * Cache de audio no nivel do modulo, nao do componente: a mesma frase tocada
 * no flashcard e depois no ditado reaproveita o blob ja baixado, e trocar de
 * tela nao joga fora o que ja foi buscado.
 */
const clipCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();

function cacheKey(text: string, languageCode: string): string {
  return `${languageCode}|${text}`;
}

async function fetchClip(text: string, languageCode: string): Promise<string | null> {
  const key = cacheKey(text, languageCode);

  const cached = clipCache.get(key);
  if (cached) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const { data } = await api.post('/speech/tts', { text, languageCode });
      const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: data.mimeType }));
      clipCache.set(key, url);
      return url;
    } catch {
      // 503 (sem provider) ou falha de rede: quem chamou cai para o navegador.
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, request);
  return request;
}

let browserVoices: SpeechSynthesisVoice[] = [];

function loadBrowserVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  browserVoices = window.speechSynthesis.getVoices();
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadBrowserVoices();
  // No Chrome a lista chega vazia na primeira chamada e so depois do evento.
  window.speechSynthesis.addEventListener('voiceschanged', loadBrowserVoices);
}

export function browserCanSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function speakInBrowser(text: string, languageCode: string, onEnd: () => void): boolean {
  if (!browserCanSpeak()) {
    onEnd();
    return false;
  }

  const locale = localeFor(languageCode);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;

  // Prefere uma voz do locale exato; aceita qualquer uma do mesmo idioma.
  const voice =
    browserVoices.find((v) => v.lang === locale) ??
    browserVoices.find((v) => v.lang.startsWith(languageCode));
  if (voice) utterance.voice = voice;

  utterance.rate = 0.95;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

export type SpeechSource = 'server' | 'browser' | 'none';

/**
 * Toca uma frase. Devolve qual fonte foi usada, para a interface poder avisar
 * quando a voz e a sintetica do navegador.
 */
export function useSpeaker() {
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const status = useSpeechStatus();

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (browserCanSpeak()) window.speechSynthesis.cancel();
    setSpeakingKey(null);
  }, []);

  // Sair da tela no meio de uma fala nao pode deixar o audio tocando.
  useEffect(() => stop, [stop]);

  const speak = useCallback(
    async (text: string, languageCode: string): Promise<SpeechSource> => {
      const trimmed = text.trim();
      if (!trimmed) return 'none';

      stop();
      const key = cacheKey(trimmed, languageCode);
      setSpeakingKey(key);

      const url = status.data?.tts === false ? null : await fetchClip(trimmed, languageCode);

      if (url) {
        const audio = new Audio(url);
        audioRef.current = audio;
        try {
          // Resolve so quando a reproducao termina: e disso que speakSequence
          // depende para tocar a proxima fala do dialogo na hora certa.
          await new Promise<void>((resolve, reject) => {
            audio.onended = () => resolve();
            audio.onerror = () => reject(new Error('falha ao tocar o audio'));
            audio.play().catch(reject);
          });
          if (audioRef.current === audio) {
            audioRef.current = null;
            setSpeakingKey(null);
          }
          return 'server';
        } catch {
          // Politica de autoplay ou audio corrompido: tenta o navegador.
          audioRef.current = null;
        }
      }

      if (!browserCanSpeak()) {
        setSpeakingKey(null);
        return 'none';
      }

      return new Promise<SpeechSource>((resolve) => {
        speakInBrowser(trimmed, languageCode, () => {
          setSpeakingKey(null);
          resolve('browser');
        });
      });
    },
    [status.data?.tts, stop],
  );

  /** Toca uma sequencia de falas, uma depois da outra. */
  const speakSequence = useCallback(
    async (lines: Array<{ text: string; languageCode: string }>, gapMs = 400) => {
      for (const line of lines) {
        await speak(line.text, line.languageCode);
        await new Promise((resolve) => setTimeout(resolve, gapMs));
      }
    },
    [speak],
  );

  return {
    speak,
    speakSequence,
    stop,
    speakingKey,
    isSpeaking: speakingKey !== null,
    /** false quando nao ha nem provider nem voz no navegador. */
    available: (status.data?.tts ?? false) || browserCanSpeak(),
    naturalVoice: status.data?.tts ?? false,
  };
}

// ---------------------------------------------------------------------------
// Gravacao e transcricao
// ---------------------------------------------------------------------------

export function browserCanRecord(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  );
}

export interface Recording {
  blob: Blob;
  mimeType: string;
  seconds: number;
}

/** Gravador de microfone. Devolve o blob cru para quem for transcrever. */
export function useRecorder(maxSeconds = 90) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resolveRef = useRef<((value: Recording | null) => void) | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setSeconds(elapsed);
      // Corta sozinho no teto: gravacao esquecida aberta vira custo de ASR.
      if (elapsed >= maxSeconds) recorderRef.current?.stop();
    }, 250);
    return () => clearInterval(id);
  }, [isRecording, maxSeconds]);

  const start = useCallback(async () => {
    setError(null);

    if (!browserCanRecord()) {
      setError('Este navegador não permite gravar áudio.');
      return false;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Não consegui acessar o microfone. Verifique a permissão do navegador.');
      return false;
    }

    const mimeType = pickRecordingMime();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      // Soltar as trilhas e o que apaga o indicador de microfone ativo.
      stream.getTracks().forEach((track) => track.stop());
      const type = recorder.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      const elapsed = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      setIsRecording(false);
      resolveRef.current?.(blob.size > 0 ? { blob, mimeType: type, seconds: elapsed } : null);
      resolveRef.current = null;
    };

    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setSeconds(0);
    setIsRecording(true);
    recorder.start();
    return true;
  }, []);

  const stop = useCallback((): Promise<Recording | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(null);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      recorder.stop();
    });
  }, []);

  return { start, stop, isRecording, seconds, error, supported: browserCanRecord() };
}

/** Manda o audio para o backend transcrever. */
export async function transcribe(
  recording: Recording,
  languageCode: string,
  hint?: string,
): Promise<string> {
  const base64 = await blobToBase64(recording.blob);
  const { data } = await api.post('/speech/transcribe', {
    audio: base64,
    mimeType: recording.mimeType,
    languageCode,
    ...(hint ? { hint } : {}),
  });
  return (data.text ?? '').trim();
}

function pickRecordingMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não consegui ler o áudio gravado.'));
    reader.onloadend = () => {
      const result = String(reader.result);
      // O FileReader devolve "data:audio/webm;base64,AAAA..." -- so o payload interessa.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Reconhecimento de fala nativo do navegador.
 *
 * E o plano B quando nao ha provider de transcricao no backend: roda gratis,
 * mas so existe em navegadores Chromium e manda o audio para os servidores do
 * proprio navegador. Por isso nunca e a primeira escolha -- so o que impede o
 * Speaking Lab de ficar inutil numa instalacao sem chaves.
 */
type RecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function browserCanRecognize(): boolean {
  return recognitionCtor() !== null;
}

/** Ouve o microfone e resolve com o texto reconhecido. */
export function recognizeInBrowser(languageCode: string): {
  promise: Promise<string>;
  stop: () => void;
} {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    return {
      promise: Promise.reject(new Error('Este navegador não reconhece fala.')),
      stop: () => undefined,
    };
  }

  const recognition = new Ctor();
  recognition.lang = localeFor(languageCode);
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let transcript = '';
  let settled = false;

  const promise = new Promise<string>((resolve, reject) => {
    recognition.onresult = (event) => {
      for (let i = 0; i < event.results.length; i += 1) {
        const alternative = event.results[i][0];
        if (alternative?.transcript) transcript += `${alternative.transcript} `;
      }
    };
    recognition.onerror = (event) => {
      if (settled) return;
      settled = true;
      // "no-speech" e "aborted" sao fim de gravacao, nao falha de verdade.
      if (event.error === 'no-speech' || event.error === 'aborted') return resolve(transcript.trim());
      reject(new Error(`Reconhecimento de fala falhou (${event.error}).`));
    };
    recognition.onend = () => {
      if (settled) return;
      settled = true;
      resolve(transcript.trim());
    };
  });

  recognition.start();
  return { promise, stop: () => recognition.stop() };
}
