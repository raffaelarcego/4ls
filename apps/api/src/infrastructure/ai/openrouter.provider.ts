import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';

@Injectable()
export class OpenRouterProvider extends OpenAiCompatibleProvider {
  readonly name = 'openrouter';
  protected readonly baseUrl: string;
  protected readonly apiKey: string;
  protected readonly fastModel: string;
  protected readonly strongModel: string;
  private readonly siteUrl: string;

  constructor(config: ConfigService) {
    super();
    this.baseUrl = config.get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1');
    this.apiKey = config.get<string>('OPENROUTER_API_KEY', '');
    this.strongModel = config.get<string>('OPENROUTER_STRONG_MODEL', 'anthropic/claude-sonnet-4.5');
    this.fastModel = config.get<string>('OPENROUTER_FAST_MODEL', 'openai/gpt-4o-mini');
    this.siteUrl = config.get<string>('APP_URL', 'http://localhost:5173');
  }

  protected extraHeaders(): Record<string, string> {
    // O OpenRouter usa estes headers para atribuicao de uso.
    return {
      'HTTP-Referer': this.siteUrl,
      'X-Title': 'Raffael 4L',
    };
  }
}
