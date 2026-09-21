import { CYRILLIC_LESSONS } from '../alphabet/cyrillic.catalog';

/**
 * Material de CONSULTA, em oposicao a material de aula.
 *
 * A trilha de alfabeto serve uma licao por dia e e uma escada: ela decide o
 * que voce ve e quando. Isso e certo para aprender e inutil para lembrar --
 * quando o aluno trava numa letra no meio de outro bloco, ele nao quer uma
 * licao, quer a tabela. Nao havia onde olhar.
 *
 * Por isso este modulo NAO tem progresso proprio, nao pontua e nao entra na
 * sessao. Ele e a tabela na parede. O progresso que aparece na tela vem da
 * trilha, so para o aluno saber o que ja passou.
 *
 * A unidade e a SECAO, e ela agrupa por confusao, nao por ordem oficial: o
 * alfabeto cirilico aqui vem na ordem em que as armadilhas aparecem, e nao de
 * А a Я, porque quem consulta esta procurando "aquela que parece um P".
 */

export interface ReferenceEntry {
  /** A letra, o digrafo ou a combinacao. */
  symbol: string;
  /** Como se chama, quando tem nome proprio. */
  name?: string;
  /** O som, ancorado numa palavra portuguesa. */
  sound: string;
  /** Uma palavra onde ela aparece. */
  example?: string;
  exampleMeaning?: string;
  /** Como ela se le, para quem ainda nao decodifica sozinho. */
  exampleReading?: string;
  /** O engano provavel. So quem parece outra coisa ganha este campo. */
  trap?: string;
}

export interface ReferenceSection {
  id: string;
  title: string;
  /** Uma linha dizendo o que junta estas entradas. */
  note?: string;
  entries: ReferenceEntry[];
}

export interface Reference {
  languageCode: string;
  title: string;
  intro: string;
  sections: ReferenceSection[];
  /**
   * Vale oferecer a ordem alfabetica como alternativa?
   *
   * Para o alfabeto sim -- procurar uma letra numa lista ordenada e o caso de
   * uso. Para regras de leitura nao: "ordem alfabetica de ditongos" nao ajuda
   * ninguem a achar nada.
   */
  sortable: boolean;
}

/**
 * O alfabeto cirilico inteiro, montado a partir da MESMA fonte da trilha.
 *
 * Derivado, e nao copiado: duas tabelas do alfabeto russo divergiriam no dia
 * em que alguem corrigisse uma ancora de som em uma delas, e o aluno passaria
 * a ver a letra Ж com dois sons diferentes conforme a tela.
 */
function cyrillicReference(): Reference {
  return {
    languageCode: 'ru',
    title: 'Alfabeto cirílico',
    intro:
      'As 33 letras, na ordem em que as armadilhas aparecem — não de А a Я. Quem consulta está procurando "aquela que parece um P".',
    sortable: true,
    sections: CYRILLIC_LESSONS.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      note: lesson.goal,
      entries: lesson.letters.map((letter) => {
        // A palavra de exemplo sai da propria licao, entao ela usa so letras
        // que o aluno ja teria visto ate ali.
        const word = lesson.words.find((w) => w.word.toLowerCase().includes(letter.lower));
        return {
          symbol: `${letter.upper} ${letter.lower}`,
          name: letter.name,
          sound: letter.sound,
          example: word?.word,
          exampleMeaning: word?.meaning,
          exampleReading: word?.reading,
          trap: letter.trap,
        };
      }),
    })),
  };
}

/**
 * Como se le o alemao.
 *
 * Este e o analogo direto do alfabeto cirilico, e nao a tabela de casos. O
 * problema do russo e nao conseguir DECODIFICAR; o do alemao e decodificar
 * com confianca e errado -- ele le as mesmas letras latinas de sempre e
 * pronuncia "ja" como "já", "ein" como "ein", "Zeit" como "zeit". Erro
 * confiante nao se corrige com exposicao, e por isso precisa de tabela.
 *
 * A tabela de casos (der/den/dem/des) e a consulta seguinte, e ela entra
 * quando o aluno chegar la -- hoje ele esta na licao 1, e um quadro de quatro
 * por quatro agora seria ruido.
 */
const GERMAN_SOUNDS: Reference = {
  languageCode: 'de',
  title: 'Como se lê o alemão',
  intro:
    'As letras são as mesmas do português, e é isso que engana: metade delas soa diferente. Esta é a lista do que se lê errado com confiança.',
  sortable: false,
  sections: [
    {
      id: 'de-ditongos',
      title: 'Os pares de vogais',
      note: 'A regra que resolve quase todos: num par de vogais, vale o som da SEGUNDA letra.',
      entries: [
        {
          symbol: 'ei',
          sound: 'ai',
          example: 'nein',
          exampleMeaning: 'não',
          exampleReading: 'nain',
          trap: 'É o contrário do que o olho pede. "Zeit" é "tsait", "kein" é "kain".',
        },
        {
          symbol: 'ie',
          sound: 'i longo',
          example: 'sie',
          exampleMeaning: 'ela',
          exampleReading: 'zi',
          trap: 'O "e" não soa. E repare: "ie" e "ei" são opostos, e é aí que todo mundo tropeça.',
        },
        {
          symbol: 'eu / äu',
          sound: 'ói',
          example: 'heute',
          exampleMeaning: 'hoje',
          exampleReading: 'HÓI-te',
        },
        {
          symbol: 'au',
          sound: 'au, como em "mau"',
          example: 'auch',
          exampleMeaning: 'também',
          exampleReading: 'aurr',
        },
      ],
    },
    {
      id: 'de-trema',
      title: 'As vogais com trema',
      note: 'Três sons que o português não tem. Todos se fazem com a boca numa vogal e a língua noutra.',
      entries: [
        {
          symbol: 'ä',
          sound: 'é de "pé"',
          example: 'Mädchen',
          exampleMeaning: 'menina',
          exampleReading: 'MÉT-chen',
        },
        {
          symbol: 'ö',
          sound: 'diga "ê" com a boca arredondada de "ô"',
          example: 'möchte',
          exampleMeaning: 'quero',
          exampleReading: 'MÖSH-te',
        },
        {
          symbol: 'ü',
          sound: 'diga "i" com a boca arredondada de "u"',
          example: 'müde',
          exampleMeaning: 'cansado',
          exampleReading: 'MÜ-de',
        },
      ],
    },
    {
      id: 'de-consoantes',
      title: 'As consoantes que trocam de som',
      note: 'Aqui mora a maior parte dos enganos: a letra existe em português com outro valor.',
      entries: [
        {
          symbol: 'w',
          sound: 'v de "vida"',
          example: 'Wasser',
          exampleMeaning: 'água',
          exampleReading: 'VÁ-ser',
          trap: 'Nunca tem som de "u". "wir" é "vir".',
        },
        {
          symbol: 'v',
          sound: 'f de "faca"',
          example: 'viele',
          exampleMeaning: 'muitos',
          exampleReading: 'FÍ-le',
          trap: 'O par w/v é trocado em relação ao português — os dois ao mesmo tempo.',
        },
        {
          symbol: 'z',
          sound: 'ts de "tsunami"',
          example: 'Zeit',
          exampleMeaning: 'tempo',
          exampleReading: 'tsait',
          trap: 'Nunca tem o som de "z" de "zebra".',
        },
        {
          symbol: 'j',
          sound: 'i de "iate"',
          example: 'ja',
          exampleMeaning: 'sim',
          exampleReading: 'iá',
          trap: 'Nada do "j" de "janela".',
        },
        {
          symbol: 's',
          sound: 'z de "casa", quando vem antes de vogal',
          example: 'sie',
          exampleMeaning: 'ela',
          exampleReading: 'zi',
        },
        {
          symbol: 'ß',
          sound: 's forte, como "ss"',
          example: 'muss',
          exampleMeaning: 'preciso',
          exampleReading: 'mus',
          trap: 'Não é um "B" nem um "beta". É só um "ss" com uma letra só.',
        },
      ],
    },
    {
      id: 'de-combinacoes',
      title: 'As combinações',
      note: 'Grupos de letras que viram um som só — e o "ch", que vira dois sons diferentes.',
      entries: [
        {
          symbol: 'ch (depois de a, o, u)',
          sound: 'rr de "carro", raspado na garganta',
          example: 'Buch',
          exampleMeaning: 'livro',
          exampleReading: 'burr',
        },
        {
          symbol: 'ch (depois de e, i, ä, ö, ü)',
          sound: 'um chiado leve, soprado — quase um "sh"',
          example: 'ich',
          exampleMeaning: 'eu',
          exampleReading: 'ish',
          trap: 'É a mesma dupla de letras da linha de cima, com som diferente. Quem manda é a vogal ANTES dela.',
        },
        {
          symbol: 'sch',
          sound: 'ch de "chave"',
          example: 'Schule',
          exampleMeaning: 'escola',
          exampleReading: 'CHÚ-le',
        },
        {
          symbol: 'sp- / st- (no começo da palavra)',
          sound: 'shp / sht',
          example: 'Stuhl',
          exampleMeaning: 'cadeira',
          exampleReading: 'chtul',
          trap: 'Só no começo. No meio ou no fim, "st" é "st" mesmo.',
        },
        {
          symbol: '-ig (no fim)',
          sound: '-ish',
          example: 'richtig',
          exampleMeaning: 'certo',
          exampleReading: 'RISH-tish',
        },
        {
          symbol: 'h (depois de vogal)',
          sound: 'nenhum — só alonga a vogal',
          example: 'wohnen',
          exampleMeaning: 'morar',
          exampleReading: 'VÔ-nen',
          trap: 'O "h" só sopra no COMEÇO da palavra. No meio ele é mudo.',
        },
      ],
    },
    {
      id: 'de-tonica',
      title: 'Onde cai a força',
      note: 'Uma regra só, e ela acerta a grande maioria das palavras.',
      entries: [
        {
          symbol: '1ª sílaba',
          sound: 'a força quase sempre cai na primeira sílaba',
          example: 'Arbeit',
          exampleMeaning: 'trabalho',
          exampleReading: 'AR-bait',
        },
        {
          symbol: 'palavra composta',
          sound: 'a força fica na primeira PARTE, não na primeira sílaba do todo',
          example: 'Haustür',
          exampleMeaning: 'porta de casa',
          exampleReading: 'HAUS-tür',
        },
      ],
    },
  ],
};

/** Os idiomas que tem material de consulta. */
export const REFERENCES: Record<string, () => Reference> = {
  ru: cyrillicReference,
  de: () => GERMAN_SOUNDS,
};

export function referenceFor(languageCode: string): Reference | undefined {
  return REFERENCES[languageCode]?.();
}

/** Todas as entradas de uma referencia, sem as secoes -- para a ordem alfabetica. */
export function flatEntries(reference: Reference): ReferenceEntry[] {
  return reference.sections.flatMap((s) => s.entries);
}
