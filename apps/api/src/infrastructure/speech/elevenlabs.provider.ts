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
 * ElevenLabs: so fala, nao ouve. Entra na cadeia quando a prioridade e o
 * timbre -- as vozes multilingues dele sao bem mais naturais que as das APIs
 * genericas, o que importa justamente no conteudo de listening que fica em
 * cache e vai ser ouvido muitas vezes.
 */
@Injectable()
export class ElevenLabsProvider implements SpeechProvider {
  readonly name = 'elevenlabs';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly defaultVoice: string;
  private readonly voiceByLanguage: Record<string, string>;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('ELEVENLABS_BASE_URL', 'https://api.elevenlabs.io/v1');
    this.apiKey = config.get<string>('ELEVENLABS_API_KEY', '');
    this.model = config.get<string>('ELEVENLABS_MODEL', 'eleven_multilingual_v2');
    // "Rachel", a voz publica padrao da conta free.
    this.defaultVoice = config.get<string>('ELEVENLABS_VOICE', '21m00Tcm4TlvDq8ikWAM');
    this.voiceByLanguage = {
      en: config.get<string>('ELEVENLABS_VOICE_EN', ''),
      es: config.get<string>('ELEVENLABS_VOICE_ES', ''),
      de: config.get<string>('ELEVENLABS_VOICE_DE', ''),
    };
  }

  canSynthesize(): boolean {
    return Boolean(this.apiKey);
  }

  canTranscribe(): boolean {
    return false;
  }

  ttsModel(): string {
    return this.model;
  }

  sttModel(): string {
    return '';
  }

  async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    if (!this.canSynthesize()) {
      throw new SpeechProviderError(this.name, 'provider nao configurado (falta ELEVENLABS_API_KEY)');
    }

    const voice =
      input.voice || this.voiceByLanguage[input.languageCode] || this.defaultVoice;
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl.replace(/\/$/, '')}/text-to-speech/${voice}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          body: JSON.stringify({
            text: input.text,
            model_id: this.model,
            // O modelo multilingue detecta o idioma pelo texto; passar o codigo
            // so ajuda quando a frase e curta demais para desambiguar.
            language_code: input.languageCode,
          }),
          signal: controller.signal,
        },
      );
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
      model: this.model,
      voice,
      latencyMs: Date.now() - startedAt,
    };
  }

  async transcribe(_input: TranscribeInput): Promise<TranscribeResult> {
    throw new SpeechProviderError(this.name, 'este provider nao faz transcricao');
  }
}
