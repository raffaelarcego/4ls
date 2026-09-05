import {
  AiChatInput,
  AiChatResponse,
  AiProvider,
  AiProviderError,
  AiTask,
  COMPLEX_TASKS,
} from './ai.types';

/**
 * MiMo e OpenRouter expoem a mesma interface de chat completions do OpenAI,
 * entao os dois providers herdam daqui e so mudam base URL, chave e headers.
 */
export abstract class OpenAiCompatibleProvider implements AiProvider {
  abstract readonly name: string;
  protected abstract readonly baseUrl: string;
  protected abstract readonly apiKey: string;
  protected abstract readonly fastModel: string;
  protected abstract readonly strongModel: string;

  protected extraHeaders(): Record<string, string> {
    return {};
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.baseUrl);
  }

  modelFor(task: AiTask): string {
    return COMPLEX_TASKS.has(task) ? this.strongModel : this.fastModel;
  }

  async chat(input: AiChatInput): Promise<AiChatResponse> {
    if (!this.isConfigured()) {
      throw new AiProviderError(this.name, 'provider nao configurado (falta API key ou base URL)');
    }

    const model = this.modelFor(input.task);
    const startedAt = Date.now();

    const body: Record<string, unknown> = {
      model,
      messages: input.messages,
      temperature: input.temperature ?? 0.6,
      max_tokens: input.maxTokens ?? 1200,
    };
    if (input.json) {
      body.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...this.extraHeaders(),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      throw new AiProviderError(this.name, (err as Error).message);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new AiProviderError(this.name, `HTTP ${response.status}: ${text.slice(0, 400)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new AiProviderError(this.name, 'resposta sem conteudo');
    }

    return {
      content,
      provider: this.name,
      model,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - startedAt,
    };
  }
}
