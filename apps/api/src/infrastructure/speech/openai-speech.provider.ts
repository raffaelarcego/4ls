import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SpeechProvider,
  SpeechProviderError,
  SynthesizeInput,
  SynthesizeResult,
  TranscribeInput,
  TranscribeResult,
} from './speech.types';

/**
 * Provider para qualquer API que exponha as rotas de audio no formato da
 * OpenAI (`/audio/speech` e `/audio/transcriptions`). Isso cobre a propria
 * OpenAI, o Azure OpenAI e os gateways compativeis -- basta trocar a base URL.
 *
 * E o unico provider do projeto que faz as duas pontas: falar e ouvir.
 */
@Injectable()
export class OpenAiSpeechProvider implements SpeechProvider {
  readonly name = 'openai';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly tts: string;
  private readonly stt: string;
  private readonly defaultVoice: string;
  private readonly voiceByLanguage: Record<string, string>;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('SPEECH_BASE_URL', 'https://api.openai.com/v1');
    this.apiKey = config.get<string>('SPEECH_API_KEY', '');
    this.tts = config.get<string>('SPEECH_TTS_MODEL', 'gpt-4o-mini-tts');
    this.stt = config.get<string>('SPEECH_STT_MODEL', 'whisper-1');
    this.defaultVoice = config.get<string>('SPEECH_VOICE', 'alloy');

    // As vozes da OpenAI sao multilingues, mas timbres diferentes por idioma
    // ajudam o aluno a nao confundir os tres cursos.
    this.voiceByLanguage = {
      en: config.get<string>('SPEECH_VOICE_EN', 'alloy'),
      es: config.get<string>('SPEECH_VOICE_ES', 'nova'),
      de: config.get<string>('SPEECH_VOICE_DE', 'onyx'),
    };
  }

  canSynthesize(): boolean {
    return Boolean(this.apiKey && this.baseUrl);
  }

  canTranscribe(): boolean {
    return this.canSynthesize();
  }

  ttsModel(): string {
    return this.tts;
  }

  sttModel(): string {
    return this.stt;
  }

  private voiceFor(input: SynthesizeInput): string {
    return input.voice ?? this.voiceByLanguage[input.languageCode] ?? this.defaultVoice;
  }

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}${path}`;
  }

  async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    if (!this.canSynthesize()) {
      throw new SpeechProviderError(this.name, 'provider nao configurado (falta SPEECH_API_KEY)');
    }

    const voice = this.voiceFor(input);
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    let response: Response;
    try {
      response = await fetch(this.url('/audio/speech'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.tts,
          voice,
          input: input.text,
          speed: input.speed ?? 1,
          response_format: 'mp3',
        }),
        signal: controller.signal,
      });
    } catch (err) {
      throw new SpeechProviderError(this.name, (err as Error).message);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new SpeechProviderError(this.name, `HTTP ${response.status}: ${text.slice(0, 300)}`);
    }

    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length === 0) {
      throw new SpeechProviderError(this.name, 'resposta de audio vazia');
    }

    return {
      audio,
      mimeType: 'audio/mpeg',
      provider: this.name,
      model: this.tts,
      voice,
      latencyMs: Date.now() - startedAt,
    };
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    if (!this.canTranscribe()) {
      throw new SpeechProviderError(this.name, 'provider nao configurado (falta SPEECH_API_KEY)');
    }

    const startedAt = Date.now();
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(input.audio)], { type: input.mimeType }), fileNameFor(input.mimeType));
    form.append('model', this.stt);
    form.append('language', input.languageCode);
    // O "prompt" do Whisper e uma dica de contexto, nao uma instrucao: passar
    // a frase esperada melhora muito o encaixe de nomes proprios e numeros.
    if (input.hint) form.append('prompt', input.hint.slice(0, 400));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    let response: Response;
    try {
      response = await fetch(this.url('/audio/transcriptions'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
        signal: controller.signal,
      });
    } catch (err) {
      throw new SpeechProviderError(this.name, (err as Error).message);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new SpeechProviderError(this.name, `HTTP ${response.status}: ${text.slice(0, 300)}`);
    }

    const data = (await response.json()) as { text?: string };
    if (typeof data.text !== 'string') {
      throw new SpeechProviderError(this.name, 'resposta sem transcricao');
    }

    return {
      text: data.text.trim(),
      provider: this.name,
      model: this.stt,
      latencyMs: Date.now() - startedAt,
    };
  }
}

/** O Whisper decide o decoder pela extensao do arquivo enviado. */
function fileNameFor(mimeType: string): string {
  const extension = mimeType.includes('webm')
    ? 'webm'
    : mimeType.includes('ogg')
      ? 'ogg'
      : mimeType.includes('wav')
        ? 'wav'
        : mimeType.includes('mp4') || mimeType.includes('m4a')
          ? 'm4a'
          : 'mp3';
  return `audio.${extension}`;
}
