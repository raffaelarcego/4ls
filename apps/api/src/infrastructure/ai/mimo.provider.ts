import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';

@Injectable()
export class MimoProvider extends OpenAiCompatibleProvider {
  readonly name = 'mimo';
  protected readonly baseUrl: string;
  protected readonly apiKey: string;
  protected readonly fastModel: string;
  protected readonly strongModel: string;
  private readonly thinking: boolean;

  constructor(config: ConfigService) {
    super();
    this.baseUrl = config.get<string>('MIMO_BASE_URL', 'https://api.xiaomimimo.com/v1');
    this.apiKey = config.get<string>('MIMO_API_KEY', '');
    this.strongModel = config.get<string>('MIMO_MODEL', 'mimo-v2.5-pro');
    // A MiMo nao publica um tier "mini"; usamos o mesmo modelo para tarefas simples.
    this.fastModel = config.get<string>('MIMO_FAST_MODEL', this.strongModel);
    this.thinking = config.get<string>('MIMO_THINKING', 'off').toLowerCase() === 'on';
  }

  /**
   * A MiMo e modelo de raciocinio, e o raciocinio dela conta no mesmo teto da
   * resposta. Nas aulas longas ele consome o teto INTEIRO -- a chamada volta
   * 200, com finish_reason "length" e `content` vazio, e o router a trata como
   * falha e cai no Sonnet. Era a origem de quase todo o gasto com modelo caro:
   * a MiMo nao estava sendo pior, estava sendo cortada antes de responder.
   *
   * Medido com os prompts reais: `structure.generate` saia 0 de 4 com
   * raciocinio ligado e 4 de 4 sem ele, gastando 1.300 tokens de saida em vez
   * de estourar os 4.000.
   *
   * `chat_template_kwargs` nao e parametro OpenAI -- e por isso que ele mora
   * aqui e nao na base, que o OpenRouter tambem usa.
   */
  protected extraBody(): Record<string, unknown> {
    if (this.thinking) return {};
    return { chat_template_kwargs: { enable_thinking: false } };
  }
}
