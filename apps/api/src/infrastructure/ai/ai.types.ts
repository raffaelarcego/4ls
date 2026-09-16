/**
 * Contrato interno do AI Gateway.
 * A aplicacao nunca fala com MiMo ou OpenRouter diretamente -- sempre por aqui.
 */

export type AiTask =
  | 'tutor.chat'
  | 'tutor.correct'
  | 'exercise.generate'
  | 'grammar.drill'
  | 'concept.translate'
  | 'concept.extract'
  | 'production.evaluate'
  | 'structure.generate'
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
  // A aula de formacao de frase entra no pool e e reusada por meses, igual aos
  // drills. Uma ordem de palavras errada aqui ensina a montar frase errada --
  // o erro mais caro do produto, porque o aluno o repete em tudo que fala.
  'structure.generate',
  // Traduzir um conceito e curto, mas erra de um jeito que estraga: uma palavra
  // pouco natural em russo vira card e o aluno decora o que ninguem diz.
  'concept.translate',
  // A producao quadrupla so vale se o modelo enxergar as quatro tentativas de
  // cima e acusar a contaminacao entre elas -- exatamente o que o modelo rapido
  // nao faz. Sem isso o exercicio vira quatro correcoes isoladas.
  'production.evaluate',
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
