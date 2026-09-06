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
 * Voz pela MiMo, usando a mesma chave que ja atende o texto.
 *
 * A MiMo nao expoe `/audio/speech` como a OpenAI: TTS e ASR passam pelo
 * proprio `/chat/completions`, com o modelo de audio e um formato de mensagem
 * proprio. Por isso este provider nao herda do OpenAiCompatibleProvider -- so
 * a URL coincide.
 *
 * No TTS o contrato e invertido em relacao ao que se espera: o texto a ser
 * falado vai na mensagem **assistant**, e a mensagem **user** carrega a
 * instrucao de estilo em linguagem natural. Mandar o texto no user retorna
 * "messages must contain an assistant role for TTS model".
 */
@Injectable()
export class MimoSpeechProvider implements SpeechProvider {
  readonly name = 'mimo';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly tts: string;
  private readonly asr: string;
  private readonly style: string;
  private readonly accentByLanguage: Record<string, string>;
  private readonly defaultVoice: string;
  private readonly voiceByLanguage: Record<string, string>;
  private readonly asrLanguages: Set<string>;
  private readonly asrFormats: Set<string>;

  constructor(configService: ConfigService) {
    /*
     * Uma variavel declarada vazia no .env ("MIMO_TTS_STYLE=") chega aqui como
     * string vazia, e nao como ausente -- entao o default do ConfigService nao
     * dispara e o estilo sumiria. Como o .env.example documenta o vazio como
     * "usa o padrao", tratamos em branco e ausente do mesmo jeito.
     */
    const config = {
      get: <T extends string>(key: string, fallback: T): T | string =>
        configService.get<string>(key, '')?.trim() || fallback,
    };

    this.baseUrl = config.get<string>('MIMO_BASE_URL', 'https://api.xiaomimimo.com/v1');
    this.apiKey = config.get<string>('MIMO_API_KEY', '');
    this.tts = config.get<string>('MIMO_TTS_MODEL', 'mimo-v2.5-tts');
    this.asr = config.get<string>('MIMO_ASR_MODEL', 'mimo-v2.5-asr');

    this.style = config.get<string>(
      'MIMO_TTS_STYLE',
      'Clear, natural pace, neutral and friendly tone, as a language teacher reading an example aloud. Do not add words.',
    );

    /*
     * Sotaque.
     *
     * A instrucao de estilo e o unico controle de pronuncia que a MiMo expoe
     * -- nao ha parametro de idioma na chamada. Sem dizer nada, o modelo le
     * espanhol e alemao com a fonetica da voz base, e sai um "hola" com
     * sotaque americano.
     *
     * A instrucao de cada idioma vai escrita NO PROPRIO IDIOMA: alem do que
     * ela pede em palavras, o idioma em que esta escrita ja e por si o sinal
     * mais forte de qual fonetica ativar. Por isso nao traduza estas linhas
     * para portugues.
     */
    this.accentByLanguage = {
      en: config.get<string>(
        'MIMO_ACCENT_EN',
        'Speak in English as a native speaker, with a natural standard American English accent.',
      ),
      es: config.get<string>(
        'MIMO_ACCENT_ES',
        'Habla en español como un hablante nativo de España, con acento castellano natural: distingue la c/z de la s, pronuncia la r vibrante y la j velar, y no uses en ningún momento pronunciación inglesa.',
      ),
      de: config.get<string>(
        'MIMO_ACCENT_DE',
        'Sprich Deutsch wie ein Muttersprachler, mit natürlichem Hochdeutsch: klares gerolltes bzw. uvulares R, korrekte Umlaute (ä, ö, ü), harte Endkonsonanten und der Ich-Laut in „ich". Verwende auf keinen Fall eine englische Aussprache.',
      ),
      pt: config.get<string>(
        'MIMO_ACCENT_PT',
        'Fale em português do Brasil como falante nativo, com sotaque brasileiro natural e neutro.',
      ),
    };

    // Timbres distintos por idioma ajudam o aluno a nao confundir os cursos.
    this.defaultVoice = config.get<string>('MIMO_VOICE', 'Mia');
    this.voiceByLanguage = {
      en: config.get<string>('MIMO_VOICE_EN', 'Mia'),
      es: config.get<string>('MIMO_VOICE_ES', 'Chloe'),
      de: config.get<string>('MIMO_VOICE_DE', 'Dean'),
    };

    /*
     * O ASR da MiMo so foi confiavel em ingles nos testes: uma frase alema
     * limpa voltou como "But, Margen, we get es今他" -- ingles e chines
     * misturados. Entregar isso ao Speaking Lab geraria correcao sobre um
     * texto que o aluno nunca disse, que e pior que nao ter transcricao.
     * Fora dos idiomas listados o provider recusa, e a cadeia cai para o
     * proximo (Whisper) ou para o reconhecimento do navegador.
     *
     * Vem **vazio por padrao**, o que desliga o ASR deste provider. Alem da
     * qualidade, ha um impedimento pratico: o MediaRecorder do navegador grava
     * em webm/opus e a MiMo aceita wav/mp3 -- entao mesmo em ingles a chamada
     * falharia. Com a lista vazia, `/speech/status` responde stt:false e o
     * front ja usa o reconhecimento do navegador, em vez de tentar e errar.
     * Para habilitar (com audio wav), defina MIMO_ASR_LANGUAGES="en".
     */
    this.asrLanguages = new Set(
      config
        .get<string>('MIMO_ASR_LANGUAGES', '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );

    // A gravacao do navegador sai em webm/opus, que nao consta nos formatos
    // documentados. Recusar cedo e melhor que mandar e receber lixo.
    this.asrFormats = new Set(
      config
        .get<string>('MIMO_ASR_FORMATS', 'wav,mp3,m4a,mp4')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  canSynthesize(): boolean {
    return Boolean(this.apiKey && this.baseUrl);
  }

  canTranscribe(): boolean {
    return this.canSynthesize() && this.asrLanguages.size > 0;
  }

  ttsModel(): string {
    return this.tts;
  }

  sttModel(): string {
    return this.asr;
  }

  private async call(body: unknown, timeoutMs: number): Promise<MimoChatResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
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

    return (await response.json()) as MimoChatResponse;
  }

  /**
   * Estilo + sotaque do idioma. O sotaque vem primeiro de proposito: e a
   * primeira instrucao que o modelo le, e o resto (ritmo, tom) so ajusta uma
   * pronuncia que ja nasceu no idioma certo.
   */
  private styleFor(languageCode: string): string {
    const accent = this.accentByLanguage[languageCode.toLowerCase()];
    return accent ? `${accent} ${this.style}` : this.style;
  }

  async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    if (!this.canSynthesize()) {
      throw new SpeechProviderError(this.name, 'provider nao configurado (falta MIMO_API_KEY)');
    }

    const voice = input.voice ?? this.voiceByLanguage[input.languageCode] ?? this.defaultVoice;
    const startedAt = Date.now();

    const data = await this.call(
      {
        model: this.tts,
        messages: [
          { role: 'user', content: this.styleFor(input.languageCode) },
          // O texto a falar vai aqui, no assistant. Nao inverta.
          { role: 'assistant', content: input.text },
        ],
        audio: { format: 'wav', voice },
      },
      60_000,
    );

    const base64 = data.choices?.[0]?.message?.audio?.data;
    if (!base64) {
      throw new SpeechProviderError(this.name, 'resposta sem audio');
    }

    const audio = Buffer.from(base64, 'base64');
    if (audio.length === 0) {
      throw new SpeechProviderError(this.name, 'audio vazio');
    }

    return {
      audio,
      // A MiMo entrega WAV (sem opcao comprimida). E maior que MP3, mas como
      // cada frase e sintetizada uma unica vez e fica em cache, o custo e de
      // armazenamento, nao de repeticao.
      mimeType: 'audio/wav',
      provider: this.name,
      model: this.tts,
      voice,
      latencyMs: Date.now() - startedAt,
    };
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    if (!this.canTranscribe()) {
      throw new SpeechProviderError(this.name, 'provider nao configurado (falta MIMO_API_KEY)');
    }

    const language = input.languageCode.toLowerCase();
    if (!this.asrLanguages.has(language)) {
      throw new SpeechProviderError(
        this.name,
        `ASR nao confiavel em "${language}" (habilitados: ${[...this.asrLanguages].join(', ')})`,
      );
    }

    const format = formatFor(input.mimeType);
    if (!this.asrFormats.has(format)) {
      throw new SpeechProviderError(this.name, `formato de audio nao suportado: ${format}`);
    }

    const startedAt = Date.now();

    const data = await this.call(
      {
        model: this.asr,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'input_audio',
                input_audio: { data: input.audio.toString('base64'), format },
              },
            ],
          },
        ],
      },
      90_000,
    );

    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      throw new SpeechProviderError(this.name, 'resposta sem transcricao');
    }

    return {
      text: text.trim(),
      provider: this.name,
      model: this.asr,
      latencyMs: Date.now() - startedAt,
    };
  }
}

interface MimoChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
      audio?: { data?: string; transcript?: string };
    };
  }>;
}

function formatFor(mimeType: string): string {
  const type = mimeType.toLowerCase();
  if (type.includes('wav')) return 'wav';
  if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
  if (type.includes('m4a')) return 'm4a';
  if (type.includes('mp4')) return 'mp4';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('webm')) return 'webm';
  return type;
}
