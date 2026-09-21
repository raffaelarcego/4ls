import {
  AiChatInput,
  AiMessage,
  AiChatResponse,
  AiProvider,
  AiProviderError,
  AiTask,
  COMPLEX_TASKS,
} from './ai.types';

/**
 * Traduz uma mensagem do contrato interno para o formato do provider.
 *
 * Sem imagem, `content` vai como string -- que e o que todo provider aceita e o
 * que este projeto manda em 99% das chamadas. Mandar SEMPRE o array de partes
 * pareceria mais uniforme e seria pior: nem todo endpoint compativel aceita o
 * formato multimodal, e o custo de uniformidade seria quebrar as chamadas de
 * texto puro em troca de nada.
 */
function toWireMessage(message: AiMessage): Record<string, unknown> {
  if (!message.images?.length) {
    return { role: message.role, content: message.content };
  }

  return {
    role: message.role,
    content: [
      { type: 'text', text: message.content },
      ...message.images.map((image) => ({
        type: 'image_url',
        image_url: { url: `data:${image.mimeType};base64,${image.data}` },
      })),
    ],
  };
}

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

  /**
   * Campos extras no corpo da requisicao, especificos de um provider.
   *
   * Existe por causa dos modelos de raciocinio: eles precisam de um parametro
   * proprio para nao gastar o teto de tokens pensando, e esse parametro nao e
   * padrao OpenAI -- mandar para quem nao entende e HTTP 400. Cada provider
   * declara o seu aqui; a base nao manda nada.
   */
  protected extraBody(): Record<string, unknown> {
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
      messages: input.messages.map(toWireMessage),
      temperature: input.temperature ?? 0.6,
      max_tokens: input.maxTokens ?? 1200,
      ...this.extraBody(),
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
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    if (!content) {
      /*
       * Vazio com finish_reason "length" nao e o mesmo defeito que vazio puro,
       * e a diferenca e a unica pista que o log guarda. O modelo de raciocinio
       * gastou o teto inteiro pensando e nao sobrou token para a resposta --
       * quem ler "resposta sem conteudo" vai procurar defeito no prompt, que
       * esta certo. O que falta e teto, ou raciocinio desligado.
       */
      if (choice?.finish_reason === 'length') {
        throw new AiProviderError(
          this.name,
          'resposta vazia por estouro de tokens: o raciocinio do modelo consumiu todo o max_tokens ' +
            'antes de escrever a resposta. Aumente maxTokens ou desligue o raciocinio deste provider.',
        );
      }
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
