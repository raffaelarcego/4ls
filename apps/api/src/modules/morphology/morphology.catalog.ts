/**
 * Os casos: as terminacoes que mudam a palavra conforme a funcao dela na frase.
 *
 * Este e o buraco que sobrava entre dois blocos que ja existiam. A estrutura
 * ensina a ORDEM das pecas; o vocabulario ensina o SIGNIFICADO da palavra.
 * Nenhum dos dois ensina que a palavra muda de forma -- e em alemao e russo ela
 * muda o tempo todo, em toda frase, por toda a lingua.
 *
 * O catalogo de contrastes ja EXPLICA os casos (`contrast-catalog.ts`, topico
 * "cases"): o que sao, por que existem, e a ponte com os pronomes do portugues.
 * Explicacao e o que ele faz bem. Mas ninguem aprende terminacao lendo sobre
 * terminacao -- aprende produzindo a forma certa muitas vezes, no slot certo. E
 * isso que falta, e e so isso que este modulo faz.
 *
 * Tres decisoes:
 *
 * 1. O CATALOGO SAO OS CASOS, NAO AS PALAVRAS. Os casos sao poucos, fixos e
 *    conhecidos: dez ao todo nos dois idiomas. As palavras sao infinitas e mudam
 *    com o aluno. Entao o que e curado aqui e o caso -- a pergunta que ele
 *    responde, o que o dispara, e a armadilha do brasileiro --, e a palavra
 *    entra por fora, vinda do vocabulario dele.
 *
 * 2. SO EXISTE EM ALEMAO E RUSSO. Ingles e espanhol nao marcam caso em
 *    substantivo, e servir este bloco neles seria inventar assunto. O motor da
 *    sessao precisa saber disso: ver `hasMorphology`.
 *
 * 3. A PERGUNTA VEM ANTES DA TERMINACAO. "Dativo" nao diz nada a quem nao sabe
 *    o que e dativo; "a quem?" diz. Toda a tela e construida em cima da
 *    pergunta, e o nome do caso e so o rotulo que acompanha.
 */

export type MorphologyLevel = 'A1' | 'A2' | 'B1';

export interface MorphologySlot {
  /** Estavel: vira chave de progresso. Ex.: "ru-dat". */
  id: string;
  languageCode: string;
  /** O nome do caso, como um livro o chama. */
  name: string;
  /**
   * A pergunta que este caso responde, em portugues.
   * E o texto que ensina: "a quem?" resolve o que "dativo" nao resolve.
   */
  question: string;
  /** O que o dispara na frase: preposicoes, verbos, construcoes. */
  triggers: string[];
  /** O erro que um brasileiro comete neste caso. */
  trap: string;
  level: MorphologyLevel;
}

export const MORPHOLOGY_SLOTS: MorphologySlot[] = [
  // ------------------------------------------------------------------ russo
  {
    id: 'ru-nom',
    languageCode: 'ru',
    name: 'Nominativo',
    question: 'Quem faz? O que é?',
    triggers: ['sujeito da frase', 'depois de "это"'],
    trap: 'É a forma do dicionário — e é a única que o brasileiro usa por padrão, inclusive onde não cabe.',
    level: 'A1',
  },
  {
    id: 'ru-pre',
    languageCode: 'ru',
    name: 'Preposicional',
    question: 'Onde? Sobre o quê?',
    triggers: ['в (dentro de, parado)', 'на (sobre, parado)', 'о (sobre, a respeito de)'],
    trap: 'Nunca aparece sozinho: só existe atrás de preposição. Dizer o lugar sem mudar a terminação é o erro mais comum do começo.',
    level: 'A1',
  },
  {
    id: 'ru-acc',
    languageCode: 'ru',
    name: 'Acusativo',
    question: 'Quem ou o quê recebe a ação? Para onde?',
    triggers: ['objeto direto', 'в / на com movimento', 'через'],
    trap: 'A mesma preposição "в" pede preposicional parado e acusativo em movimento — "na cozinha" e "para a cozinha" mudam a terminação, não a preposição.',
    level: 'A1',
  },
  {
    id: 'ru-gen',
    languageCode: 'ru',
    name: 'Genitivo',
    question: 'De quem? De quê?',
    triggers: ['posse', 'нет (não há)', 'много / мало', 'без', 'у'],
    trap: 'Negar a existência de algo joga a coisa para o genitivo: "não tenho trabalho" não usa a forma do dicionário.',
    level: 'A2',
  },
  {
    id: 'ru-dat',
    languageCode: 'ru',
    name: 'Dativo',
    question: 'A quem? Para quem?',
    triggers: ['destinatário', 'к (em direção a)', 'по', 'нравиться (agradar)'],
    trap: 'Em "eu gosto disto" o russo inverte: quem gosta vai para o dativo e a coisa vira sujeito — literalmente "a mim agrada".',
    level: 'A2',
  },
  {
    id: 'ru-ins',
    languageCode: 'ru',
    name: 'Instrumental',
    question: 'Com quê? Por quem?',
    triggers: ['instrumento', 'с (junto com)', 'profissão depois de "быть"'],
    trap: 'O instrumento não leva preposição nenhuma: "escrevo com a caneta" é só a terminação. O "с" ali é de companhia, não de ferramenta.',
    level: 'B1',
  },

  // ----------------------------------------------------------------- alemão
  {
    id: 'de-nom',
    languageCode: 'de',
    name: 'Nominativ',
    question: 'Quem faz? O que é?',
    triggers: ['sujeito da frase', 'depois de sein, werden, bleiben'],
    trap: 'Depois de "sein" o que vem continua no nominativo: "Er ist ein guter Lehrer", nunca "einen".',
    level: 'A1',
  },
  {
    id: 'de-akk',
    languageCode: 'de',
    name: 'Akkusativ',
    question: 'Quem ou o quê recebe a ação?',
    triggers: ['objeto direto', 'durch, für, ohne, um, gegen', 'in / auf com movimento'],
    trap: 'Só o masculino muda de verdade (der → den). Como feminino e neutro ficam iguais, o brasileiro acha que o caso "não faz nada" — e erra exatamente no masculino.',
    level: 'A1',
  },
  {
    id: 'de-dat',
    languageCode: 'de',
    name: 'Dativ',
    question: 'A quem? Onde?',
    triggers: ['objeto indireto', 'mit, nach, aus, zu, von, bei, seit', 'in / auf parado'],
    trap: 'As preposições de dativo não negociam: "mit" pede dativo sempre, mesmo quando a frase parece de movimento.',
    level: 'A2',
  },
  {
    id: 'de-gen',
    languageCode: 'de',
    name: 'Genitiv',
    question: 'De quem? De quê?',
    triggers: ['posse', 'wegen, während, trotz, statt'],
    trap: 'O masculino e o neutro ganham um -s no próprio substantivo, além do artigo: "des Mannes", não "des Mann".',
    level: 'B1',
  },
];

const LEVEL_ORDER: MorphologyLevel[] = ['A1', 'A2', 'B1'];

/** Os idiomas que marcam caso no substantivo. Fora deles o bloco nao existe. */
export const MORPHOLOGY_LANGUAGES = [
  ...new Set(MORPHOLOGY_SLOTS.map((slot) => slot.languageCode)),
];

/**
 * Este idioma tem morfologia de caso?
 *
 * O motor da sessao consulta isto antes de ranquear o bloco. Sem a checagem, o
 * planejador ofereceria "casos do ingles" -- um assunto que nao existe -- e
 * ainda gastaria a vaga de um bloco que ensinaria alguma coisa.
 */
export function hasMorphology(languageCode: string): boolean {
  return MORPHOLOGY_LANGUAGES.includes(languageCode);
}

/** Os casos ensinaveis num idioma ate um nivel, na ordem do catalogo. */
export function slotsFor(languageCode: string, level: string): MorphologySlot[] {
  const ceiling = LEVEL_ORDER.indexOf(level as MorphologyLevel);
  // Nivel fora da escala (B2 em diante) recebe o catalogo inteiro: parar de
  // servir casos a quem avancou seria o contrario do que o nivel significa.
  const limit = ceiling === -1 ? LEVEL_ORDER.length - 1 : ceiling;

  return MORPHOLOGY_SLOTS.filter(
    (slot) =>
      slot.languageCode === languageCode && LEVEL_ORDER.indexOf(slot.level) <= limit,
  );
}

export function findSlot(id: string): MorphologySlot | undefined {
  return MORPHOLOGY_SLOTS.find((slot) => slot.id === id);
}

/** Todos os casos de um idioma, independente de nivel -- a tabela mostra todos. */
export function allSlotsFor(languageCode: string): MorphologySlot[] {
  return MORPHOLOGY_SLOTS.filter((slot) => slot.languageCode === languageCode);
}

/**
 * A chave deste caso em `grammar_progress`.
 *
 * Mesmo motivo do `cando:` e do `reading:`: a tabela e compartilhada pelos
 * catalogos que vivem no codigo, e sem prefixo um id de caso colidiria com o de
 * um contraste.
 */
export function morphologyTopicId(slotId: string): string {
  return `morph:${slotId}`;
}
