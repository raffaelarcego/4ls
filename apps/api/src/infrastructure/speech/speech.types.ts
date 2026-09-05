/**
 * Contrato interno do Speech Gateway.
 *
 * Espelha de proposito o desenho do AI Gateway: nenhum modulo fala com um
 * provider de voz diretamente, a escolha do provider e a cadeia de fallback
 * vivem no router, e o resto do sistema so conhece estas interfaces.
 */

export type SpeechTask = 'speech.tts' | 'speech.stt';

export interface SynthesizeInput {
  text: string;
  /** en | es | de -- o provider traduz para a voz/locale que usar. */
  languageCode: string;
  /** Voz explicita; quando ausente, o provider escolhe a padrao do idioma. */
  voice?: string;
  /** 0.5 a 1.5. Util para listening em nivel iniciante. */
  speed?: number;
}

export interface SynthesizeResult {
  audio: Buffer;
  mimeType: string;
  provider: string;
  model: string;
  voice: string;
  latencyMs: number;
}

export interface TranscribeInput {
  audio: Buffer;
  mimeType: string;
  languageCode: string;
  /** Texto que o aluno deveria ter falado, quando existe. Melhora o encaixe. */
  hint?: string;
}

export interface TranscribeResult {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
}

export interface SpeechProvider {
  readonly name: string;
  /** Sintese configurada (chave presente). */
  canSynthesize(): boolean;
  /** Transcricao configurada. Nem todo provider de TTS faz ASR. */
  canTranscribe(): boolean;
  ttsModel(): string;
  sttModel(): string;
  synthesize(input: SynthesizeInput): Promise<SynthesizeResult>;
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
}

export class SpeechProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
  ) {
    super(`[${provider}] ${message}`);
  }
}

/**
 * Locale por idioma. O navegador e os providers pedem BCP-47; o resto do
 * sistema so conhece o codigo curto que esta no banco.
 */
export const LOCALE_BY_CODE: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
  pt: 'pt-BR',
};

export function localeFor(languageCode: string): string {
  return LOCALE_BY_CODE[languageCode] ?? languageCode;
}

/** Teto por clipe: sintetizar um texto longo e caro e quase sempre um bug. */
export const MAX_TTS_CHARS = 600;
