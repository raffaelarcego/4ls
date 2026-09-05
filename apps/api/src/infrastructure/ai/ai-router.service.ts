import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { AiChatInput, AiChatResponse, AiProvider, AiTask, COMPLEX_TASKS } from './ai.types';
import { MimoProvider } from './mimo.provider';
import { OpenRouterProvider } from './openrouter.provider';

/**
 * Decide qual provider atende cada tarefa e cai para o proximo quando o
 * principal falha. Toda chamada -- inclusive as que falham -- vira uma linha
 * em ai_call_logs, que e o que permite comparar custo e qualidade depois.
 */
@Injectable()
export class AiRouterService {
  private readonly logger = new Logger(AiRouterService.name);
  private readonly strongChain: AiProvider[];
  private readonly fastChain: AiProvider[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    mimo: MimoProvider,
    openrouter: OpenRouterProvider,
  ) {
    const byName: Record<string, AiProvider> = { mimo, openrouter };
    const resolve = (order: string) =>
      order
        .split(',')
        .map((s) => byName[s.trim().toLowerCase()])
        .filter((p): p is AiProvider => Boolean(p));

    this.strongChain = resolve(this.config.get<string>('AI_PROVIDER_ORDER', 'mimo,openrouter'));

    // Tarefas simples usam uma cadeia propria, que comeca pelo provider com
    // modelo economico de verdade. Sem isso, uma traducao curta pagaria o
    // preco e a latencia do modelo forte.
    this.fastChain = resolve(
      this.config.get<string>('AI_FAST_PROVIDER_ORDER', 'openrouter,mimo'),
    );
  }

  /** Cadeia de providers configurados para a classe da tarefa. */
  private chainFor(task: AiTask): AiProvider[] {
    const chain = COMPLEX_TASKS.has(task) ? this.strongChain : this.fastChain;
    const available = chain.filter((p) => p.isConfigured());
    // Se a cadeia preferida nao tem ninguem configurado, cai na outra.
    if (available.length > 0) return available;
    return (COMPLEX_TASKS.has(task) ? this.fastChain : this.strongChain).filter((p) =>
      p.isConfigured(),
    );
  }

  /** Providers que realmente tem chave configurada. */
  availableProviders(): AiProvider[] {
    const all = [...this.strongChain, ...this.fastChain].filter((p) => p.isConfigured());
    return all.filter((p, i) => all.indexOf(p) === i);
  }

  hasProvider(): boolean {
    return this.availableProviders().length > 0;
  }

  async chat(input: AiChatInput): Promise<AiChatResponse> {
    const providers = this.chainFor(input.task);

    if (providers.length === 0) {
      throw new ServiceUnavailableException(
        'Nenhum provider de IA configurado. Defina MIMO_API_KEY ou OPENROUTER_API_KEY no .env do backend.',
      );
    }

    const failures: string[] = [];

    for (const provider of providers) {
      try {
        const response = await provider.chat(input);
        await this.log(input, response, true, null);
        return response;
      } catch (err) {
        const message = (err as Error).message;
        failures.push(message);
        this.logger.warn(`Provider ${provider.name} falhou na tarefa ${input.task}: ${message}`);
        await this.log(
          input,
          { provider: provider.name, model: provider.modelFor(input.task) },
          false,
          message,
        );
      }
    }

    throw new ServiceUnavailableException(
      `Todos os providers de IA falharam. Detalhes: ${failures.join(' | ')}`,
    );
  }

  /**
   * Igual a chat(), mas garante um objeto JSON de volta. Modelos as vezes
   * embrulham o JSON em blocos markdown, entao limpamos antes do parse.
   */
  async chatJson<T>(input: AiChatInput): Promise<T> {
    const response = await this.chat({ ...input, json: true });
    return parseJsonResponse<T>(response.content);
  }

  private async log(
    input: AiChatInput,
    response: Partial<AiChatResponse> & { provider: string; model: string },
    success: boolean,
    error: string | null,
  ) {
    try {
      await this.prisma.aiCallLog.create({
        data: {
          userId: input.userId ?? null,
          provider: response.provider,
          model: response.model,
          task: input.task,
          language: input.language ?? null,
          inputTokens: response.inputTokens ?? 0,
          outputTokens: response.outputTokens ?? 0,
          latencyMs: response.latencyMs ?? 0,
          success,
          error: error?.slice(0, 500) ?? null,
          estimatedCost: estimateCost(
            response.model,
            response.inputTokens ?? 0,
            response.outputTokens ?? 0,
          ),
        },
      });
    } catch (err) {
      // Observabilidade nunca deve derrubar a requisicao do usuario.
      this.logger.error(`Falha ao registrar chamada de IA: ${(err as Error).message}`);
    }
  }
}

export function parseJsonResponse<T>(raw: string): T {
  let text = raw.trim();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();

  try {
    return JSON.parse(text) as T;
  } catch {
    // Ultimo recurso: recorta do primeiro { ou [ ate o fechamento correspondente.
    const start = text.search(/[{[]/);
    const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1)) as T;
    }
    throw new Error(`Resposta da IA nao e JSON valido: ${raw.slice(0, 200)}`);
  }
}

/** Estimativa grosseira em USD, so para ranquear custo entre modelos. */
const PRICE_PER_MTOK: Record<string, { in: number; out: number }> = {
  'mimo-v2.5-pro': { in: 0.3, out: 1.2 },
  'openai/gpt-4o-mini': { in: 0.15, out: 0.6 },
  'anthropic/claude-sonnet-4.5': { in: 3, out: 15 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICE_PER_MTOK[model] ?? { in: 0.5, out: 1.5 };
  return (inputTokens * price.in + outputTokens * price.out) / 1_000_000;
}
