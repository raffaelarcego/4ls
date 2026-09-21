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
  | 'capture.ocr'
  | 'production.evaluate'
  | 'structure.generate'
  | 'cando.generate'
  | 'reading.generate'
  | 'morphology.generate'
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
  // A aula de can-do e a mais dificil que pedimos: a MESMA frase realizada nos
  // quatro idiomas, cada uma fatiada pelas mesmas colunas. O modelo rapido
  // entrega quatro frases sobre assuntos parecidos em vez da mesma frase -- e
  // uma aula assim destroi justamente a comparacao que ela deveria ensinar.
  'cando.generate',
  // As quatro versoes de um texto de leitura tem de ser a MESMA historia,
  // alinhada frase a frase. O modelo rapido conta a historia parecida em cada
  // idioma e junta duas frases numa quando lhe convem -- e uma versao
  // desalinhada quebra justamente a comparacao lado a lado que o bloco existe
  // para fazer. O texto ainda entra num pool e e lido quatro vezes.
  'reading.generate',
  // A tabela de casos e o conteudo mais perigoso do produto: uma terminacao
  // errada fica guardada e o aluno a repete em TODA frase daquela funcao. E o
  // exercicio depende de um casamento exato entre o pedaco escondido e a forma
  // da tabela -- o modelo rapido erra esse casamento com frequencia, e o
  // exercicio sai sem resposta certa.
  'morphology.generate',
  // Ler o texto de uma foto exige modelo que enxergue, e os que enxergam sao os
  // fortes. Nao e escolha de qualidade -- o modelo rapido simplesmente nao tem
  // a capacidade.
  'capture.ocr',
  // Traduzir um conceito e curto, mas erra de um jeito que estraga: uma palavra
  // pouco natural em russo vira card e o aluno decora o que ninguem diz.
  'concept.translate',
  // A producao quadrupla so vale se o modelo enxergar as quatro tentativas de
  // cima e acusar a contaminacao entre elas -- exatamente o que o modelo rapido
  // nao faz. Sem isso o exercicio vira quatro correcoes isoladas.
  'production.evaluate',
]);

/** Uma imagem anexada a uma mensagem, em base64. */
export interface AiImage {
  /** Base64 puro, sem o prefixo `data:`. */
  data: string;
  mimeType: string;
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  /**
   * Imagens que acompanham esta mensagem.
   *
   * O gateway existe justamente para o resto do sistema nao saber como cada
   * provider formata as coisas, e imagem e o caso mais gritante disso: o
   * formato multimodal e um array de partes tipadas, nada parecido com o texto
   * puro. Quem chama continua mandando `content` como sempre e junta as imagens
   * aqui; a traducao para o formato do provider e problema do provider.
   *
   * So funciona com modelo que enxerga. O `strongModel` padrao dos dois
   * providers enxerga, mas um modelo configurado a mao pode nao enxergar -- e
   * ai o erro vem do provider, com a mensagem dele.
   */
  images?: AiImage[];
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
