/**
 * Contrato interno do AI Gateway.
 * A aplicacao nunca fala com MiMo ou OpenRouter diretamente -- sempre por aqui.
 */

export type AiTask =
  | 'tutor.chat'
  | 'tutor.correct'
  | 'exercise.generate'
  | 'grammar.drill'
  | 'lesson.generate'
  | 'listening.generate'
  | 'dictation.generate'
  | 'speaking.mission'
  | 'writing.correct'
  | 'speaking.evaluate'
  | 'errors.extract'
  | 'plan.create'
  | 'translate'
  | 'classify';

/** Tarefas complexas vao para o modelo forte; o resto usa o rapido/economico. */
export const COMPLEX_TASKS: ReadonlySet<AiTask> = new Set<AiTask>([
  'speaking.evaluate',
  'plan.create',
  'errors.extract',
  'writing.correct',
  'lesson.generate',
  // Um dialogo de listening vira audio e fica em cache: vale pagar o modelo
  // forte uma vez para nao gerar conteudo torto que sera ouvido muitas vezes.
  'listening.generate',
  // Mesmo argumento, e mais forte: um exercicio de gramatica errado ensina a
  // regra errada, fica no pool e e repetido por meses. O modelo rapido erra
  // aqui de formas caras -- marca como errada uma frase correta, ou poe a
  // lacuna fora do ponto que o topico ensina.
  'grammar.drill',
]);

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatInput {
  task: AiTask;
  messages: AiMessage[];
  /** Forca resposta em JSON valido. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** Metadados apenas para observabilidade. */
  userId?: string;
  language?: string;
}

export interface AiChatResponse {
  content: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface AiProvider {
  readonly name: string;
  isConfigured(): boolean;
  /** Modelo escolhido para a tarefa (rapido vs forte). */
  modelFor(task: AiTask): string;
  chat(input: AiChatInput): Promise<AiChatResponse>;
}

export class AiProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
  ) {
    super(`[${provider}] ${message}`);
  }
}
