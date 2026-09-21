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
  /**
   * Os outros idiomas que o aluno estuda, com o nivel dele em cada um.
   *
   * Nao e enfeite de contexto: e o que permite ao modelo NOMEAR a origem de um
   * erro de interferencia. Sem esta lista, "Ich sehe der Mann" e so um erro de
   * caso; com ela, da para dizer que veio do portugues, que nao marca o objeto.
   */
  otherLanguages?: Array<{ code: string; name: string; level: string }>;
}

const LANGUAGE_LABEL: Record<string, string> = {
  en: 'ingles',
  es: 'espanhol',
  de: 'alemao',
  ru: 'russo',
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
  if (ctx.otherLanguages?.length) {
    lines.push(
      `OUTROS IDIOMAS QUE ELE ESTUDA AO MESMO TEMPO: ${ctx.otherLanguages
        .map((l) => `${l.name} (${l.code}, ${l.level})`)
        .join(', ')}`,
    );
  }
  return lines.join('\n');
}

/**
 * O bloco que ensina o modelo a acusar interferencia.
 *
 * Entra em todo prompt que extrai erro. A instrucao e deliberadamente
 * conservadora -- "so quando a interferencia for a explicacao mais provavel" --
 * porque um palpite de origem e pior que origem nenhuma: ele mandaria o aluno
 * estudar um contraste entre idiomas que nunca causou problema nenhum a ele.
 */
function interferenceBlock(ctx: LearnerContext): string {
  if (!ctx.otherLanguages?.length) return '';

  const codes = ctx.otherLanguages.map((l) => l.code).join('", "');

  return `
INTERFERENCIA ENTRE IDIOMAS
Este aluno estuda varios idiomas ao mesmo tempo, e boa parte dos erros dele nao vem
de ignorancia: vem de importar a regra de outra lingua que ele tambem estuda.
Para CADA erro, preencha "sourceLanguage" com o codigo do idioma de onde a
interferencia veio -- "pt" para a lingua materna, ou um de "${codes}".
Use null quando o erro nao for de interferencia (descuido, forma nunca ensinada,
lapso). Nao chute: so nomeie a origem quando a interferencia for de fato a
explicacao mais provavel, e diga em "explanation" qual construcao do outro idioma
produziu o erro.`;
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

${contextBlock(ctx)}
${interferenceBlock(ctx)}

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
      "sourceLanguage": null,
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

${contextBlock(ctx)}
${interferenceBlock(ctx)}

MISSAO DADA AO ALUNO: ${mission}

TEXTO DO ALUNO:
"""${text}"""

Responda APENAS com JSON valido:
{
  "scores": { "grammar": 0, "vocabulary": 0, "coherence": 0, "naturalness": 0 },
  "corrected": "versao corrigida do texto",
  "feedback": "2 a 4 frases de feedback em portugues",
  "topErrors": [
    { "category": "GRAMMAR", "description": "...", "explanation": "...", "sourceLanguage": null, "severity": 2 }
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
- OBRIGATORIO: todo idioma recebe um bloco "structure" (formacao de frase) e um bloco
  "vocabulary" hoje. Sao os dois blocos que sustentam a promessa do produto -- o mesmo
  conceito aprendido nos quatro idiomas, e a regra de montagem da frase de cada um.
  Um plano sem esses dois blocos em algum idioma sera descartado.
- Se o idioma vier com "needsAlphabet": true, troque o bloco "structure" dele por um bloco
  "alphabet" (pillar LEARN). O aluno ainda nao le os caracteres daquele idioma, e uma aula
  de formacao de frase que ele nao consegue ler nao ensina nada. Nesse caso e o bloco
  "alphabet" que e obrigatorio, e o plano sem ele sera descartado.
- OBRIGATORIO tambem, quando houver dois ou mais idiomas e o dia comportar: a sessao ABRE
  com um bloco "contrast" (pillar LEARN, 5 minutos) e FECHA com um bloco "compare" (pillar
  LIVE, 4 minutos). Os dois atravessam os idiomas -- sao a mesma frase nos quatro -- e
  aparecem UMA vez cada na sessao inteira, nunca um por idioma. Ponha no "languageCode"
  deles o idioma prioritario, so porque todo bloco precisa de um dono.
  A ordem nao e detalhe: o contraste guiado vem antes porque intercalar os idiomas sem
  apoio no comeco atrapalha, e a comparacao de memoria vem no fim, quando ja ha o que
  comparar. Um plano que remova esses dois blocos sera descartado.
- Priorize as fraquezas: as subcompetencias com nota mais baixa e os erros recorrentes.
- Varie em relacao as atividades recentes -- a sessao de hoje nao deve ser igual a de ontem.

Responda APENAS com JSON valido:
{
  "rationale": "1 a 2 frases em portugues explicando as escolhas de hoje",
  "activities": [
    {
      "languageCode": "en|es|de|ru",
      "pillar": "LISTEN|LEARN|LIVE|LEVEL_UP",
      "type": "contrast|review|alphabet|structure|vocabulary|grammar|listening|reading|speaking|writing|tutor|compare",
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

${interferenceBlock(ctx)}

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
    { "category": "GRAMMAR", "description": "...", "explanation": "...", "sourceLanguage": null, "severity": 2 }
  ]
}
Cada score vai de 0 a 100. Liste no maximo 3 erros em topErrors, do mais grave ao menos grave.`;
}

// ---------------------------------------------------------------------------
// Gramatica contrastiva
// ---------------------------------------------------------------------------

/**
 * Contexto de um contraste, montado a partir do catalogo curado.
 * O service preenche isto; a IA nunca decide quem se parece com quem.
 */
export interface ContrastContext {
  title: string;
  question: string;
  level: string;
  /** Idioma sendo aprendido. */
  targetName: string;
  /** Idioma que se comporta como o alvo (pode nao existir). */
  allyName: string | null;
  /** Idioma que se comporta de forma diferente. */
  contrastName: string;
  /** Como cada idioma resolve o conceito, ja escrito no catalogo. */
  behavior: string;
  /** Frases paralelas do catalogo, para a IA nao fugir do padrao. */
  examples: string;
}

/**
 * Exercicios de contraste.
 *
 * Duas decisoes deliberadas neste prompt:
 *
 * 1. O catalogo entra como VERDADE, nao como sugestao. O modelo recebe o mapa
 *    pronto e e proibido de contradiz-lo. Gramatica errada e o unico erro
 *    deste modulo que o aluno leva para a vida.
 *
 * 2. Todo exercicio e ancorado em frase paralela. Nao pedimos "faca um
 *    exercicio de artigos"; pedimos a mesma frase nos idiomas envolvidos, com
 *    uma lacuna. E o formato que obriga a comparacao a acontecer na cabeca do
 *    aluno em vez de ficar so na explicacao.
 */
export function contrastDrillPrompt(ctx: ContrastContext, count: number): string {
  const support = ctx.allyName
    ? `O ${ctx.allyName} se comporta como o ${ctx.targetName} neste ponto: use-o para CONFIRMAR a intuicao do aluno.
O ${ctx.contrastName} se comporta de forma diferente: use-o para marcar o CONTRASTE.`
    : `Neste topico nenhum outro idioma se comporta como o ${ctx.targetName}.
Use o ${ctx.contrastName} para marcar o contraste e deixe claro que o ${ctx.targetName} esta sozinho.`;

  return `Voce escreve exercicios de gramatica contrastiva para um brasileiro que estuda
ingles, espanhol, alemao e russo AO MESMO TEMPO. Ele fala portugues nativo.

O objetivo do exercicio nao e testar uma regra isolada: e fazer o aluno PERCEBER a diferenca
entre os idiomas, comparando a mesma frase lado a lado.

TOPICO: ${ctx.title}
DUVIDA DO ALUNO: ${ctx.question}
IDIOMA ALVO: ${ctx.targetName}
NIVEL: ${ctx.level}

COMO CADA IDIOMA RESOLVE ISTO (fato estabelecido, NAO contradiga):
${ctx.behavior}

${support}

EXEMPLOS JA EXISTENTES (nao repita nenhum destes, crie frases novas):
${ctx.examples}

Gere ${count} exercicios, alternando os dois tipos abaixo.

TIPO "mirror": a mesma frase em varios idiomas, com UMA lacuna no idioma alvo,
marcada por ___ (tres sublinhados). O aluno ve as outras versoes e deduz a do alvo.

  REGRA CRITICA da lacuna: ela tem de cair EXATAMENTE na estrutura que este topico
  ensina. Se o topico e sobre prefixo separavel, a lacuna cai no prefixo ou no verbo
  separado -- nunca num pronome, num artigo ou num substantivo qualquer da frase.
  Uma lacuna fora do ponto transforma o exercicio em outro assunto e nao ensina nada.

  O campo "shown" precisa trazer pelo menos o idioma de apoio citado acima, porque e
  comparando com ele que o aluno deduz a resposta. Nunca mostre o idioma alvo em "shown".

TIPO "trap": uma frase ERRADA no idioma alvo, do tipo que um brasileiro que tambem
estuda os outros tres idiomas realmente escreveria por interferencia. O aluno corrige.

  REGRA CRITICA do trap: "sentence" tem de estar mesmo ERRADA e ser DIFERENTE de
  "answer". Se voce nao consegue pensar num erro plausivel, escreva um exercicio
  "mirror" no lugar -- nunca entregue um trap cuja frase ja esta correta, e nunca
  marque como errada uma frase que um nativo diria sem estranhar.
  O erro vem do contraste entre idiomas, nunca de digitacao ou de acento.

Regras:
- Frases curtas, cotidianas, no nivel ${ctx.level}.
- Nunca explique a regra dentro do enunciado: a explicacao vem depois da resposta.
- So cite na explicacao idiomas que aparecem neste exercicio ou no mapa acima.
- Toda frase que voce apresentar como correta tem de ser natural para um nativo.
- A explicacao sempre em portugues, em no maximo 2 frases, citando o outro idioma.
- Em "mirror", "answer" e SO o que preenche a lacuna, nao a frase inteira.
- Em "trap", "answer" e a frase inteira corrigida.

Responda APENAS com JSON valido:
{
  "drills": [
    {
      "type": "mirror",
      "gloss": "o que a frase quer dizer, em portugues",
      "shown": [
        { "lang": "pt", "text": "a frase em portugues" },
        { "lang": "es", "text": "a frase no idioma de apoio" }
      ],
      "sentence": "a frase no idioma alvo com ___ na lacuna",
      "answer": "so o trecho que preenche a lacuna",
      "explanation": "por que e assim, comparando com os outros idiomas"
    },
    {
      "type": "trap",
      "gloss": "o que a frase quer dizer, em portugues",
      "shown": [],
      "sentence": "a frase ERRADA no idioma alvo",
      "answer": "a frase inteira corrigida",
      "explanation": "de qual idioma veio a interferencia e qual e a regra do alvo"
    }
  ]
}
Use apenas os codigos "pt", "en", "es", "de", "ru" no campo "lang".`;
}

// ---------------------------------------------------------------------------
// Conceitos atravessando os idiomas
// ---------------------------------------------------------------------------

export interface ConceptContext {
  /** Como o conceito se le em portugues, ex.: "o trabalho". */
  gloss: string;
  /** O que ja se sabe sobre o conceito, em portugues. */
  note?: string | null;
  /** Realizacoes que ja existem, para o modelo nao contradizer o que ha. */
  known: Array<{ languageCode: string; term: string; example: string | null }>;
}

/**
 * Um idioma que falta, COM o nivel do aluno naquele idioma.
 *
 * O nivel e por idioma, e nao por conceito, de proposito. Quem e B2 em ingles e
 * A1 em russo nao pode receber a frase russa no registro do exemplo ingles:
 * seria conteudo correto e inutil. O conceito e o mesmo; a frase que o carrega
 * tem de caber em quem vai le-la.
 */
export interface ConceptTarget {
  code: string;
  name: string;
  level: string;
}

/**
 * Completa um conceito nos idiomas que faltam.
 *
 * Este prompt e o que sustenta a regra central do produto: o aluno nunca
 * aprende uma palavra em um idioma so. Quando um termo novo entra por qualquer
 * porta -- vocabulario do listening, palavra salva a mao, sugestao do tutor --,
 * e aqui que ele ganha as irmas nos outros idiomas antes de virar card.
 *
 * As realizacoes ja existentes entram como CONTEXTO, nao como pedido de
 * traducao literal: o que tem de bater e o SENTIDO. "sich lohnen" e a resposta
 * certa para "valer a pena" justamente por nao ser palavra a palavra.
 */
export function conceptTranslationPrompt(ctx: ConceptContext, targets: ConceptTarget[]): string {
  const known = ctx.known.length
    ? ctx.known
        .map(
          (k) =>
            `- ${LANGUAGE_LABEL[k.languageCode] ?? k.languageCode}: ${k.term}${
              k.example ? ` ("${k.example}")` : ''
            }`,
        )
        .join('\n')
    : '(nenhuma ainda)';

  const wanted = targets
    .map((t) => `${t.code} (${LANGUAGE_LABEL[t.code] ?? t.name}, nivel ${t.level})`)
    .join(', ');

  return `Voce monta o vocabulario de um brasileiro que estuda ingles, espanhol, alemao e russo
AO MESMO TEMPO. Ele fala portugues nativo.

A unidade de estudo dele nao e a palavra, e o CONCEITO: o mesmo significado entra nos quatro
idiomas no mesmo dia, para que a memoria de um sustente a dos outros.

CONCEITO (em portugues): ${ctx.gloss}
${ctx.note ? `OBSERVACAO: ${ctx.note}\n` : ''}
COMO O CONCEITO JA FOI REALIZADO:
${known}

Escreva a realizacao deste MESMO conceito em: ${wanted}.

O NIVEL E POR IDIOMA, e vai declarado acima em cada um. Este aluno esta em pontos
diferentes de cada lingua: a frase de exemplo tem de caber no nivel DAQUELE idioma, e
nao no nivel do conceito. A frase russa de A1 e curta e direta mesmo quando o exemplo
ingles do mesmo conceito e sofisticado -- o conceito e o mesmo, o registro nao.

Regras:
- Traduza o SENTIDO, nao as palavras. Se o idioma resolve o conceito com outra construcao
  (reflexivo, verbo diferente, caso diferente), use a construcao natural do idioma.
- Se um idioma nao tiver equivalente de uma palavra so, use a expressao curta que um nativo
  usaria de verdade. Nunca invente palavra nem traduza literalmente ao custo da naturalidade.
- "term" e a forma de dicionario: substantivo com artigo quando o idioma tem artigo, verbo no
  infinitivo. Em russo escreva em cirilico e ponha a transliteracao no "meaning".
- "meaning" e em portugues, e deve avisar quando a construcao muda (caso exigido, reflexivo,
  preposicao obrigatoria, falso cognato).
- "example" e uma frase curta e cotidiana no nivel DECLARADO daquele idioma, usando o termo.
- "translation" e a traducao do exemplo para o portugues.
- As frases de exemplo dos varios idiomas devem dizer A MESMA COISA: e comparando-as lado a
  lado que o aluno percebe a diferenca de estrutura entre as linguas.

Responda APENAS com JSON valido:
{
  "entries": [
    {
      "languageCode": "${targets[0]?.code ?? 'en'}",
      "term": "a forma de dicionario",
      "meaning": "o significado em portugues, com o aviso de construcao se houver",
      "example": "a frase de exemplo no idioma",
      "translation": "a traducao da frase para o portugues"
    }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Formacao de frase
// ---------------------------------------------------------------------------

export interface SentencePatternContext {
  languageName: string;
  languageCode: string;
  level: string;
  /** Padrao pedido, vindo do catalogo do codigo -- a IA nao escolhe o assunto. */
  patternTitle: string;
  patternQuestion: string;
  /** O que o padrao ensina, ja escrito por nos. A IA nao contradiz. */
  patternBehavior: string;
  /** Como os outros idiomas do aluno resolvem o mesmo ponto. */
  contrast: string;
  /** Termos que o aluno esta aprendendo hoje, para as frases nao serem avulsas. */
  terms: string[];
  recentErrors: string[];
}

/**
 * Aula de formacao de frase.
 *
 * Saber o que "Arbeit" significa nao ensina a dizer "amanha de manha eu vou
 * para o trabalho de onibus": cada idioma monta a frase com uma ordem, uma
 * marcacao e umas obrigacoes proprias. Este prompt produz a aula que faltava --
 * formula, passos, exemplos DESMONTADOS peca a peca e exercicios de montagem.
 *
 * Duas decisoes deliberadas:
 *
 * 1. O padrao vem do catalogo do codigo, nao do modelo. Assunto e regra sao
 *    nossos; a IA escreve as frases em cima deles. Gramatica errada e o unico
 *    erro deste modulo que o aluno leva para a vida.
 *
 * 2. Todo exemplo vem fatiado em constituintes rotulados. E a fatia que ensina:
 *    ver "Heute | gehe | ich | ins Kino" com o rotulo de cada peca ensina a
 *    regra de posicao muito melhor do que le-la enunciada.
 */
export function sentencePatternPrompt(ctx: SentencePatternContext, drills: number): string {
  return `Voce escreve a aula de FORMACAO DE FRASE em ${ctx.languageName} para um brasileiro
que estuda ingles, espanhol, alemao e russo ao mesmo tempo. Ele fala portugues nativo e esta
no nivel ${ctx.level}.

O aluno ja aprende o significado das palavras em outro bloco. O que falta -- e o que esta aula
resolve -- e COMO MONTAR A FRASE neste idioma: ordem das pecas, o que e obrigatorio, o que muda
de forma e onde o portugues o trai.

PADRAO A ENSINAR: ${ctx.patternTitle}
DUVIDA DO ALUNO: ${ctx.patternQuestion}

COMO ESTE IDIOMA RESOLVE ISTO (fato estabelecido, NAO contradiga):
${ctx.patternBehavior}

COMO OS OUTROS IDIOMAS DELE RESOLVEM O MESMO PONTO:
${ctx.contrast}
${
    ctx.terms.length
      ? `\nPALAVRAS QUE ELE ESTA APRENDENDO HOJE (use nas frases quando couber naturalmente):\n${ctx.terms.join(', ')}`
      : ''
  }${
    ctx.recentErrors.length
      ? `\nERROS RECORRENTES DELE:\n${ctx.recentErrors.map((e) => `- ${e}`).join('\n')}`
      : ''
  }

Regras:
- Tudo que explica vai em portugues. So as frases de exemplo ficam em ${ctx.languageName}.
- "formula" e a regra em uma linha, com as pecas na ordem, ex.: "Sujeito + verbo (2a posicao) + resto".
- "steps": 3 a 5 passos de montagem, na ordem em que o aluno deve pensar. Cada passo em uma linha.
- "examples": 3 frases curtas e cotidianas no nivel ${ctx.level}. Cada uma vem DESMONTADA em
  "parts": cada parte com o texto exato e o rotulo da funcao ("sujeito", "verbo conjugado",
  "complemento no acusativo", "particula separavel"...). Juntar as parts na ordem, separadas por
  espaco, tem de devolver a frase inteira.
- "pitfalls": 2 a 3 erros que um brasileiro comete NESTE padrao, com a versao errada, a certa e o porque.
- "drills": ${drills} exercicios de montagem. Em cada um, "scrambled" traz as pecas da frase
  fora de ordem e "answer" e a frase correta montada. As pecas de "scrambled" tem de ser
  exatamente as mesmas de "answer", so que embaralhadas -- nem uma peca a mais nem a menos.
- Nenhuma frase pode repetir outra da mesma aula.

Responda APENAS com JSON valido:
{
  "title": "titulo curto da aula, em portugues",
  "formula": "a regra em uma linha",
  "explanation": "2 a 4 frases em portugues explicando a logica do padrao",
  "steps": ["passo 1", "passo 2", "passo 3"],
  "examples": [
    {
      "sentence": "a frase completa em ${ctx.languageName}",
      "translation": "a traducao em portugues",
      "parts": [{ "text": "peca da frase", "role": "funcao da peca, em portugues" }],
      "note": "o que esta frase mostra do padrao, em uma linha"
    }
  ],
  "pitfalls": [
    { "wrong": "a frase errada", "right": "a frase certa", "why": "a explicacao em portugues" }
  ],
  "drills": [
    {
      "gloss": "o que a frase quer dizer, em portugues",
      "scrambled": ["pecas", "fora", "de", "ordem"],
      "answer": "a frase correta montada",
      "explanation": "por que esta e a ordem, em portugues"
    }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Producao quadrupla
// ---------------------------------------------------------------------------

export interface ProductionAttempt {
  languageCode: string;
  languageName: string;
  level: string;
  /** O que o aluno escreveu. Vazio quando ele pulou o idioma. */
  sentence: string;
  /** A forma que ele deveria usar, vinda do conceito. */
  term: string;
}

/**
 * Avalia a MESMA frase escrita nos quatro idiomas.
 *
 * Este e o exame da tese do produto. Todo o resto e reconhecimento -- escolher
 * alternativa, ordenar pecas dadas --, e reconhecimento esconde exatamente o
 * que falha na hora de falar: puxar a forma da memoria sem nenhuma pista na
 * tela.
 *
 * Avaliar as quatro JUNTAS, numa chamada so, nao e economia de token. E o que
 * permite ao modelo ver o que nenhuma avaliacao isolada veria: que a frase
 * alema saiu com a ordem russa, que a espanhola copiou a estrutura inglesa. O
 * erro mais caro de quem estuda quatro idiomas so e visivel de cima.
 */
export function quadrupleProductionPrompt(
  gloss: string,
  attempts: ProductionAttempt[],
): string {
  const written = attempts
    .map(
      (a) =>
        `--- ${a.languageName} (${a.languageCode}, nivel ${a.level}), usando "${a.term}":\n${
          a.sentence.trim() || '(nao escreveu nada)'
        }`,
    )
    .join('\n');

  const codes = attempts.map((a) => a.languageCode).join('", "');

  return `Voce avalia um brasileiro que estuda ingles, espanhol, alemao e russo AO MESMO TEMPO.
Ele fala portugues nativo.

O exercicio: dizer A MESMA COISA nos quatro idiomas, sem nenhuma alternativa na tela.

O QUE ELE DEVIA DIZER (em portugues): ${gloss}

O QUE ELE ESCREVEU:
${written}

Avalie cada idioma separadamente, mas OLHE O CONJUNTO antes de julgar cada um. O erro
mais revelador deste aluno nao aparece numa frase isolada: e a frase alema saindo com a
ordem do russo, a espanhola copiando a estrutura do ingles, o artigo aparecendo onde o
russo nao tem artigo. Quando voce vir uma frase contaminada por OUTRO idioma desta mesma
lista, diga qual em "sourceLanguage".

Regras:
- Julgue cada frase no NIVEL declarado daquele idioma. Uma frase simples num idioma A1
  esta certa se estiver correta e natural; nao cobre sofisticacao que o nivel nao pede.
- "ok" e true quando a frase esta correta e natural, mesmo que simples.
- Idioma em que ele nao escreveu nada: "ok" false, "corrected" com a frase que ele
  deveria ter escrito, e nenhum erro em "errors" (nao errou, deixou em branco).
- "corrected" e sempre como um nativo diria, no nivel dele.
- Em "errors", categoria e um destes: VOCABULARY, GRAMMAR, WORD_ORDER, ARTICLE, TENSE,
  PREPOSITION, FALSE_COGNATE, SPELLING.
- "sourceLanguage": "pt" ou um de "${codes}" quando o erro veio de interferencia; null
  quando nao veio. Nao chute.
- No maximo 2 erros por idioma, do mais grave ao menos.
- "insight" e a leitura do CONJUNTO, em 1 ou 2 frases em portugues: o que a comparacao
  entre as quatro tentativas revela. Se nao revelar nada, diga o que ele ja domina.

Responda APENAS com JSON valido:
{
  "results": [
    {
      "languageCode": "${attempts[0]?.languageCode ?? 'en'}",
      "ok": true,
      "score": 0,
      "corrected": "como um nativo diria",
      "feedback": "1 ou 2 frases em portugues",
      "errors": [
        {
          "category": "WORD_ORDER",
          "description": "descricao curta em portugues",
          "explanation": "a regra, e de qual idioma veio a interferencia",
          "sourceLanguage": null,
          "severity": 2
        }
      ]
    }
  ],
  "insight": "o que a comparacao entre os quatro revela, em portugues"
}
Cada "score" vai de 0 a 100.`;
}

// ---------------------------------------------------------------------------
// Can-do: a mesma funcao comunicativa nos quatro idiomas
// ---------------------------------------------------------------------------

/** Um idioma da aula, com o nivel do aluno NAQUELE idioma e o que ele exige aqui. */
export interface CanDoLessonTarget {
  code: string;
  name: string;
  level: string;
  /** O que este idioma exige nesta funcao e o portugues nao exige. */
  note: string;
  /** O erro que um falante de portugues comete neste ponto, se houver. */
  trap?: string;
}

export interface CanDoLessonContext {
  /** A funcao, em portugues, do ponto de vista de quem quer falar. */
  question: string;
  goal: string;
  /** As colunas da tabela de montagem. Sao as MESMAS nos quatro idiomas. */
  columns: string[];
  targets: CanDoLessonTarget[];
}

/**
 * A aula de can-do: a MESMA frase realizada nos quatro idiomas.
 *
 * Este prompt existe porque o bloco de estrutura falhava na promessa central do
 * produto. Ele pedia a aula de UM idioma por vez, e o assunto vinha do catalogo
 * daquele idioma -- entao no mesmo dia o aluno recebia a segunda posicao do
 * verbo alemao, o "gustar" espanhol e mais duas regras sem nenhuma relacao. Nao
 * havia nada para comparar, que e exatamente o que ele pediu.
 *
 * Aqui a unidade e a funcao comunicativa, e as quatro realizacoes saem numa
 * chamada so. Isso nao e economia de token: e a unica forma de garantir que as
 * quatro frases digam A MESMA COISA. Quatro chamadas independentes devolveriam
 * quatro frases boas sobre quatro assuntos parecidos, e a comparacao morreria.
 *
 * As pecas vem rotuladas pelas COLUNAS da can-do, iguais nos quatro idiomas: e
 * ver a mesma coluna preenchida em posicoes diferentes que ensina a regra de
 * ordem sem precisar enuncia-la. Coluna sem contraparte no idioma fica de fora
 * -- celula vazia e honesta; inventar peca para preencher a tabela e mentira.
 */
export function canDoLessonPrompt(ctx: CanDoLessonContext, sentences: number): string {
  const languages = ctx.targets
    .map(
      (t) =>
        `--- ${LANGUAGE_LABEL[t.code] ?? t.name} (${t.code}), nivel do aluno: ${t.level}\n` +
        `    O que este idioma exige aqui: ${t.note}` +
        (t.trap ? `\n    Armadilha para o brasileiro: ${t.trap}` : ''),
    )
    .join('\n');

  const codes = ctx.targets.map((t) => t.code).join('", "');

  return `Voce escreve a aula de um brasileiro que estuda ingles, espanhol, alemao e russo AO
MESMO TEMPO. Ele fala portugues nativo.

A exigencia central dele: no mesmo dia, aprender A MESMA COISA nos quatro idiomas, para
saber exatamente como fazer aquilo em cada um. A unidade da aula nao e uma regra de
gramatica de um idioma -- e uma FUNCAO comunicativa, dita em portugues.

FUNCAO DE HOJE: ${ctx.question}
O QUE ELE SAI SABENDO FAZER: ${ctx.goal}

COLUNAS DA TABELA DE MONTAGEM (as mesmas nos quatro idiomas): ${ctx.columns.join(' | ')}

OS QUATRO IDIOMAS (fatos estabelecidos, NAO contradiga):
${languages}

Escreva ${sentences} frases-modelo. Cada frase e UMA ideia, realizada nos ${ctx.targets.length} idiomas.

A REGRA QUE MANDA EM TODAS AS OUTRAS: as realizacoes de uma mesma frase tem de dizer
EXATAMENTE A MESMA COISA nos ${ctx.targets.length} idiomas. Mesma pessoa, mesma coisa, mesmo lugar, mesmo
tempo verbal, mesmo registro. Se as frases falarem de coisas diferentes, a aula inteira
perde o sentido: o aluno so aprende a diferenca entre as linguas comparando lado a lado
a MESMA mensagem. Antes de escrever, decida a ideia em portugues ("gloss") e so depois
realize-a em cada idioma.

Regras:
- Traduza o SENTIDO, nunca palavra por palavra. Se um idioma resolve a funcao com outra
  construcao (sem verbo, com caso, com a frase invertida), use a construcao que um nativo
  usaria de verdade -- e justamente essa diferenca que a aula mostra.
- O NIVEL E POR IDIOMA, declarado acima. A frase russa de A1 e curta mesmo quando a
  inglesa do mesmo sentido poderia ser mais sofisticada. O sentido e o mesmo; o registro,
  nao. Nunca simplifique o SENTIDO para caber no nivel: escolha uma ideia que caiba nos
  quatro.
- Cada realizacao vem DESMONTADA em "parts": cada peca com o texto exato e a COLUNA a que
  ela pertence, escolhida entre ${ctx.columns.map((c) => `"${c}"`).join(', ')}. Juntar as parts na
  ordem, separadas por espaco, tem de devolver a frase inteira, sem sobrar nem faltar nada.
- A ORDEM das parts e a ordem real daquele idioma. E o unico jeito de a tabela ensinar:
  a mesma coluna aparece em posicoes diferentes, e o aluno ve a regra em vez de le-la.
- Se uma coluna nao tiver contraparte no idioma (o russo sem verbo "ser", por exemplo),
  simplesmente nao gere a peca daquela coluna. Nunca invente palavra para preencher.
- Em russo escreva em cirilico e ponha a transliteracao em "romanization".
- "note" e uma linha em portugues sobre o que ESTA frase mostra naquele idioma.
- "contrast" e um paragrafo curto em portugues (3 a 5 frases) comparando os ${ctx.targets.length} idiomas
  nesta funcao: o que muda de ordem, o que um exige e outro nao, e onde o espanhol trai o
  brasileiro por ser parecido demais. Fale das quatro linguas, nao de uma.
- Nenhuma frase pode repetir a ideia de outra.

Responda APENAS com JSON valido, sem nenhum texto fora dele:
{
  "sentences": [
    {
      "gloss": "a ideia da frase, em portugues",
      "realizations": [
        {
          "languageCode": "${ctx.targets[0]?.code ?? 'en'}",
          "sentence": "a frase completa neste idioma",
          "romanization": "so em russo; null nos outros",
          "parts": [{ "text": "peca da frase", "column": "${ctx.columns[0] ?? 'QUEM'}" }],
          "note": "o que esta frase mostra neste idioma, em uma linha"
        }
      ]
    }
  ],
  "contrast": "o paragrafo em portugues comparando os ${ctx.targets.length} idiomas"
}
Cada frase precisa das ${ctx.targets.length} realizacoes: "${codes}". Nenhuma pode faltar.`;
}

// ---------------------------------------------------------------------------
// Leitura paralela
// ---------------------------------------------------------------------------

export interface ReadingPassageTarget {
  code: string;
  name: string;
  /** O nivel DESTE idioma. O texto e o mesmo; o tamanho da frase, nao. */
  level: string;
}

export interface ReadingPassageContext {
  /** O titulo em portugues. */
  title: string;
  /** O que acontece no texto, em portugues, com comeco meio e fim. */
  premise: string;
  /** O ponto em que os quatro idiomas se separam neste texto. */
  focus: string;
  /** historia | noticia | relato. Muda o registro. */
  genre: string;
  targets: ReadingPassageTarget[];
}

/**
 * A MESMA historia, escrita nos quatro idiomas, alinhada frase a frase.
 *
 * Duas exigencias mandam neste prompt, e as duas sao estruturais -- nao sao
 * preferencia de estilo:
 *
 * 1. MESMO NUMERO DE FRASES, MESMA ORDEM. A frase 3 do alemao diz o que diz a
 *    frase 3 do ingles. E o que deixa a tela oferecer "como fica esta frase nos
 *    outros tres?" em qualquer ponto do texto. Um idioma que junta duas frases
 *    numa so quebra o alinhamento e a comparacao morre em silencio -- pior, ela
 *    passa a mostrar frases que nao se correspondem, o que ensina errado.
 *
 * 2. O NIVEL E POR IDIOMA, A HISTORIA NAO. O ingles B2 recebe periodo composto
 *    e o russo A1 recebe frase curta, contando o mesmo acontecimento. Simplificar
 *    a HISTORIA para caber no idioma mais fraco desperdicaria a leitura nos
 *    outros tres; simplificar so a FRASE e o que o nivel pede de verdade.
 *
 * As perguntas sao por idioma e de detalhe, de proposito. O aluno chega a
 * terceira e a quarta leitura ja sabendo a historia -- e justamente esse o
 * andaime --, entao pergunta de ideia geral ele acerta de memoria, sem ler.
 * Perguntar o detalhe obriga a passar o olho no texto daquele idioma, que e o
 * que o bloco mede.
 */
export function readingPassagePrompt(
  ctx: ReadingPassageContext,
  sentences: number,
  questions: number,
): string {
  const languages = ctx.targets
    .map((t) => `--- ${LANGUAGE_LABEL[t.code] ?? t.name} (${t.code}), nivel do aluno: ${t.level}`)
    .join('\n');

  const codes = ctx.targets.map((t) => t.code).join('", "');

  return `Voce escreve o texto de leitura de um brasileiro que estuda ingles, espanhol, alemao e
russo AO MESMO TEMPO. Ele fala portugues nativo.

A exigencia central dele: ler A MESMA historia nos quatro idiomas, para ver como cada um
conta a mesma coisa. Ele le primeiro no idioma mais forte e depois nos outros -- e por ja
saber o que esta escrito que ele consegue ler acima do proprio nivel sem travar.

TEXTO DE HOJE: ${ctx.title}
FORMA: ${ctx.genre}
O QUE ACONTECE (a historia, em portugues -- siga-a, nao invente outra):
${ctx.premise}

O QUE ESTE TEXTO MOSTRA: ${ctx.focus}

OS IDIOMAS (cada um com o nivel do aluno naquele idioma):
${languages}

A REGRA QUE MANDA EM TODAS AS OUTRAS: cada versao tem EXATAMENTE ${sentences} frases, e a
frase de numero N diz A MESMA COISA nas ${ctx.targets.length} versoes. Mesmo acontecimento, mesma ordem,
mesmos nomes proprios. Nunca junte duas frases numa nem quebre uma em duas para o idioma
ficar mais natural: escolha desde o inicio ${sentences} acontecimentos que caibam, cada um, numa
frase em qualquer um dos ${ctx.targets.length} idiomas. O alinhamento e o que a tela usa para mostrar a
mesma frase lado a lado -- sem ele, ela compara frases que nao se correspondem.

Regras:
- O NIVEL E POR IDIOMA, declarado acima. A mesma frase sai curta e direta no idioma de
  nivel A1 e pode sair com oracao subordinada no de nivel B2. O que muda e a frase, NUNCA
  a historia: os fatos, a ordem e os detalhes sao identicos nas ${ctx.targets.length} versoes.
- Escreva como se escreve de verdade naquele idioma. Nao traduza palavra por palavra a
  partir do portugues: se o idioma resolve aquilo com outra construcao, use a dele.
- Nada de vocabulario muito acima do nivel daquele idioma. Uma palavra dificil por frase,
  no maximo, e so quando a historia precisar dela.
- Em russo escreva em cirilico e ponha a transliteracao em "romanization". Nos outros
  idiomas "romanization" e null.
- "translation" e a traducao daquela frase em portugues, usada quando ele travar. Traduza
  o sentido, nao a forma.
- "glossary": de 4 a 6 palavras DAQUELA versao que um brasileiro no nivel dele provavelmente
  nao conhece, com o significado em portugues no contexto do texto. Palavras que estao no
  texto, nunca sinonimos que nao aparecem.
- "questions": ${questions} perguntas por idioma, escritas NAQUELE idioma, sobre DETALHES do texto
  (quem fez o que, onde, quando, com quem, em que ordem). Nada de "qual e a ideia principal"
  -- ele ja sabe a historia e acertaria sem ler. Cada pergunta com 3 alternativas, sendo
  "answer" identica a uma das "options". A explicacao vai em portugues e diz em que frase
  do texto a resposta esta.
- "contrast" e um paragrafo curto em portugues (3 a 5 frases) sobre ${ctx.focus} nas
  ${ctx.targets.length} linguas deste texto, citando frases dele. Fale das quatro, nao de uma.

Responda APENAS com JSON valido, sem nenhum texto fora dele:
{
  "versions": [
    {
      "languageCode": "${ctx.targets[0]?.code ?? 'en'}",
      "title": "o titulo neste idioma",
      "sentences": [
        {
          "text": "a frase neste idioma",
          "romanization": "so em russo; null nos outros",
          "translation": "a mesma frase em portugues"
        }
      ],
      "glossary": [{ "term": "palavra do texto", "meaning": "significado em portugues" }],
      "questions": [
        {
          "prompt": "a pergunta neste idioma",
          "options": ["a", "b", "c"],
          "answer": "a alternativa correta, identica a uma das options",
          "explanation": "em portugues, dizendo em que frase esta a resposta"
        }
      ]
    }
  ],
  "contrast": "o paragrafo em portugues comparando os ${ctx.targets.length} idiomas"
}
Cada versao precisa das ${sentences} frases, e todas as ${ctx.targets.length} versoes precisam existir: "${codes}".`;
}

// ---------------------------------------------------------------------------
// Captura de texto
// ---------------------------------------------------------------------------

/**
 * Extrai de um texto real os termos que valem virar conceito.
 *
 * O filtro e a parte que importa, nao a extracao. Um texto qualquer tem
 * centenas de palavras e quase nenhuma vale um card: as que o aluno ja sabe
 * sao ruido, as muito acima do nivel dele nao vao firmar, e nome proprio nao e
 * vocabulario. Pedir "as palavras dificeis" produziria uma lista de termos
 * raros que ele nunca mais veria.
 *
 * O que se pede e outra coisa: alta frequencia real, dentro do alcance dele, e
 * que a falta atrapalhe a leitura do proprio texto.
 */
export function extractTermsPrompt(ctx: LearnerContext, text: string, count: number): string {
  return `Um brasileiro que estuda ${ctx.languageName} no nivel ${ctx.level} colou o texto abaixo
porque quer aprender o vocabulario dele. Escolha ate ${count} termos que valem virar card.

${contextBlock(ctx)}

TEXTO:
"""${text}"""

Escolha os termos por ESTE criterio, nesta ordem:
1. Frequencia real na lingua -- o que ele vai reencontrar, nao a palavra rara do texto.
2. Alcance: no nivel ${ctx.level} ou um degrau acima. Acima disso nao firma.
3. Impacto na compreensao: se nao saber a palavra atrapalha entender o texto, ela entra.

NAO inclua:
- Palavras que qualquer aluno de ${ctx.level} ja sabe.
- Nomes proprios, numeros, datas, marcas.
- Termos tecnicos de um dominio especifico que nao se repetem fora dele.
- Palavras que ele ja esta aprendendo (listadas acima, se houver).

Prefira expressoes inteiras a palavras soltas quando a expressao for a unidade real
("to keep track of", "sich melden", "echar de menos"): e assim que a lingua e usada.

Para cada termo:
- "term": a forma de DICIONARIO, nao a forma flexionada do texto. Substantivo com artigo
  quando o idioma tem artigo; verbo no infinitivo. Em russo, cirilico.
- "meaning": o significado em portugues, curto. E ele que vira a chave do conceito, entao
  escreva o SIGNIFICADO, nao uma parafrase longa. Avise entre parenteses quando a
  construcao mudar (caso exigido, reflexivo, preposicao obrigatoria, falso cognato).
- "example": a frase DO TEXTO em que o termo aparece, recortada. Se a frase do texto for
  longa demais ou confusa, escreva uma curta e cotidiana no lugar.
- "translation": a traducao do exemplo para o portugues.
- "level": o nivel CEFR do termo (A1, A2, B1, B2, C1 ou C2).

Responda APENAS com JSON valido:
{
  "terms": [
    {
      "term": "a forma de dicionario",
      "meaning": "o significado em portugues",
      "example": "a frase em ${ctx.languageName}",
      "translation": "a traducao da frase",
      "level": "B1"
    }
  ]
}
Devolva lista vazia se o texto nao tiver nenhum termo que valha a pena para este nivel.`;
}
