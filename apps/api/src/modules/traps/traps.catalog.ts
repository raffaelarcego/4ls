/**
 * As armadilhas cruzadas: a frase que sai errada porque outra lingua vazou.
 *
 * O Error Intelligence ja sabe QUAL idioma esta contaminando qual -- e o dado
 * que so este produto consegue produzir, porque so ele sabe quais sao os outros
 * tres idiomas do aluno. E o painel de interferencia ja diz o que estudar.
 *
 * So que ele para exatamente ai: no diagnostico. "O espanhol esta entrando no
 * seu portugues, estude este contraste" manda o aluno para uma aula sobre o
 * ponto -- e aula sobre interferencia nao desfaz interferencia. O que desfaz e
 * escolher a forma certa com a forma errada do lado, muitas vezes, ate a
 * primeira que vem a cabeca deixar de ser a importada.
 *
 * E isso que este catalogo serve: pares minimos entre idiomas, em que a
 * alternativa errada nao e um distrator inventado -- e exatamente a frase que
 * sai quando a regra da outra lingua vaza.
 *
 * Por que curado, e nao gerado: uma armadilha errada ensina o erro. Se o modelo
 * marcar como "certa" uma frase que um nativo nao diria, o aluno a repete com
 * confianca -- e com MAIS confianca do que antes, porque acabou de "acertar" o
 * exercicio. Estas dez linhas sao o tipo de conteudo em que o custo de errar
 * nao compensa nenhuma economia.
 *
 * O catalogo e o complemento, nao a fonte principal. A fonte principal sao os
 * erros DELE -- `errors.userText` contra `errors.correctedText` --, que ja estao
 * no banco e nao custam nada. O catalogo entra quando eles nao bastam, e para
 * cobrir os pares que ele ainda nao teve chance de errar.
 */

export type TrapLevel = 'A1' | 'A2' | 'B1';

export interface Trap {
  id: string;
  /** O idioma em que se esta falando. */
  languageCode: string;
  /** De onde vem a contaminacao. "pt" e a lingua materna. */
  sourceCode: string;
  /** A ideia, em portugues. */
  gloss: string;
  /** Como se diz de verdade. */
  right: string;
  /** O que sai quando a regra da outra lingua vaza. */
  wrong: string;
  /** Por que, nomeando a origem. */
  why: string;
  level: TrapLevel;
}

export const TRAPS: Trap[] = [
  // ------------------------------------------------- inglês contaminado pelo pt
  {
    id: 'en-pt-idade',
    languageCode: 'en',
    sourceCode: 'pt',
    gloss: 'Eu tenho trinta anos.',
    right: 'I am thirty years old.',
    wrong: 'I have thirty years.',
    why: 'Idade em inglês é com o verbo "to be", não com "have". O "ter" do português vaza direto aqui.',
    level: 'A1',
  },
  {
    id: 'en-pt-concordar',
    languageCode: 'en',
    sourceCode: 'pt',
    gloss: 'Eu concordo com você.',
    right: 'I agree with you.',
    wrong: 'I am agree with you.',
    why: '"Agree" já é o verbo. O "estou de acordo" do português puxa um "am" que não existe.',
    level: 'A1',
  },
  {
    id: 'en-pt-pretender',
    languageCode: 'en',
    sourceCode: 'pt',
    gloss: 'Eu pretendo viajar em maio.',
    right: 'I intend to travel in May.',
    wrong: 'I pretend to travel in May.',
    why: '"Pretend" é fingir. O falso cognato sobrevive porque a frase errada continua fazendo sentido — só que outro.',
    level: 'A2',
  },
  {
    id: 'en-pt-moro-ha',
    languageCode: 'en',
    sourceCode: 'pt',
    gloss: 'Moro aqui há dois anos.',
    right: 'I have lived here for two years.',
    wrong: 'I live here for two years.',
    why: 'O português usa o presente para o que começou antes e continua; o inglês exige o present perfect.',
    level: 'A2',
  },

  // ------------------------------------------------ espanhol contaminado pelo pt
  {
    id: 'es-pt-vergonha',
    languageCode: 'es',
    sourceCode: 'pt',
    gloss: 'Estou com vergonha.',
    right: 'Estoy avergonzado.',
    wrong: 'Estoy embarazada.',
    why: '"Embarazada" é grávida. É o falso amigo mais caro do espanhol para brasileiros.',
    level: 'A1',
  },
  {
    id: 'es-pt-escritorio',
    languageCode: 'es',
    sourceCode: 'pt',
    gloss: 'Vou ao escritório.',
    right: 'Voy a la oficina.',
    wrong: 'Voy al escritorio.',
    why: '"Escritorio" em espanhol é a escrivaninha, o móvel. O escritório é "la oficina".',
    level: 'A1',
  },
  {
    id: 'es-pt-gustar',
    languageCode: 'es',
    sourceCode: 'pt',
    gloss: 'Eu gosto do filme.',
    right: 'Me gusta la película.',
    wrong: 'Yo gusto la película.',
    why: 'O espanhol inverte: o filme é que agrada a mim. Quem gosta não é o sujeito da frase.',
    level: 'A1',
  },
  {
    id: 'es-pt-genero-viagem',
    languageCode: 'es',
    sourceCode: 'pt',
    gloss: 'A viagem foi longa.',
    right: 'El viaje fue largo.',
    wrong: 'La viaje fue larga.',
    why: 'O gênero não acompanha o português: "viaje" é masculino em espanhol, e o adjetivo vai junto.',
    level: 'A2',
  },

  // -------------------------------------------------- alemão contaminado pelo pt
  {
    id: 'de-pt-verbo-segundo',
    languageCode: 'de',
    sourceCode: 'pt',
    gloss: 'Amanhã eu vou ao cinema.',
    right: 'Morgen gehe ich ins Kino.',
    wrong: 'Morgen ich gehe ins Kino.',
    why: 'O verbo alemão ocupa a segunda posição. Começando por "amanhã", o sujeito vai para depois do verbo.',
    level: 'A1',
  },
  {
    id: 'de-pt-idade',
    languageCode: 'de',
    sourceCode: 'pt',
    gloss: 'Eu tenho trinta anos.',
    right: 'Ich bin dreißig Jahre alt.',
    wrong: 'Ich habe dreißig Jahre.',
    why: 'Como no inglês, idade em alemão é com "sein". O "ter" do português vaza nos dois.',
    level: 'A1',
  },
  {
    id: 'de-pt-negacao',
    languageCode: 'de',
    sourceCode: 'pt',
    gloss: 'Eu não vejo o filme.',
    right: 'Ich sehe den Film nicht.',
    wrong: 'Ich nicht sehe den Film.',
    why: 'O "nicht" não fica antes do verbo como o "não" do português: ele vai para o fim da frase.',
    level: 'A1',
  },
  {
    id: 'de-pt-acusativo',
    languageCode: 'de',
    sourceCode: 'pt',
    gloss: 'Eu vejo o homem.',
    right: 'Ich sehe den Mann.',
    wrong: 'Ich sehe der Mann.',
    why: 'Quem é visto é objeto direto, e o masculino marca isso: "der" vira "den". O português não marca nada.',
    level: 'A1',
  },

  // ---------------------------------------------------- russo contaminado pelo pt
  {
    id: 'ru-pt-ser',
    languageCode: 'ru',
    sourceCode: 'pt',
    gloss: 'Eu sou brasileiro.',
    right: 'Я бразилец.',
    wrong: 'Я есть бразилец.',
    why: 'No presente o russo não tem verbo "ser". Diz-se literalmente "eu brasileiro" — e a vontade de pôr um verbo ali é forte.',
    level: 'A1',
  },
  {
    id: 'ru-pt-preposicional',
    languageCode: 'ru',
    sourceCode: 'pt',
    gloss: 'Eu estou na cozinha.',
    right: 'Я на кухне.',
    wrong: 'Я на кухня.',
    why: 'Lugar parado muda a terminação do substantivo. Em português a palavra fica igual, e é ela que sai sem mudar.',
    level: 'A1',
  },
  {
    id: 'ru-pt-gostar',
    languageCode: 'ru',
    sourceCode: 'pt',
    gloss: 'Eu gosto deste livro.',
    right: 'Мне нравится эта книга.',
    wrong: 'Я нравлюсь эту книгу.',
    why: 'Como no espanhol, o russo inverte: o livro agrada a mim. Quem gosta vai para o dativo.',
    level: 'A2',
  },

  // ------------------------------------- um idioma estudado entrando noutro
  {
    id: 'de-en-bekommen',
    languageCode: 'de',
    sourceCode: 'en',
    gloss: 'Eu recebo uma carta.',
    right: 'Ich bekomme einen Brief.',
    wrong: 'Ich werde einen Brief.',
    why: '"Bekommen" parece "become" e significa receber. Quem estuda inglês troca os dois com confiança.',
    level: 'A2',
  },
  {
    id: 'de-ru-artigo',
    languageCode: 'de',
    sourceCode: 'ru',
    gloss: 'Eu vejo o livro.',
    right: 'Ich sehe das Buch.',
    wrong: 'Ich sehe Buch.',
    why: 'O russo não tem artigo nenhum, e estudar os dois juntos faz o artigo alemão sumir na hora de falar.',
    level: 'A1',
  },
  {
    id: 'ru-de-ordem',
    languageCode: 'ru',
    sourceCode: 'de',
    gloss: 'Amanhã eu trabalho.',
    right: 'Завтра я работаю.',
    wrong: 'Завтра работаю я.',
    why: 'A segunda posição do verbo é regra alemã, não russa. Aplicá-la em russo produz uma frase que soa forçada.',
    level: 'A2',
  },
  {
    id: 'es-en-anos',
    languageCode: 'es',
    sourceCode: 'en',
    gloss: 'Ela tem vinte anos.',
    right: 'Ella tiene veinte años.',
    wrong: 'Ella es veinte años.',
    why: 'Espanhol e português usam "ter" para idade; o inglês usa "ser". Aqui é o inglês que atrapalha, não o português.',
    level: 'A1',
  },
  {
    id: 'en-es-pessoas',
    languageCode: 'en',
    sourceCode: 'es',
    gloss: 'As pessoas dizem que é difícil.',
    right: 'People say it is difficult.',
    wrong: 'The people says it is difficult.',
    why: '"People" já é plural e vai sem artigo aqui. "La gente es" do espanhol puxa o singular e o artigo.',
    level: 'A2',
  },
];

const LEVEL_ORDER: TrapLevel[] = ['A1', 'A2', 'B1'];

/** As armadilhas de um par (idioma alvo <- origem), ate um nivel. */
export function trapsForPair(
  languageCode: string,
  sourceCode: string,
  level: string,
): Trap[] {
  const ceiling = LEVEL_ORDER.indexOf(level as TrapLevel);
  const limit = ceiling === -1 ? LEVEL_ORDER.length - 1 : ceiling;

  return TRAPS.filter(
    (trap) =>
      trap.languageCode === languageCode &&
      trap.sourceCode === sourceCode &&
      LEVEL_ORDER.indexOf(trap.level) <= limit,
  );
}

/** Todas as armadilhas de um idioma, venham de onde vierem. */
export function trapsForLanguage(languageCode: string, level: string): Trap[] {
  const ceiling = LEVEL_ORDER.indexOf(level as TrapLevel);
  const limit = ceiling === -1 ? LEVEL_ORDER.length - 1 : ceiling;

  return TRAPS.filter(
    (trap) =>
      trap.languageCode === languageCode && LEVEL_ORDER.indexOf(trap.level) <= limit,
  );
}

export function findTrap(id: string): Trap | undefined {
  return TRAPS.find((trap) => trap.id === id);
}

/**
 * A chave desta armadilha em `grammar_progress`.
 *
 * O id pode ser do catalogo ("es-pt-vergonha") ou de um erro do proprio aluno
 * ("<uuid do error_record>"). Os dois convivem na mesma chave de proposito: o
 * que se mede aqui e "esta armadilha ainda me pega?", e a resposta nao depende
 * de quem escreveu o par minimo.
 */
export function trapTopicId(id: string): string {
  return `trap:${id}`;
}
