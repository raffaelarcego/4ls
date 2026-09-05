import { BadRequestException, Injectable } from '@nestjs/common';
import { SpeechRouterService } from '../../infrastructure/speech/speech-router.service';

/**
 * Teto do audio aceito para transcricao.
 *
 * 3 MB de audio viram ~4 MB em base64, que e o limite do body parser e cabe
 * abaixo do teto de 4.5 MB que a Vercel impoe a qualquer requisicao. Na
 * pratica sobra folga: o gravador do front para sozinho em 90 segundos, o que
 * da cerca de 1.5 MB em webm/opus.
 */
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

@Injectable()
export class SpeechService {
  constructor(private readonly speech: SpeechRouterService) {}

  status() {
    return this.speech.status();
  }

  /** Quanto o cache de audio ja evitou de sintetizacao paga. */
  cacheStats() {
    return this.speech.cacheStats();
  }

  /**
   * Devolve o audio em base64 no proprio JSON.
   *
   * A alternativa seria uma URL para <audio src>, mas ai o navegador buscaria
   * o arquivo sem o header Authorization e o endpoint teria de ficar aberto.
   * Como os clipes sao curtos e quase sempre vem do cache, o overhead de 33%
   * do base64 sai mais barato que abrir a rota.
   */
  async speak(
    userId: string,
    input: { text: string; languageCode: string; voice?: string; speed?: number },
  ) {
    const clip = await this.speech.speak({ ...input, userId });
    return {
      id: clip.id,
      audio: clip.audio.toString('base64'),
      mimeType: clip.mimeType,
      voice: clip.voice,
      provider: clip.provider,
      model: clip.model,
      cached: clip.cached,
    };
  }

  async transcribe(
    userId: string,
    input: { audio: string; mimeType: string; languageCode: string; hint?: string },
  ) {
    const audio = Buffer.from(input.audio, 'base64');

    if (audio.length === 0) {
      throw new BadRequestException('Audio vazio ou base64 invalido.');
    }
    if (audio.length > MAX_AUDIO_BYTES) {
      throw new BadRequestException('Audio longo demais. Grave no maximo 90 segundos.');
    }

    const result = await this.speech.listen({
      audio,
      mimeType: input.mimeType,
      languageCode: input.languageCode,
      hint: input.hint,
      userId,
    });

    return { text: result.text, provider: result.provider, model: result.model };
  }
}
