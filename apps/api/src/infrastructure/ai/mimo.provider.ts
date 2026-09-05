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

  constructor(config: ConfigService) {
    super();
    this.baseUrl = config.get<string>('MIMO_BASE_URL', 'https://api.xiaomimimo.com/v1');
    this.apiKey = config.get<string>('MIMO_API_KEY', '');
    this.strongModel = config.get<string>('MIMO_MODEL', 'mimo-v2.5-pro');
    // A MiMo nao publica um tier "mini"; usamos o mesmo modelo para tarefas simples.
    this.fastModel = config.get<string>('MIMO_FAST_MODEL', this.strongModel);
  }
}
