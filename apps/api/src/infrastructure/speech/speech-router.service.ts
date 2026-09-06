import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { ElevenLabsProvider } from './elevenlabs.provider';
import { MimoSpeechProvider } from './mimo-speech.provider';
import { OpenAiSpeechProvider } from './openai-speech.provider';
import { OpenRouterSpeechProvider } from './openrouter-speech.provider';
import {
  MAX_TTS_CHARS,
  SpeechProvider,
  SynthesizeInput,
  TranscribeInput,
  TranscribeResult,
} from './speech.types';

export interface SpokenClip {
  id: string;
  audio: Buffer;
  mimeType: string;
  provider: string;
  model: string;
  voice: string;
  /** true quando o audio veio do cache, sem custo novo. */
  cached: boolean;
}

export interface SpeechStatus {
  tts: boolean;
  stt: boolean;
  providers: string[];
}

/**
 * Escolhe o provider de voz, cai para o proximo quando o primeiro falha e --
 * o ponto que mais importa no custo -- guarda cada audio sintetizado.
 *
 * A chave do cache e o hash do texto, nao o id do termo. Duas frases iguais
 * no mesmo idioma compartilham o mesmo clipe, venham elas do flashcard, do
 * ditado ou de um dialogo de listening. Como o conteudo de estudo se repete
 * muito, na pratica so a primeira exposicao de cada frase custa dinheiro.
 */
@Injectable()
export class SpeechRouterService {
  private readonly logger = new Logger(SpeechRouterService.name);
  private readonly chain: SpeechProvider[];

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    mimo: MimoSpeechProvider,
    openai: OpenAiSpeechProvider,
    elevenlabs: ElevenLabsProvider,
    openrouter: OpenRouterSpeechProvider,
  ) {
    const byName: Record<string, SpeechProvider> = { mimo, openai, elevenlabs, openrouter };
    /*
     * OpenRouter primeiro, MiMo depois.
     *
     * A MiMo usava a mesma chave do texto e por isso vinha na frente, mas ela
     * so tem vozes inglesas e chinesas: espanhol e alemao saiam com fonetica
     * inglesa, irreconheciveis ate para um ASR. O OpenRouter usa a mesma chave
     * e pronuncia os tres idiomas corretamente -- e mais caro por frase, o que
     * o cache de clipes amortiza, ja que cada frase e sintetizada uma vez so.
     *
     * A MiMo continua na cadeia como reserva: se o OpenRouter cair, uma voz
     * com sotaque errado ainda e melhor que silencio.
     */
    this.chain = config
      .get<string>('SPEECH_PROVIDER_ORDER', 'openrouter,mimo,openai,elevenlabs')
      .split(',')
      .map((s) => byName[s.trim().toLowerCase()])
      .filter((p): p is SpeechProvider => Boolean(p));
  }

  status(): SpeechStatus {
    const configured = this.chain.filter((p) => p.canSynthesize());
    return {
      tts: configured.length > 0,
      stt: this.chain.some((p) => p.canTranscribe()),
      providers: configured.map((p) => p.name),
    };
  }

  /**
   * Sintetiza (ou recupera do cache) uma frase.
   *
   * Nunca lanca por falta de provider sem antes deixar claro o motivo: o front
   * usa esse 503 como sinal para cair na voz do proprio navegador.
   */
  async speak(input: SynthesizeInput & { userId?: string }): Promise<SpokenClip> {
    const text = input.text.trim();
    if (!text) throw new ServiceUnavailableException('Texto vazio.');

    const truncated = text.slice(0, MAX_TTS_CHARS);
    const hash = clipHash(truncated, input);

    const cached = await this.prisma.speechClip.findUnique({ where: { hash } });
    if (cached) {
      // Contagem de reproducao e o que mostra quais frases valem manter.
      await this.prisma.speechClip
        .update({
          where: { id: cached.id },
          data: { playCount: { increment: 1 }, lastPlayedAt: new Date() },
        })
        .catch(() => undefined);

      return {
        id: cached.id,
        audio: Buffer.from(cached.data),
        mimeType: cached.mimeType,
        provider: cached.provider,
        model: cached.model,
        voice: cached.voice,
        cached: true,
      };
    }

    const providers = this.chain.filter((p) => p.canSynthesize());
    if (providers.length === 0) {
      throw new ServiceUnavailableException(
        'Nenhum provider de voz configurado. Defina SPEECH_API_KEY ou ELEVENLABS_API_KEY no .env do backend.',
      );
    }

    const failures: string[] = [];

    for (const provider of providers) {
      try {
        const result = await provider.synthesize({ ...input, text: truncated });

        await this.log({
          userId: input.userId,
          task: 'speech.tts',
          provider: result.provider,
          model: result.model,
          language: input.languageCode,
          latencyMs: result.latencyMs,
          success: true,
          error: null,
          estimatedCost: ttsCost(result.model, truncated.length),
        });

        const stored = await this.prisma.speechClip.create({
          data: {
            hash,
            languageCode: input.languageCode,
            voice: result.voice,
            text: truncated,
            mimeType: result.mimeType,
            // O Prisma tipa Bytes como Uint8Array<ArrayBuffer>; um Buffer do
            // Node satisfaz a interface mas nao o tipo, entao convertemos.
            data: new Uint8Array(result.audio),
            bytes: result.audio.length,
            provider: result.provider,
            model: result.model,
          },
        });

        return {
          id: stored.id,
          audio: result.audio,
          mimeType: result.mimeType,
          provider: result.provider,
          model: result.model,
          voice: result.voice,
          cached: false,
        };
      } catch (err) {
        const message = (err as Error).message;
        failures.push(message);
        this.logger.warn(`Provider de voz ${provider.name} falhou: ${message}`);
        await this.log({
          userId: input.userId,
          task: 'speech.tts',
          provider: provider.name,
          model: provider.ttsModel(),
          language: input.languageCode,
          latencyMs: 0,
          success: false,
          error: message,
          estimatedCost: 0,
        });
      }
    }

    throw new ServiceUnavailableException(
      `Todos os providers de voz falharam. Detalhes: ${failures.join(' | ')}`,
    );
  }

  /** Transcreve um audio gravado pelo aluno. */
  async listen(input: TranscribeInput & { userId?: string }): Promise<TranscribeResult> {
    const providers = this.chain.filter((p) => p.canTranscribe());
    if (providers.length === 0) {
      throw new ServiceUnavailableException(
        'Nenhum provider de transcricao configurado. Defina SPEECH_API_KEY no .env do backend.',
      );
    }

    const failures: string[] = [];

    for (const provider of providers) {
      try {
        const result = await provider.transcribe(input);
        await this.log({
          userId: input.userId,
          task: 'speech.stt',
          provider: result.provider,
          model: result.model,
          language: input.languageCode,
          latencyMs: result.latencyMs,
          success: true,
          error: null,
          estimatedCost: sttCost(input.audio.length),
        });
        return result;
      } catch (err) {
        const message = (err as Error).message;
        failures.push(message);
        this.logger.warn(`Transcricao por ${provider.name} falhou: ${message}`);
        await this.log({
          userId: input.userId,
          task: 'speech.stt',
          provider: provider.name,
          model: provider.sttModel(),
          language: input.languageCode,
          latencyMs: 0,
          success: false,
          error: message,
          estimatedCost: 0,
        });
      }
    }

    throw new ServiceUnavailableException(
      `Nao foi possivel transcrever o audio. Detalhes: ${failures.join(' | ')}`,
    );
  }

  /** Estatisticas do cache, para a tela de Progresso. */
  async cacheStats() {
    const [aggregate, topPlayed] = await Promise.all([
      this.prisma.speechClip.aggregate({
        _count: { _all: true },
        _sum: { bytes: true, playCount: true },
      }),
      this.prisma.speechClip.findMany({
        orderBy: { playCount: 'desc' },
        take: 5,
        select: { text: true, languageCode: true, playCount: true },
      }),
    ]);

    const clips = aggregate._count._all;
    const plays = aggregate._sum.playCount ?? 0;

    return {
      clips,
      megabytes: Number((((aggregate._sum.bytes ?? 0) / 1024 / 1024) as number).toFixed(2)),
      plays,
      // Cada reproducao alem da primeira e uma sintetizacao que nao foi paga.
      savedSyntheses: Math.max(0, plays - clips),
      topPlayed,
    };
  }

  /**
   * Registra a chamada em ai_call_logs, junto com as de texto.
   * Voz nao gasta tokens, entao as colunas de token ficam zeradas de proposito
   * -- o que importa comparar aqui e custo e latencia.
   */
  private async log(entry: {
    userId?: string;
    task: string;
    provider: string;
    model: string;
    language?: string;
    latencyMs: number;
    success: boolean;
    error: string | null;
    estimatedCost: number;
  }) {
    try {
      await this.prisma.aiCallLog.create({
        data: {
          userId: entry.userId ?? null,
          provider: entry.provider,
          model: entry.model || entry.provider,
          task: entry.task,
          language: entry.language ?? null,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: entry.latencyMs,
          success: entry.success,
          error: entry.error?.slice(0, 500) ?? null,
          estimatedCost: entry.estimatedCost,
        },
      });
    } catch (err) {
      // Observabilidade nunca deve derrubar a requisicao do usuario.
      this.logger.error(`Falha ao registrar chamada de voz: ${(err as Error).message}`);
    }
  }
}

/**
 * Versao da receita de sintese (estilo, sotaque, escolha de voz por idioma).
 *
 * Entra no hash para que uma mudanca nessa receita nao continue servindo os
 * clipes antigos do cache. Sem isso, corrigir o sotaque do espanhol nao teria
 * efeito nenhum nas frases ja sintetizadas -- que sao justamente as mais
 * ouvidas. Suba o numero sempre que mudar como um idioma deve soar.
 */
const CLIP_RECIPE_VERSION = 4;

function clipHash(text: string, input: SynthesizeInput): string {
  return createHash('sha256')
    .update(
      `v${CLIP_RECIPE_VERSION}|${input.languageCode}|${input.voice ?? 'auto'}|${input.speed ?? 1}|${text}`,
    )
    .digest('hex');
}

/** Estimativas grosseiras em USD, so para ranquear custo entre providers. */
const TTS_PRICE_PER_1K_CHARS: Record<string, number> = {
  // Este cobra por token de audio, nao por caractere. O valor abaixo veio de
  // medir uma frase real (~28 caracteres custaram US$ 0,00024) e serve so para
  // ranquear custo entre providers, que e o proposito destas estimativas.
  'openai/gpt-audio-mini': 0.009,
  'openai/gpt-audio': 0.24,
  'gpt-4o-mini-tts': 0.015,
  'tts-1': 0.015,
  'tts-1-hd': 0.03,
  eleven_multilingual_v2: 0.18,
};

function ttsCost(model: string, chars: number): number {
  const price = TTS_PRICE_PER_1K_CHARS[model] ?? 0.02;
  return (chars / 1000) * price;
}

/**
 * O Whisper cobra por minuto de audio. Nao sabemos a duracao aqui, entao
 * estimamos pelo tamanho: ~16 KB/s e a media de um webm/opus de voz.
 */
function sttCost(bytes: number): number {
  const seconds = bytes / 16_000;
  return (seconds / 60) * 0.006;
}
