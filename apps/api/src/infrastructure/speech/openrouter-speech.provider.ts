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
 * Voz pelo OpenRouter, com a mesma chave que ja atende o texto.
 *
 * Existe por um motivo medido, nao por preferencia: a MiMo le espanhol e
 * alemao com fonetica inglesa. Nao e questao de sotaque carregado -- o audio
 * sai irreconhecivel. Passando as sinteses da MiMo por um reconhecedor de
 * fala, "Der kleine Junge lauft durch den blauen Garten" voltou como
 * "Declining Jumcha laughed ... blank garten", e a frase espanhola voltou como
 * "e linyu kubekeinyu kome poe xadinyi". O mesmo teste com este provider
 * devolveu as duas frases corretas, e o reconhecedor identificou os idiomas
 * certos. Instrucao de estilo nao conserta isso: as unicas vozes da MiMo sao
 * inglesas e chinesas.
 *
 * O OpenRouter nao serve `/audio/speech` (nao ha modelo de TTS naquela rota).
 * A sintese sai pelo `/chat/completions` com `modalities: [text, audio]`, que
 * exige `stream: true` e devolve PCM16 cru em pedacos base64 -- dai o cabecalho
 * WAV montado aqui.
 *
 * Como e um modelo de conversa, ele responde ao texto em vez de le-lo: sem
 * instrucao, "El nino corre..." virou "Entendido. Voy a repetir exactamente.
 * El nino corre...". O system prompt abaixo e o que o silencia; foi testado
 * junto das alternativas e e o unico ponto que nao pode ser afrouxado.
 */
@Injectable()
export class OpenRouterSpeechProvider implements SpeechProvider {
  readonly name = 'openrouter';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly defaultVoice: string;
  private readonly voiceByLanguage: Record<string, string>;

  constructor(config: ConfigService) {
    const get = (key: string, fallback: string) =>
      config.get<string>(key, '')?.trim() || fallback;

    this.baseUrl = get('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1');
    this.apiKey = get('OPENROUTER_API_KEY', '');
    this.model = get('OPENROUTER_TTS_MODEL', 'openai/gpt-audio-mini');
    this.defaultVoice = get('OPENROUTER_VOICE', 'alloy');

    // Timbres distintos por idioma, mesma convencao dos outros providers.
    this.voiceByLanguage = {
      en: get('OPENROUTER_VOICE_EN', 'alloy'),
      es: get('OPENROUTER_VOICE_ES', 'coral'),
      de: get('OPENROUTER_VOICE_DE', 'ash'),
      pt: get('OPENROUTER_VOICE_PT', 'sage'),
    };
  }

  canSynthesize(): boolean {
    return Boolean(this.apiKey && this.baseUrl && this.model);
  }

  /** Transcricao aqui e pelo provider compativel com a OpenAI, nao por este. */
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
      throw new SpeechProviderError(this.name, 'provider nao configurado (falta OPENROUTER_API_KEY)');
    }

    const voice = input.voice ?? this.voiceByLanguage[input.languageCode] ?? this.defaultVoice;
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          // Audio de saida so existe em streaming nesta rota.
          stream: true,
          modalities: ['text', 'audio'],
          audio: { voice, format: 'pcm16' },
          messages: [
            { role: 'system', content: NARRATOR_PROMPT },
            // O texto vai puro, sem instrucao em volta: qualquer moldura ("leia
            // isto:") aumenta a chance de o modelo comentar em vez de ler.
            { role: 'user', content: input.text },
          ],
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
    if (!response.body) {
      throw new SpeechProviderError(this.name, 'resposta sem corpo');
    }

    const pcm = await collectAudio(response.body, this.name);
    if (pcm.length === 0) {
      throw new SpeechProviderError(this.name, 'resposta sem audio');
    }

    return {
      audio: wavFromPcm16(pcm),
      mimeType: 'audio/wav',
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

/**
 * O que impede o modelo de conversar em vez de narrar.
 *
 * "You never speak for yourself" e a frase que faz o trabalho: sem ela o
 * modelo cumprimenta, confirma a tarefa ou traduz antes de ler.
 */
const NARRATOR_PROMPT =
  'You are a text-to-speech engine, not an assistant. You never speak for yourself. ' +
  'You read aloud, verbatim, exactly the text the user provides, in its own language, ' +
  'with a native accent of that language. You never greet, confirm, comment, explain, ' +
  'translate, or add a single word of your own.';

/** Junta os pedacos base64 de audio que chegam pelo stream SSE. */
async function collectAudio(body: ReadableStream<Uint8Array>, provider: string): Promise<Buffer> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parts: Buffer[] = [];
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Um chunk da rede pode cortar uma linha ao meio, entao so processamos
      // ate a ultima quebra e guardamos o resto para a proxima volta.
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;

        let event: StreamEvent;
        try {
          event = JSON.parse(payload) as StreamEvent;
        } catch {
          // Comentario de keep-alive ou linha partida: ignorar e seguir.
          continue;
        }

        if (event.error) {
          throw new SpeechProviderError(provider, String(event.error.message ?? event.error));
        }
        for (const choice of event.choices ?? []) {
          const data = choice.delta?.audio?.data;
          if (data) parts.push(Buffer.from(data, 'base64'));
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(parts);
}

interface StreamEvent {
  error?: { message?: string };
  choices?: Array<{ delta?: { audio?: { data?: string } } }>;
}

/** Taxa do PCM devolvido pelo modelo de audio. */
const PCM_SAMPLE_RATE = 24_000;

/**
 * Embrulha PCM16 cru num WAV.
 *
 * O modelo entrega amostras sem cabecalho; sem isto nem o navegador toca nem o
 * cache saberia o que guardou.
 */
function wavFromPcm16(pcm: Buffer, sampleRate = PCM_SAMPLE_RATE): Buffer {
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // tamanho do bloco fmt
  header.writeUInt16LE(1, 20); // PCM sem compressao
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}
