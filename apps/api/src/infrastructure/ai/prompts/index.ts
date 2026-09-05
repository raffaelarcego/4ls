/**
 * Todos os prompts do sistema vivem aqui, versionados.
 * Nenhum prompt deve ser escrito inline nos services.
 */

export const PROMPT_VERSION = '1.0.0';

export interface LearnerContext {
  languageName: string;
  languageCode: string;
  level: string;
  recentErrors: string[];
  recentVocabulary: string[];
  topic?: string;
}

const LANGUAGE_LABEL: Record<string, string> = {
  en: 'ingles',
  es: 'espanhol',
  de: 'alemao',
};

function contextBlock(ctx: LearnerContext): string {
  const lines = [
    `IDIOMA: ${ctx.languageName} (${ctx.languageCode})`,
    `NIVEL CEFR DO ALUNO: ${ctx.level}`,
  ];
  if (ctx.topic) lines.push(`TOPICO ATUAL: ${ctx.topic}`);
  if (ctx.recentErrors.length) {
    lines.push(`ERROS RECORRENTES:\n${ctx.recentErrors.map((e) => `- ${e}`).join('\n')}`);
  }
  if (ctx.recentVocabulary.length) {
    lines.push(`VOCABULARIO EM APRENDIZADO: ${ctx.recentVocabulary.join(', ')}`);
  }
  return lines.join('\n');
}

/** Tutor conversacional por idioma. */
export function tutorSystemPrompt(ctx: LearnerContext): string {
  return `Voce e o tutor de ${LANGUAGE_LABEL[ctx.languageCode] ?? ctx.languageName} do Raffael 4L,
um sistema pessoal de aquisicao de idiomas. O aluno e brasileiro e fala portugues nativo.

${contextBlock(ctx)}

REGRAS
- Responda em ${ctx.languageName}, num registro compativel com o nivel ${ctx.level}.
- Se o aluno cometer um erro relevante, corrija-o antes de continuar a conversa.
- Explique a regra em portugues, de forma curta e concreta.
- Nao introduza vocabulario muito acima do nivel dele sem traduzir.
- Mantenha as respostas curtas (no maximo 6 linhas). Isto e uma conversa, nao uma aula.
- Termine sempre com uma pergunta, para o aluno continuar produzindo.`;
}

/** Extrai correcoes estruturadas de uma frase do aluno. */
export function correctionPrompt(ctx: LearnerContext, text: string): string {
  return `Analise a frase abaixo, escrita por um aluno de ${ctx.languageName} no nivel ${ctx.level}.

FRASE DO ALUNO:
"""${text}"""

Responda APENAS com JSON valido neste formato:
{
  "hasErrors": boolean,
  "corrected": "a frase corrigida, ou a original se ja estiver certa",
  "errors": [
    {
      "category": "VOCABULARY|GRAMMAR|PRONUNCIATION|WORD_ORDER|ARTICLE|TENSE|PREPOSITION|FALSE_COGNATE|SPELLING|COMPREHENSION",
      "description": "descricao curta do erro, em portugues",
      "explanation": "por que esta errado e qual a regra, em portugues",
      "severity": 1
    }
  ]
}

Regras: severity 1 = leve, 2 = relevante, 3 = grave/bloqueia comunicacao.
Ignore variacoes estilisticas aceitaveis. So reporte erros reais.`;
}

/** Gera um exercicio focado nas fraquezas do aluno. */
export function exercisePrompt(ctx: LearnerContext, type: string, count: number): string {
  return `Gere ${count} exercicios de ${type} em ${ctx.languageName} para um aluno nivel ${ctx.level}.

${contextBlock(ctx)}

Priorize os erros recorrentes listados acima -- o objetivo e atacar a fraqueza, nao revisar o que ele ja domina.

Responda APENAS com JSON valido:
{
  "exercises": [
    {
      "prompt": "o enunciado, em ${ctx.languageName}",
      "type": "multiple_choice|fill_blank|translate",
      "options": ["a", "b", "c", "d"],
      "answer": "a resposta correta",
      "explanation": "explicacao em portugues"
    }
  ]
}
Para type "fill_blank" e "translate", deixe "options" como lista vazia.`;
}

/** Avalia um texto do Writing Lab. */
export function writingPrompt(ctx: LearnerContext, mission: string, text: string): string {
  return `Avalie o texto de um aluno de ${ctx.languageName} nivel ${ctx.level}.

MISSAO DADA AO ALUNO: ${mission}

TEXTO DO ALUNO:
"""${text}"""

Responda APENAS com JSON valido:
{
  "scores": { "grammar": 0, "vocabulary": 0, "coherence": 0, "naturalness": 0 },
  "corrected": "versao corrigida do texto",
  "feedback": "2 a 4 frases de feedback em portugues",
  "topErrors": [
    { "category": "GRAMMAR", "description": "...", "explanation": "...", "severity": 2 }
  ]
}
Cada score vai de 0 a 100. Liste no maximo 3 erros em topErrors, do mais grave ao menos grave.`;
}

/** Planeja a sessao do dia a partir do estado do aluno. */
export function planPrompt(payload: unknown): string {
  return `Voce e o motor adaptativo do Raffael 4L. Monte a sessao de estudo de hoje.

ESTADO DO ALUNO:
${JSON.stringify(payload, null, 2)}

Regras:
- Respeite exatamente o total de minutos disponivel e os minutos por idioma.
- Cada bloco tem no minimo 3 e no maximo 10 minutos.
- Sempre comece cada idioma por revisao (pillar LEARN, type "review") se houver itens vencidos.
- Priorize as fraquezas: as subcompetencias com nota mais baixa e os erros recorrentes.
- Varie em relacao as atividades recentes -- a sessao de hoje nao deve ser igual a de ontem.

Responda APENAS com JSON valido:
{
  "rationale": "1 a 2 frases em portugues explicando as escolhas de hoje",
  "activities": [
    {
      "languageCode": "en|es|de",
      "pillar": "LISTEN|LEARN|LIVE|LEVEL_UP",
      "type": "review|vocabulary|grammar|listening|reading|speaking|writing|tutor",
      "plannedMinutes": 5,
      "reason": "por que esta atividade foi escolhida, em portugues"
    }
  ]
}`;
}

/**
 * Dialogo de listening.
 *
 * O texto gerado aqui vira audio no Speech Gateway, entao ele precisa ser
 * falavel: nada de parenteses de cena, notas ou marcacao -- so a fala. As
 * perguntas de compreensao vem junto para que o bloco tenha correcao objetiva
 * em vez da autoavaliacao que existia antes.
 */
export function listeningPrompt(ctx: LearnerContext, seconds: number): string {
  return `Crie um dialogo curto em ${ctx.languageName} para um aluno nivel ${ctx.level} treinar escuta.

${contextBlock(ctx)}

Regras:
- O dialogo inteiro deve levar cerca de ${seconds} segundos falado (aproximadamente ${Math.round(seconds * 2.2)} palavras).
- Entre 4 e 8 falas, alternando dois interlocutores.
- Linguagem natural e cotidiana, no nivel ${ctx.level}. Nada de vocabulario muito acima do nivel.
- Cada fala deve conter APENAS o que e dito em voz alta: sem rubricas, sem parenteses, sem emoji.
- Use o vocabulario em aprendizado quando couber naturalmente.
- As 3 perguntas devem testar compreensao do conteudo, nao memoria de palavra solta.

Responda APENAS com JSON valido:
{
  "title": "titulo curto em portugues",
  "context": "1 frase em portugues situando a cena, sem entregar as respostas",
  "lines": [
    { "speaker": "A", "text": "a fala em ${ctx.languageName}", "translation": "traducao em portugues" }
  ],
  "questions": [
    {
      "prompt": "a pergunta em ${ctx.languageName}",
      "options": ["a", "b", "c"],
      "answer": "a alternativa correta, identica a uma das options",
      "explanation": "explicacao em portugues"
    }
  ],
  "vocabulary": [
    { "term": "palavra util do dialogo", "meaning": "significado em portugues" }
  ]
}`;
}

/**
 * Frases para ditado. O aluno ouve e escreve, entao a frase precisa ser
 * inequivoca no audio: sem homofonos ambiguos e sem numeros por extenso que
 * possam ser escritos de duas formas.
 */
export function dictationPrompt(ctx: LearnerContext, count: number): string {
  return `Gere ${count} frases em ${ctx.languageName} para um exercicio de DITADO com um aluno nivel ${ctx.level}.

${contextBlock(ctx)}

Regras:
- Cada frase entre 4 e 12 palavras, natural e util no dia a dia.
- Evite frases que possam ser escritas de duas formas corretas ao ouvir (homofonos ambiguos, numerais).
- Priorize as estruturas dos erros recorrentes acima -- ouvir e escrever expoe justamente esses pontos.
- Sem pontuacao dificil de inferir pelo audio: use apenas ponto final ou interrogacao.

Responda APENAS com JSON valido:
{
  "sentences": [
    {
      "text": "a frase em ${ctx.languageName}",
      "translation": "traducao em portugues",
      "focus": "o que esta frase treina, em portugues, em ate 6 palavras"
    }
  ]
}`;
}

/** Missao de fala: o que o aluno deve dizer no Speaking Lab. */
export function speakingMissionPrompt(ctx: LearnerContext): string {
  return `Proponha uma missao curta de FALA para um aluno de ${ctx.languageName} nivel ${ctx.level}.

${contextBlock(ctx)}

A missao deve poder ser cumprida falando de 20 a 40 segundos, sem preparacao previa,
e deve provocar naturalmente as estruturas dos erros recorrentes listados acima.

Responda APENAS com JSON valido:
{
  "mission": "a missao, em portugues",
  "promptInTarget": "a mesma missao em ${ctx.languageName}",
  "hints": ["3 a 5 palavras ou expressoes uteis em ${ctx.languageName}"]
}`;
}

/**
 * Avalia a fala a partir da transcricao.
 *
 * A transcricao vem de um ASR, entao o prompt precisa dizer isso: hesitacao,
 * repeticao e pontuacao ausente sao artefato do reconhecimento, nao erro do
 * aluno, e penalizar isso daria uma nota falsa.
 */
export function speakingPrompt(ctx: LearnerContext, mission: string, transcript: string): string {
  return `Avalie a fala de um aluno de ${ctx.languageName} nivel ${ctx.level}.

${contextBlock(ctx)}

MISSAO DADA AO ALUNO: ${mission}

TRANSCRICAO AUTOMATICA DA FALA:
"""${transcript}"""

Importante: o texto acima veio de reconhecimento de fala. Ignore ausencia de pontuacao,
maiusculas, hesitacoes e repeticoes -- sao artefatos da transcricao, nao erros do aluno.
Avalie o que a transcricao revela sobre gramatica, vocabulario, fluencia e cumprimento da missao.
Nao avalie pronuncia a partir do texto: se algo sugerir problema de pronuncia, diga que e uma hipotese.

Responda APENAS com JSON valido:
{
  "scores": { "grammar": 0, "vocabulary": 0, "fluency": 0, "taskCompletion": 0 },
  "corrected": "como um nativo diria o mesmo conteudo",
  "feedback": "2 a 4 frases de feedback em portugues",
  "topErrors": [
    { "category": "GRAMMAR", "description": "...", "explanation": "...", "severity": 2 }
  ]
}
Cada score vai de 0 a 100. Liste no maximo 3 erros em topErrors, do mais grave ao menos grave.`;
}
