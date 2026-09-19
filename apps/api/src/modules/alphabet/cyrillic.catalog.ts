/**
 * O alfabeto cirilico para quem le alfabeto latino e fala portugues.
 *
 * Esta trilha existe porque o resto do app assumia que A1 significa "ja sei ler
 * o alfabeto", e isso e falso. Sem a ligacao letra->som, o aluno decora o
 * DESENHO da palavra em vez de le-la: ouve a pronuncia, olha os caracteres e
 * nao consegue ligar as duas coisas. Ensinar estrutura de frase antes disso e
 * construir no ar.
 *
 * Tres decisoes sustentam a ordem das licoes:
 *
 * 1. AS ARMADILHAS VEM CEDO, NAO NO FIM. As letras que existem no alfabeto
 *    latino com outro som (Р=r, Н=n, В=v, С=s, У=u, Х=rr) sao piores que as
 *    letras totalmente novas: o aluno le errado com CONFIANCA e nao percebe.
 *    Uma letra desconhecida ele ao menos sabe que nao sabe.
 *
 * 2. SO SE LE O QUE JA FOI ENSINADO. Cada licao lista palavras formadas
 *    exclusivamente por letras ja apresentadas -- por isso `мама` aparece na
 *    primeira aula e `борщ` so na setima. Ler uma palavra de verdade desde o
 *    primeiro dia e o que faz a trilha nao parecer decoreba de tabela.
 *
 * 3. AS ANCORAS DE SOM SAO EM PORTUGUES. `Ж` e o j de "janela", `Ш` e o ch de
 *    "chave", `Ч` e o tch de "tchau", `Х` e o rr de "carro". Curso feito para
 *    falante de ingles ancora `Ж` em "measure", o que nao ajuda em nada aqui --
 *    e o portugues por acaso tem quase todos esses sons prontos.
 */

export interface CyrillicLetter {
  upper: string;
  lower: string;
  /** Como se chama a letra, para a explicacao. */
  name: string;
  /** O som, ancorado numa palavra portuguesa. */
  sound: string;
  /**
   * O engano provavel, quando existe. So as letras que parecem outra coisa
   * ganham este campo -- e sao justamente as que mais custam caro.
   */
  trap?: string;
}

export interface CyrillicWord {
  word: string;
  meaning: string;
  /** A leitura som a som, para a primeira vez. */
  reading: string;
}

export interface AlphabetLesson {
  id: string;
  title: string;
  /** O que esta licao resolve, em uma frase. */
  goal: string;
  letters: CyrillicLetter[];
  /** Palavras formadas SO por letras desta licao e das anteriores. */
  words: CyrillicWord[];
}

export const CYRILLIC_LESSONS: AlphabetLesson[] = [
  {
    id: 'ru-alfa-1',
    title: 'As cinco que você já sabe ler',
    goal: 'Ler a primeira palavra russa inteira, sem nenhuma letra nova de verdade.',
    letters: [
      { upper: 'А', lower: 'а', name: 'a', sound: 'a de "casa"' },
      { upper: 'О', lower: 'о', name: 'o', sound: 'o de "bola"' },
      { upper: 'М', lower: 'м', name: 'em', sound: 'm de "mão"' },
      { upper: 'Т', lower: 'т', name: 'tê', sound: 't de "tudo"' },
      { upper: 'К', lower: 'к', name: 'ka', sound: 'c de "casa"' },
    ],
    words: [
      { word: 'мама', meaning: 'mãe', reading: 'MA-ma' },
      { word: 'там', meaning: 'lá', reading: 'tam' },
      { word: 'так', meaning: 'assim', reading: 'tak' },
      { word: 'кот', meaning: 'gato', reading: 'kot' },
      { word: 'мак', meaning: 'papoula', reading: 'mak' },
    ],
  },
  {
    id: 'ru-alfa-2',
    title: 'As três que enganam',
    goal: 'Parar de ler Н como "h" e Р como "p" — os dois enganos mais caros do começo.',
    letters: [
      {
        upper: 'Н',
        lower: 'н',
        name: 'en',
        sound: 'n de "nada"',
        trap: 'Parece o H latino, mas é N. "нос" é "nós" (nariz), nunca "hós".',
      },
      {
        upper: 'Р',
        lower: 'р',
        name: 'er',
        sound: 'r de "caro", vibrado com a ponta da língua',
        trap: 'Parece o P latino, mas é R. "рот" é "rot" (boca), nunca "pot".',
      },
      {
        upper: 'С',
        lower: 'с',
        name: 'es',
        sound: 's de "sapo"',
        trap: 'Parece o C latino, mas é sempre S — nunca tem som de K.',
      },
    ],
    words: [
      { word: 'нос', meaning: 'nariz', reading: 'nos' },
      { word: 'рот', meaning: 'boca', reading: 'rot' },
      { word: 'сон', meaning: 'sonho', reading: 'son' },
      { word: 'сок', meaning: 'suco', reading: 'sok' },
      { word: 'космос', meaning: 'cosmos', reading: 'KOS-mos' },
    ],
  },
  {
    id: 'ru-alfa-3',
    title: 'Mais três disfarçadas',
    goal: 'Ler "Москва" — e entender por que Х não é um X.',
    letters: [
      {
        upper: 'В',
        lower: 'в',
        name: 'vê',
        sound: 'v de "vida"',
        trap: 'Parece o B latino, mas é V. "вот" é "vót" (eis aqui), nunca "bot".',
      },
      {
        upper: 'У',
        lower: 'у',
        name: 'u',
        sound: 'u de "uva"',
        trap: 'Parece o Y latino, mas é U puro.',
      },
      {
        upper: 'Х',
        lower: 'х',
        name: 'ra',
        sound: 'rr de "carro", raspado na garganta',
        trap: 'Parece o X latino, mas não tem nada de "ks". É o nosso rr.',
      },
    ],
    words: [
      { word: 'вот', meaning: 'eis aqui', reading: 'vot' },
      { word: 'ухо', meaning: 'orelha', reading: 'Ú-rro' },
      { word: 'муха', meaning: 'mosca', reading: 'MU-rra' },
      { word: 'рука', meaning: 'mão', reading: 'ru-KÁ' },
      { word: 'Москва', meaning: 'Moscou', reading: 'mosk-VÁ' },
    ],
  },
  {
    id: 'ru-alfa-4',
    title: 'Formas novas, sons conhecidos',
    goal: 'Cinco letras que você nunca viu, mas cujos sons já existem no português.',
    letters: [
      { upper: 'Б', lower: 'б', name: 'be', sound: 'b de "bola"' },
      { upper: 'Д', lower: 'д', name: 'de', sound: 'd de "dado"' },
      { upper: 'П', lower: 'п', name: 'pe', sound: 'p de "pato"' },
      { upper: 'Л', lower: 'л', name: 'el', sound: 'l de "lua" — nunca o "u" final de "sal"' },
      { upper: 'И', lower: 'и', name: 'i', sound: 'i de "vida"' },
    ],
    words: [
      { word: 'дом', meaning: 'casa', reading: 'dom' },
      { word: 'брат', meaning: 'irmão', reading: 'brat' },
      { word: 'стол', meaning: 'mesa', reading: 'stol' },
      { word: 'мир', meaning: 'paz, mundo', reading: 'mir' },
      { word: 'лампа', meaning: 'lâmpada', reading: 'LAM-pa' },
    ],
  },
  {
    id: 'ru-alfa-5',
    title: 'O resto dos sons familiares',
    goal: 'Fechar os sons que o português já tem — e conhecer o E que na verdade é "ié".',
    letters: [
      { upper: 'Г', lower: 'г', name: 'ge', sound: 'g de "gato", sempre duro' },
      { upper: 'З', lower: 'з', name: 'ze', sound: 'z de "zebra"' },
      { upper: 'Ф', lower: 'ф', name: 'ef', sound: 'f de "faca"' },
      { upper: 'Э', lower: 'э', name: 'é', sound: 'é de "pé"' },
      {
        upper: 'Е',
        lower: 'е',
        name: 'ié',
        sound: 'ié — um i colado no é',
        trap: 'Parece o E latino, mas carrega um "i" na frente: "нет" soa "niét".',
      },
    ],
    words: [
      { word: 'нет', meaning: 'não', reading: 'niét' },
      { word: 'газ', meaning: 'gás', reading: 'gas' },
      { word: 'море', meaning: 'mar', reading: 'MÓ-rie' },
      { word: 'метро', meaning: 'metrô', reading: 'mie-TRÓ' },
      { word: 'лес', meaning: 'floresta', reading: 'liés' },
    ],
  },
  {
    id: 'ru-alfa-6',
    title: 'Os sons que o português tem e o inglês não',
    goal: 'Quatro letras fáceis para brasileiro: j, ch, tch e ts.',
    letters: [
      { upper: 'Ж', lower: 'ж', name: 'je', sound: 'j de "janela"' },
      { upper: 'Ш', lower: 'ш', name: 'cha', sound: 'ch de "chave"' },
      { upper: 'Ч', lower: 'ч', name: 'tche', sound: 'tch de "tchau"' },
      { upper: 'Ц', lower: 'ц', name: 'tse', sound: 'ts — o "ts" de "tsunami"' },
    ],
    words: [
      { word: 'хорошо', meaning: 'bem, está bom', reading: 'rra-ra-CHÓ' },
      { word: 'жена', meaning: 'esposa', reading: 'je-NÁ' },
      { word: 'школа', meaning: 'escola', reading: 'CHKÓ-la' },
      { word: 'час', meaning: 'hora', reading: 'tchas' },
      { word: 'цена', meaning: 'preço', reading: 'tse-NÁ' },
    ],
  },
  {
    id: 'ru-alfa-7',
    title: 'As vogais que carregam um i',
    goal: 'Я, Ю, Ё e o Ы — a única vogal russa que o português não tem.',
    letters: [
      { upper: 'Я', lower: 'я', name: 'ia', sound: 'iá — "я" sozinho quer dizer "eu"' },
      { upper: 'Ю', lower: 'ю', name: 'iu', sound: 'iu de "miúdo"' },
      { upper: 'Ё', lower: 'ё', name: 'iô', sound: 'iô — e sempre puxa a tônica' },
      { upper: 'Й', lower: 'й', name: 'i curto', sound: 'i bem curto, como o final de "pai"' },
      {
        upper: 'Ы',
        lower: 'ы',
        name: 'ы',
        sound: 'um i puxado para trás, entre "i" e "u"',
        trap: 'Não existe em português. É a letra que mais custa — vale praticar em voz alta.',
      },
      { upper: 'Щ', lower: 'щ', name: 'chtcha', sound: 'ch mais longo e mais suave que Ш' },
    ],
    words: [
      { word: 'я', meaning: 'eu', reading: 'iá' },
      { word: 'ты', meaning: 'tu', reading: 'ty' },
      { word: 'рыба', meaning: 'peixe', reading: 'RY-ba' },
      { word: 'чай', meaning: 'chá', reading: 'tchai' },
      { word: 'борщ', meaning: 'borsch (a sopa)', reading: 'borshtch' },
    ],
  },
  {
    id: 'ru-alfa-8',
    title: 'Os dois sinais que não têm som',
    goal: 'Fechar o alfabeto: Ь e Ъ não se pronunciam — mudam a letra vizinha.',
    letters: [
      {
        upper: 'Ь',
        lower: 'ь',
        name: 'sinal fraco',
        sound: 'nenhum — amolece a consoante anterior',
        trap: 'Não é uma letra que se lê. "мать" não tem som depois do t: ele só fica mais suave.',
      },
      {
        upper: 'Ъ',
        lower: 'ъ',
        name: 'sinal forte',
        sound: 'nenhum — separa a consoante da vogal seguinte',
        trap: 'Raríssimo. Só aparece no meio de palavra, e serve para impedir o amolecimento.',
      },
    ],
    words: [
      { word: 'мать', meaning: 'mãe (formal)', reading: 'matʲ' },
      { word: 'день', meaning: 'dia', reading: 'dienʲ' },
      { word: 'соль', meaning: 'sal', reading: 'solʲ' },
      { word: 'письмо', meaning: 'carta', reading: 'pisʲ-MÓ' },
      { word: 'семья', meaning: 'família', reading: 'sie-MIÁ' },
    ],
  },
];

/** Todas as letras ja apresentadas ate uma licao, inclusive. */
export function lettersUpTo(lessonId: string): CyrillicLetter[] {
  const index = CYRILLIC_LESSONS.findIndex((l) => l.id === lessonId);
  if (index < 0) return [];
  return CYRILLIC_LESSONS.slice(0, index + 1).flatMap((l) => l.letters);
}

export function findAlphabetLesson(id: string): AlphabetLesson | undefined {
  return CYRILLIC_LESSONS.find((l) => l.id === id);
}

/**
 * O prefixo separa o progresso de alfabeto do de estrutura e do de gramatica
 * dentro de `grammar_progress`, que ja guarda os tres. Mesma convencao do
 * `structure:`.
 */
export function alphabetTopicId(lessonId: string): string {
  return `alphabet:${lessonId}`;
}
