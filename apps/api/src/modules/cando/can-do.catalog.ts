/**
 * As "can-dos": o que o aluno consegue DIZER, descrito em portugues.
 *
 * Esta e a unidade que faltava no produto. O catalogo de estrutura organiza o
 * estudo por regra de UM idioma -- "o verbo alemao na segunda posicao", "o
 * gustar espanhol" --, e por isso os quatro idiomas recebiam, no mesmo dia,
 * aulas sobre assuntos sem nenhuma relacao entre si. Nao havia como comparar.
 *
 * A can-do inverte o eixo: a unidade passa a ser uma FUNCAO comunicativa em
 * portugues ("como digo onde algo esta?"), e cada idioma mostra como resolve
 * aquela mesma funcao. E o que permite ver as quatro respostas lado a lado.
 *
 * Tres decisoes, todas vindas da pesquisa:
 *
 * 1. A ABSTRACAO COMPARTILHADA E A FUNCAO, NUNCA A CATEGORIA GRAMATICAL.
 *    Nada de tratar "dativo" como um conceito unico entre alemao e russo: eles
 *    marcam caso em lugares diferentes e o russo ainda tem instrumental e
 *    preposicional, que o alemao nao tem. O que se compartilha e "a quem se
 *    da", "o instrumento com que se faz" -- dito em portugues --, e cada idioma
 *    mapeia isso para o proprio caso. Celula vazia quando nao ha contraparte e
 *    honesto e instrutivo.
 *
 * 2. AS COLUNAS SAO AS MESMAS NOS QUATRO IDIOMAS (sentence builders, Conti).
 *    E justamente a diferenca de ORDEM entre as colunas que ensina o contraste:
 *    ver QUEM/ACAO/ONDE preenchido em aleman e em russo mostra a regra sem
 *    precisar enuncia-la.
 *
 * 3. O CONTRASTE MAIS PERIGOSO DELE E PORTUGUES-ESPANHOL, nao alemao-russo.
 *    A lingua tipologicamente proxima e a que vaza. Por isso as notas do
 *    espanhol destacam a armadilha em vez de esconde-la.
 *
 * O texto das frases nao vive aqui: vem da geracao (fora do horario de estudo,
 * ver `warm-content.ts`), que recebe esta can-do como enunciado e devolve as
 * mesmas frases realizadas nos quatro idiomas.
 */

export type CanDoLevel = 'A1' | 'A2' | 'B1';

export interface CanDoNote {
  languageCode: string;
  /** O que este idioma exige aqui e o portugues nao exige. */
  note: string;
  /** O erro que um falante de portugues comete neste ponto, se houver. */
  trap?: string;
}

export interface CanDo {
  id: string;
  /** A funcao, do ponto de vista de quem quer falar. */
  question: string;
  /** O que ele sai sabendo fazer. */
  goal: string;
  level: CanDoLevel;
  /**
   * As colunas da tabela de montagem, em portugues. Mesmas colunas nos quatro
   * idiomas -- a ordem em que cada um as preenche e a licao.
   */
  columns: string[];
  notes: CanDoNote[];
}

export const CAN_DOS: CanDo[] = [
  {
    id: 'apresentar-se',
    question: 'Como digo quem eu sou?',
    goal: 'Dizer seu nome, sua nacionalidade e o que você faz.',
    level: 'A1',
    columns: ['QUEM', 'SER', 'O QUÊ'],
    notes: [
      { languageCode: 'en', note: 'O verbo "to be" é obrigatório e muda de forma: I am, he is.' },
      {
        languageCode: 'es',
        note: 'O sujeito costuma ser omitido: "soy brasileño", não "yo soy brasileño".',
        trap: 'Ser e estar existem nos dois idiomas, mas nem sempre no mesmo lugar que no português.',
      },
      {
        languageCode: 'de',
        note: 'O verbo fica sempre na segunda posição, mesmo quando a frase começa por outra coisa.',
      },
      {
        languageCode: 'ru',
        note: 'No presente não existe verbo "ser": diz-se literalmente "eu brasileiro".',
        trap: 'A vontade de colocar um verbo ali é forte — e deixa a frase errada.',
      },
    ],
  },
  {
    id: 'dizer-onde-algo-esta',
    question: 'Como digo onde algo está?',
    goal: 'Localizar uma coisa ou uma pessoa no espaço.',
    level: 'A1',
    columns: ['O QUÊ', 'ESTAR', 'ONDE'],
    notes: [
      { languageCode: 'en', note: 'A preposição muda com o tipo de lugar: in, on, at.' },
      {
        languageCode: 'es',
        note: 'Localização pede "estar", nunca "ser".',
        trap: 'Igual ao português — este é um dos poucos pontos em que o espanhol não te trai.',
      },
      {
        languageCode: 'de',
        note: 'A preposição de lugar parado pede dativo: "in der Küche", não "in die Küche".',
        trap: 'Dizer onde algo ESTÁ e para onde algo VAI usa casos diferentes com a mesma preposição.',
      },
      {
        languageCode: 'ru',
        note: 'Lugar parado pede o caso preposicional, marcado na terminação do substantivo.',
        trap: 'O caso é marcado no fim da palavra, não num artigo — não há artigo nenhum.',
      },
    ],
  },
  {
    id: 'dizer-que-gosto',
    question: 'Como digo que gosto de alguma coisa?',
    goal: 'Falar de gosto e preferência.',
    level: 'A1',
    columns: ['QUEM GOSTA', 'VERBO', 'DO QUÊ'],
    notes: [
      { languageCode: 'en', note: 'Direto: "I like coffee". Quem gosta é o sujeito.' },
      {
        languageCode: 'es',
        note: 'A frase vira do avesso: "me gusta el café" — quem gosta vira objeto indireto.',
        trap: 'O português tem "gostar de"; o espanhol inverte os papéis. É o erro clássico do brasileiro.',
      },
      {
        languageCode: 'de',
        note: 'Depende do que se gosta: "ich mag" para coisas, "gern" colado ao verbo para ações.',
      },
      {
        languageCode: 'ru',
        note: 'Também inverte, como o espanhol: quem gosta vai para o dativo.',
        trap: 'A inversão é a mesma do espanhol — aprender uma ajuda a outra, em vez de atrapalhar.',
      },
    ],
  },
  {
    id: 'dizer-o-que-faco',
    question: 'Como digo o que estou fazendo agora?',
    goal: 'Descrever a ação do momento.',
    level: 'A1',
    columns: ['QUEM', 'AÇÃO', 'O QUÊ'],
    notes: [
      {
        languageCode: 'en',
        note: 'Ação em curso exige a forma contínua: "I am eating", não "I eat".',
        trap: 'Em português o presente simples serve para as duas coisas; em inglês, não.',
      },
      { languageCode: 'es', note: 'O presente simples já serve, como no português.' },
      {
        languageCode: 'de',
        note: 'Não existe forma contínua: o presente simples cobre "faço" e "estou fazendo".',
      },
      {
        languageCode: 'ru',
        note: 'O presente simples serve, mas o verbo escolhido já carrega se a ação é concluída ou não.',
      },
    ],
  },
  {
    id: 'pedir-algo',
    question: 'Como peço alguma coisa?',
    goal: 'Pedir um objeto ou um favor com educação.',
    level: 'A1',
    columns: ['FÓRMULA', 'O QUÊ', 'CORTESIA'],
    notes: [
      { languageCode: 'en', note: '"Could I have…" soa muito melhor que o imperativo direto.' },
      { languageCode: 'es', note: '"¿Me pones…?" e "¿Me das…?" são o uso corrente em bar e loja.' },
      {
        languageCode: 'de',
        note: 'O que se pede vai para o acusativo: "einen Kaffee, bitte".',
        trap: 'O artigo muda de forma — é nele, e não no substantivo, que o caso aparece.',
      },
      {
        languageCode: 'ru',
        note: 'O que se pede vai para o acusativo, marcado na terminação.',
        trap: '"Пожалуйста" serve para "por favor" e para "de nada" — o contexto decide.',
      },
    ],
  },
  {
    id: 'negar',
    question: 'Como digo que não?',
    goal: 'Negar uma frase inteira ou só uma parte dela.',
    level: 'A1',
    columns: ['QUEM', 'NEGAÇÃO', 'AÇÃO'],
    notes: [
      {
        languageCode: 'en',
        note: 'A negação pede um auxiliar: "I don\'t know", nunca "I not know".',
        trap: 'O português nega com uma palavra só; o inglês precisa do auxiliar.',
      },
      { languageCode: 'es', note: 'Quase igual ao português: "no" antes do verbo.' },
      {
        languageCode: 'de',
        note: 'Duas negações diferentes: "nicht" para o verbo, "kein" para substantivo.',
        trap: 'Escolher a errada é o erro mais comum do começo.',
      },
      {
        languageCode: 'ru',
        note: '"не" antes do que se nega; a dupla negação é obrigatória e correta.',
        trap: 'Em português a dupla negação soa errada — em russo é a forma certa.',
      },
    ],
  },
  {
    id: 'perguntar-sim-nao',
    question: 'Como faço uma pergunta de sim ou não?',
    goal: 'Transformar uma afirmação em pergunta.',
    level: 'A1',
    columns: ['MARCA DE PERGUNTA', 'QUEM', 'AÇÃO'],
    notes: [
      {
        languageCode: 'en',
        note: 'Toda pergunta pede um auxiliar na frente: do, does, are, can.',
        trap: 'Em português basta a entonação; em inglês a estrutura muda.',
      },
      { languageCode: 'es', note: 'Só a entonação muda, como no português.' },
      { languageCode: 'de', note: 'O verbo pula para a primeira posição: "Hast du Zeit?"' },
      {
        languageCode: 'ru',
        note: 'A ordem não muda: só a entonação, ou a partícula "ли" no registro formal.',
      },
    ],
  },
  {
    id: 'falar-de-quantidade',
    question: 'Como digo quantos são?',
    goal: 'Contar coisas e falar de quantidade.',
    level: 'A1',
    columns: ['QUANTOS', 'O QUÊ'],
    notes: [
      { languageCode: 'en', note: 'Distingue contável de incontável: many/much, few/little.' },
      { languageCode: 'es', note: 'Funciona como o português, com concordância de gênero.' },
      { languageCode: 'de', note: 'O substantivo fica no plural, e o plural é irregular — aprenda junto.' },
      {
        languageCode: 'ru',
        note: 'O número muda a terminação do substantivo: 1 pede uma forma, 2–4 outra, 5+ outra.',
        trap: 'É a regra que mais surpreende: contar muda a palavra contada.',
      },
    ],
  },
  {
    id: 'dizer-de-quem-e',
    question: 'Como digo de quem é uma coisa?',
    goal: 'Expressar posse.',
    level: 'A2',
    columns: ['O QUÊ', 'DE QUEM'],
    notes: [
      { languageCode: 'en', note: 'Duas formas: "John\'s car" e "the car of John" — a primeira domina.' },
      { languageCode: 'es', note: 'Sempre com "de": "el coche de Juan".' },
      { languageCode: 'de', note: 'O genitivo existe, mas na fala usa-se "von" + dativo.' },
      {
        languageCode: 'ru',
        note: 'Posse se diz com "у меня есть" — literalmente "junto a mim há".',
        trap: 'Não existe o verbo "ter" como no português: a frase inteira muda de forma.',
      },
    ],
  },
  {
    id: 'falar-do-passado',
    question: 'Como digo o que fiz ontem?',
    goal: 'Contar algo que já aconteceu.',
    level: 'A2',
    columns: ['QUEM', 'AÇÃO NO PASSADO', 'O QUÊ', 'QUANDO'],
    notes: [
      {
        languageCode: 'en',
        note: 'Passado simples para fato datado; present perfect quando a data não importa.',
        trap: 'Com "yesterday" só cabe o passado simples — nunca o present perfect.',
      },
      {
        languageCode: 'es',
        note: 'Pretérito indefinido e perfecto se dividem por região e por marcador de tempo.',
        trap: 'A divisão não é a mesma do português — é onde o brasileiro mais erra em espanhol.',
      },
      {
        languageCode: 'de',
        note: 'Na fala usa-se o Perfekt, com o particípio jogado para o fim da frase.',
        trap: 'O verbo auxiliar fica na segunda posição e o principal só aparece no fim.',
      },
      {
        languageCode: 'ru',
        note: 'O passado concorda com o GÊNERO de quem fala: "я сказал" (homem) / "я сказала" (mulher).',
        trap: 'Não é o verbo que muda por pessoa, é por gênero — nada parecido com o português.',
      },
    ],
  },
  {
    id: 'dizer-que-preciso',
    question: 'Como digo que preciso ou tenho que fazer algo?',
    goal: 'Expressar necessidade e obrigação.',
    level: 'A2',
    columns: ['QUEM', 'OBRIGAÇÃO', 'AÇÃO'],
    notes: [
      { languageCode: 'en', note: '"have to" para obrigação externa, "must" para a interna.' },
      { languageCode: 'es', note: '"tener que" + infinitivo, igual ao português.' },
      {
        languageCode: 'de',
        note: 'O verbo modal ocupa a segunda posição e o infinitivo vai para o fim.',
        trap: 'A frase fica com um "buraco" no meio — é o parêntese verbal alemão.',
      },
      {
        languageCode: 'ru',
        note: 'Usa-se "нужно" ou "надо" com quem precisa no dativo: "мне нужно".',
        trap: 'A frase não tem sujeito no nominativo — quem precisa não é o sujeito gramatical.',
      },
    ],
  },
  {
    id: 'combinar-encontro',
    question: 'Como combino de encontrar alguém?',
    goal: 'Marcar hora e lugar com outra pessoa.',
    level: 'A2',
    columns: ['AÇÃO', 'COM QUEM', 'QUANDO', 'ONDE'],
    notes: [
      { languageCode: 'en', note: 'Ordem fixa: o que, depois quando, depois onde.' },
      { languageCode: 'es', note: 'Ordem parecida com a do português, com mais liberdade.' },
      {
        languageCode: 'de',
        note: 'A ordem do meio da frase é tempo, modo e lugar — nessa sequência.',
        trap: 'É o inverso do português, que costuma pôr o lugar antes do tempo.',
      },
      {
        languageCode: 'ru',
        note: '"com quem" pede o caso instrumental: "с другом".',
        trap: 'O instrumental não tem equivalente no alemão — esta célula não tem par.',
      },
    ],
  },
];

export function findCanDo(id: string): CanDo | undefined {
  return CAN_DOS.find((c) => c.id === id);
}

/** As can-dos que cabem no nivel mais baixo entre os idiomas do aluno. */
export function canDosUpTo(level: CanDoLevel): CanDo[] {
  const order: CanDoLevel[] = ['A1', 'A2', 'B1'];
  const ceiling = order.indexOf(level);
  return CAN_DOS.filter((c) => order.indexOf(c.level) <= ceiling);
}

/**
 * Mesma convencao de `structure:` e `alphabet:`: o progresso das tres trilhas
 * divide a tabela `grammar_progress`, e o prefixo e o que as mantem separadas.
 */
export function canDoTopicId(canDoId: string): string {
  return `cando:${canDoId}`;
}
