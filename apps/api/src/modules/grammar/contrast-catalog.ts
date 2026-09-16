/**
 * Catalogo de contrastes gramaticais.
 *
 * A ideia do modulo: o aluno estuda quatro idiomas ao mesmo tempo, e a confusao
 * quase nunca esta dentro de um idioma isolado -- esta no descompasso entre
 * eles. Quem fala portugues e quer "estar" em ingles nao tem um problema de
 * ingles, tem um problema de mapeamento. Por isso cada topico aqui descreve UM
 * conceito atraves dos cinco idiomas de uma vez -- os quatro de estudo mais o
 * portugues.
 *
 * Por que curado e nao gerado por IA: uma explicacao gramatical errada e pior
 * que nenhuma -- o aluno decora a regra torta e leva anos para desaprender. O
 * mapa (quem se parece com quem, e onde) fica fixo aqui; a IA so gera exemplos
 * e exercicios EM CIMA deste mapa, nunca o mapa em si.
 *
 * A chave de tudo e `groups`: a particao dos idiomas por comportamento. Dela
 * saem sozinhos o idioma que CONFIRMA a intuicao do aluno e o que CONTRASTA
 * com ela -- ver `supportFor`.
 */

export type Lang = 'pt' | 'en' | 'es' | 'de' | 'ru';

/** Os quatro que o aluno estuda. O portugues e a lingua materna, o apoio. */
export const STUDY_LANGUAGES: readonly Lang[] = ['en', 'es', 'de', 'ru'] as const;

export const LANG_NAME: Record<Lang, string> = {
  pt: 'português',
  en: 'inglês',
  es: 'espanhol',
  de: 'alemão',
  ru: 'russo',
};

/** Uma mesma frase escrita nos cinco idiomas, para comparacao lado a lado. */
export interface ContrastExample {
  /** O que a frase quer dizer, em portugues corrido. */
  gloss: string;
  pt: string;
  en: string;
  es: string;
  de: string;
  ru: string;
  /** Onde esta a diferenca, em uma linha. */
  note?: string;
}

/** O erro classico de interferencia entre os idiomas neste topico. */
export interface ContrastTrap {
  wrong: string;
  right: string;
  why: string;
}

export interface ContrastTopic {
  id: string;
  title: string;
  /** A duvida do aluno, escrita como ele a formularia. */
  question: string;
  /** Idiomas para os quais este topico faz sentido como ALVO de estudo. */
  targets: Lang[];
  /**
   * Particao dos idiomas por comportamento: idiomas no mesmo grupo resolvem o
   * conceito de forma parecida. E so isto que decide quem ajuda e quem
   * contrasta -- nada mais no catalogo precisa saber dessa escolha.
   */
  groups: Lang[][];
  /** Como cada idioma resolve o conceito, em uma frase. */
  behavior: Record<Lang, string>;
  examples: ContrastExample[];
  trap?: ContrastTrap;
  /**
   * Analogia parcial, para quando o alvo esta sozinho no seu grupo e nenhum
   * outro idioma confirma a intuicao. E o que evita que o topico pareca
   * arbitrario ("alemao e assim porque sim").
   */
  bridge?: string;
  level: 'A1' | 'A2' | 'B1' | 'B2';
}

export const CONTRAST_TOPICS: ContrastTopic[] = [
  {
    id: 'ser-estar',
    title: 'Ser e estar viram um verbo só',
    question: 'Se "ser" e "estar" são coisas diferentes, por que em inglês os dois são "to be"?',
    targets: ['en', 'de', 'ru'],
    groups: [['pt', 'es'], ['en', 'de'], ['ru']],
    behavior: {
      pt: 'Dois verbos: "ser" para o que define, "estar" para o que é estado ou situação.',
      es: 'Igual ao português: ser/estar, com a mesma lógica. Sua intuição funciona quase inteira aqui.',
      en: 'Um verbo só, "to be". A diferença some do verbo e reaparece em outro lugar: no adjetivo, no tempo verbal ou no contexto.',
      de: 'Um verbo só, "sein". Como no inglês, o estado passageiro aparece por outros meios, não pelo verbo.',
      ru: 'Nenhum verbo. No presente a cópula simplesmente não existe: "Он скучный" é literalmente "ele chato".',
    },
    examples: [
      {
        gloss: 'característica permanente',
        pt: 'Ele é chato.',
        en: 'He is boring.',
        es: 'Él es aburrido.',
        de: 'Er ist langweilig.',
        ru: 'Он скучный.',
      },
      {
        gloss: 'estado passageiro — mesmo adjetivo, sentido oposto',
        pt: 'Ele está entediado.',
        en: 'He is bored.',
        es: 'Él está aburrido.',
        de: 'Er langweilt sich.',
        ru: 'Ему скучно.',
        note: 'Em espanhol muda só o verbo. Em inglês muda o adjetivo (boring/bored). Em alemão vira reflexivo. Em russo a pessoa vai para o dativo e a frase fica impessoal: "a ele está entediante".',
      },
    ],
    trap: {
      wrong: 'I am boring. (querendo dizer "estou entediado")',
      right: 'I am bored.',
      why: 'O inglês não distingue no verbo, então distingue no adjetivo: -ing é o que a coisa causa, -ed é o que você sente. Dizer "I am boring" é se declarar uma pessoa chata.',
    },
    bridge:
      'Olhe a sequência: português e espanhol usam dois verbos, inglês e alemão usam um, e o russo usa zero. Não são quatro sistemas aleatórios, é uma mesma escala de quanto trabalho a língua joga no verbo. Onde o verbo some, o trabalho não desaparece: ele reaparece no adjetivo (bored/boring), no reflexivo (sich langweilen) ou no caso (ему скучно). Ao aprender qualquer um dos três, a pergunta útil não é "qual é o verbo", é "para onde foi a distinção".',
    level: 'A1',
  },
  {
    id: 'separable-verbs',
    title: 'Verbos que se partem ao meio',
    question: 'Por que o alemão joga metade do verbo para o fim da frase?',
    targets: ['de', 'en'],
    groups: [
      ['de', 'en'],
      ['pt', 'es', 'ru'],
    ],
    behavior: {
      de: 'Verbos separáveis: "aufstehen" vira "ich stehe früh auf". O prefixo desgruda e vai para o fim.',
      en: 'Phrasal verbs: "stand up", "give up", "turn on". A partícula também se solta: "turn it on".',
      pt: 'Não existe. O verbo é uma peça só; o sentido extra vem de outro verbo ou de uma locução.',
      es: 'Não existe, igual ao português.',
      ru: 'Tem prefixos que mudam o sentido do verbo (вставать, приходить, уходить), mas eles ficam colados: nunca se soltam para o fim da frase.',
    },
    examples: [
      {
        gloss: 'levantar-se cedo',
        pt: 'Eu me levanto cedo.',
        en: 'I get up early.',
        es: 'Me levanto temprano.',
        de: 'Ich stehe früh auf.',
        ru: 'Я встаю рано.',
        note: 'Inglês e alemão têm as duas peças (get + up / stehe + auf). Português e espanhol resolvem com reflexivo. O russo tem o prefixo (в-ставать), mas grudado.',
      },
      {
        gloss: 'desistir',
        pt: 'Não desista.',
        en: "Don't give up.",
        es: 'No te rindas.',
        de: 'Gib nicht auf.',
        ru: 'Не сдавайся.',
      },
    ],
    bridge:
      'Este é o caso raro em que o inglês é seu melhor aliado no alemão. "aufstehen" é literalmente "stand up" com as peças na mesma ordem lógica: auf = up, stehen = stand. Se você já aceita que "turn on" vira "turn it on", o alemão está pedindo a mesma coisa.',
    level: 'A2',
  },
  {
    id: 'cases',
    title: 'Os quatro casos do alemão',
    question: 'Por que "der" às vezes vira "den", "dem" ou "des"?',
    targets: ['de', 'ru'],
    groups: [
      ['de', 'ru'],
      ['pt', 'es', 'en'],
    ],
    behavior: {
      de: 'Quatro casos (nominativo, acusativo, dativo, genitivo). O artigo muda de forma conforme a função do substantivo na frase.',
      ru: 'Seis casos, e a marca não vai no artigo (que não existe): vai na terminação do próprio substantivo, do adjetivo e do pronome.',
      pt: 'O substantivo nunca muda de forma. A função vem da posição e das preposições.',
      es: 'Igual ao português.',
      en: 'Igual ao português: a posição na frase é que manda.',
    },
    examples: [
      {
        gloss: 'o cachorro como sujeito',
        pt: 'O cachorro vê o homem.',
        en: 'The dog sees the man.',
        es: 'El perro ve al hombre.',
        de: 'Der Hund sieht den Mann.',
        ru: 'Собака видит человека.',
      },
      {
        gloss: 'o cachorro como objeto',
        pt: 'O homem vê o cachorro.',
        en: 'The man sees the dog.',
        es: 'El hombre ve al perro.',
        de: 'Der Mann sieht den Hund.',
        ru: 'Человек видит собаку.',
        note: 'Alemão e russo marcam quem é visto (den Hund, собаку). Em português, espanhol e inglês a palavra é idêntica — só mudou de lugar.',
      },
    ],
    bridge:
      'Você já usa casos todos os dias, só que apenas nos pronomes: "eu" vira "me" e "mim" conforme a função ("eu vi", "me viu", "para mim"). Em inglês é o mesmo: I / me. Alemão e russo não inventaram nada — estenderam a TODOS os substantivos aquilo que o português faz com meia dúzia de pronomes. E estudar os dois juntos é a sua maior vantagem aqui: é a mesma ideia com duas roupas, e cada vez que você entende um caso alemão está entendendo o russo também.',
    trap: {
      wrong: 'Ich sehe der Mann.',
      right: 'Ich sehe den Mann.',
      why: 'Quem é visto é objeto direto, então vai para o acusativo. É a mesma lógica de dizer "ele me viu" e não "ele eu viu".',
    },
    level: 'A1',
  },
  {
    id: 'subject-drop',
    title: 'Quando o sujeito pode sumir',
    question: 'Por que preciso repetir "I", "you", "he" toda hora se em português eu simplesmente omito?',
    targets: ['en', 'de'],
    groups: [
      ['pt', 'es', 'ru'],
      ['en', 'de'],
    ],
    behavior: {
      pt: 'O sujeito pode sumir: a terminação do verbo já diz quem fala. "Falo português."',
      es: 'Igual ao português, e ainda mais frequente. "Hablo español."',
      ru: 'O pronome pode cair, porque o verbo conjuga por pessoa — e o russo vai além: em frases impessoais não há sujeito nenhum, nem postiço.',
      en: 'O sujeito é obrigatório. O verbo quase não muda de forma, então sem o pronome ninguém sabe quem é.',
      de: 'O sujeito é obrigatório, mesmo com o verbo bem conjugado.',
    },
    examples: [
      {
        gloss: 'eu falo três idiomas',
        pt: 'Falo três idiomas.',
        en: 'I speak three languages.',
        es: 'Hablo tres idiomas.',
        de: 'Ich spreche drei Sprachen.',
        ru: 'Говорю на трёх языках.',
        note: 'Português, espanhol e russo dispensam o pronome. Inglês e alemão não.',
      },
      {
        gloss: 'está chovendo',
        pt: 'Está chovendo.',
        en: 'It is raining.',
        es: 'Está lloviendo.',
        de: 'Es regnet.',
        ru: 'Идёт дождь.',
        note: 'Aqui nem existe sujeito de verdade, mas inglês e alemão inventam um ("it", "es") só para preencher a vaga. O russo nem isso: literalmente "vai chuva".',
      },
    ],
    trap: {
      wrong: 'Is raining today.',
      right: 'It is raining today.',
      why: 'A frase em inglês precisa de um sujeito mesmo quando não há ninguém agindo. O "it" não significa nada — ele só ocupa o lugar.',
    },
    level: 'A1',
  },
  {
    id: 'gender',
    title: 'O gênero das palavras não combina entre os idiomas',
    question: 'Se "ponte" é feminina em português, por que "el puente" é masculino?',
    targets: ['de', 'es', 'ru'],
    // Agrupado por TER ou nao ter genero, e nao por quantos generos: o que o
    // aluno precisa confirmar e a categoria ("substantivo carrega genero"), e
    // e nisso que portugues, espanhol e alemao concordam. Que o alemao tenha
    // um terceiro genero e que os generos nao batam entre si e justamente a
    // licao -- ela vive nos exemplos, nao na particao.
    groups: [['pt', 'es', 'de', 'ru'], ['en']],
    behavior: {
      pt: 'Dois gêneros: masculino e feminino. Todo substantivo tem um.',
      es: 'Dois gêneros também — mas nem sempre os mesmos do português.',
      ru: 'Três gêneros, como o alemão, mas com uma vantagem enorme: a terminação quase sempre entrega qual é (consoante = masculino, -а/-я = feminino, -о/-е = neutro).',
      de: 'Três gêneros: der (masculino), die (feminino), das (neutro). E o neutro pega coisas que você juraria ter gênero.',
      en: 'Nenhum. "The" serve para tudo, e essa é uma das poucas coisas que o inglês simplificou.',
    },
    examples: [
      {
        gloss: 'a ponte',
        pt: 'a ponte',
        en: 'the bridge',
        es: 'el puente',
        de: 'die Brücke',
        ru: 'мост',
        note: 'Feminina em português e alemão, masculina em espanhol e em russo. Não há lógica a extrair entre as línguas — há que aprender cada palavra já com o gênero.',
      },
      {
        gloss: 'a menina',
        pt: 'a menina',
        en: 'the girl',
        es: 'la niña',
        de: 'das Mädchen',
        ru: 'девочка',
        note: 'Em alemão "menina" é NEUTRO: o diminutivo -chen neutraliza o gênero, mesmo contra o sentido. Em russo o -а entrega o feminino, e aqui a terminação e o sentido concordam.',
      },
    ],
    trap: {
      wrong: 'la puente / el Brücke',
      right: 'el puente / die Brücke',
      why: 'O espanhol parece português o suficiente para você baixar a guarda — e é exatamente aí que o gênero troca. Aprenda todo substantivo já com o artigo colado.',
    },
    level: 'A1',
  },
  {
    id: 'present-perfect',
    title: 'O passado que ainda toca o presente',
    question: 'Quando uso "I did" e quando uso "I have done"?',
    targets: ['en', 'de', 'es', 'ru'],
    groups: [['en'], ['es'], ['de'], ['pt'], ['ru']],
    behavior: {
      en: 'Present perfect ("I have eaten") para o que ainda respinga no agora; simple past ("I ate") para o que está fechado. Marcador de tempo encerrado exige simple past.',
      es: 'Pretérito perfecto ("he comido") para hoje, esta semana, este ano; indefinido ("comí") para períodos encerrados. A régua é o período, não a consequência.',
      de: 'Perfekt ("ich habe gegessen") é o passado FALADO padrão, sem nuance nenhuma. O Präteritum fica para a escrita.',
      pt: 'Cuidado: "tenho comido" NÃO é o present perfect. Em português isso virou hábito repetido, sentido que nenhum dos outros tem.',
      ru: 'Não existe tempo composto nenhum: um único passado, e a nuance de "concluído" vem do ASPECTO do verbo (поел = comi e acabou; ел = estava comendo).',
    },
    examples: [
      {
        gloss: 'eu comi — agora há pouco, ainda estou satisfeito',
        pt: 'Eu comi.',
        en: 'I have eaten.',
        es: 'He comido.',
        de: 'Ich habe gegessen.',
        ru: 'Я поел.',
      },
      {
        gloss: 'eu comi ontem — período fechado',
        pt: 'Eu comi ontem.',
        en: 'I ate yesterday.',
        es: 'Comí ayer.',
        de: 'Ich habe gestern gegessen.',
        ru: 'Вчера я поел.',
        note: 'O inglês é obrigado a trocar para o simple past por causa do "yesterday". Alemão e russo não mudam nada.',
      },
    ],
    bridge:
      'Este é o tópico em que cada idioma se comporta de um jeito diferente — por isso ele confunde tanto. Mas a FORMA é a mesma em quatro deles: verbo auxiliar "ter/haver" + particípio (tenho comido / have eaten / he comido / habe gegessen). Você não precisa aprender a construir nada novo; precisa aprender só QUANDO cada língua a usa. Em inglês a régua é a consequência no presente, em espanhol é o período de tempo, em alemão não há régua nenhuma (é o passado falado padrão) e em português a forma foi sequestrada para significar hábito repetido. O russo fica fora dessa conta: ele não tem a forma, e resolve tudo pelo aspecto do verbo.',
    trap: {
      wrong: 'I have eaten yesterday.',
      right: 'I ate yesterday.',
      why: 'Em alemão "Ich habe gestern gegessen" é perfeito, e é daí que vem o erro. Mas o inglês proíbe present perfect junto de um marcador de tempo encerrado.',
    },
    level: 'A2',
  },
  {
    id: 'word-order',
    title: 'Onde o verbo tem que ficar',
    question: 'Por que o verbo em alemão às vezes vai para o fim da frase?',
    targets: ['de', 'en'],
    groups: [['de'], ['en'], ['pt', 'es', 'ru']],
    behavior: {
      de: 'O verbo conjugado é sempre o SEGUNDO elemento da frase principal. Em oração subordinada ele vai para o fim.',
      en: 'Ordem rígida sujeito-verbo-objeto. Mudar a ordem muda o sentido ou quebra a frase.',
      pt: 'Ordem flexível: dá para mover elementos por ênfase sem quebrar nada.',
      es: 'Flexível como o português.',
      ru: 'A mais livre das cinco, e por um motivo: o caso já diz quem faz o quê, então a ordem sobra para marcar o que é novidade na frase.',
    },
    examples: [
      {
        gloss: 'hoje eu vou ao cinema',
        pt: 'Hoje eu vou ao cinema.',
        en: 'Today I go to the cinema.',
        es: 'Hoy voy al cine.',
        de: 'Heute gehe ich ins Kino.',
        ru: 'Сегодня я иду в кино.',
        note: 'Em alemão, começar com "Heute" empurra o sujeito para depois do verbo: o verbo defende a segunda posição. Em russo começar por "Сегодня" não mexe em mais nada.',
      },
      {
        gloss: 'eu sei que ele vem hoje',
        pt: 'Eu sei que ele vem hoje.',
        en: 'I know that he comes today.',
        es: 'Sé que él viene hoy.',
        de: 'Ich weiß, dass er heute kommt.',
        ru: 'Я знаю, что он сегодня придёт.',
        note: 'Depois de "dass" o verbo alemão desce para o fim da oração. Depois de "что", em russo, não muda nada — igual ao português.',
      },
    ],
    bridge:
      'O inglês guarda um resto da mesma regra, só que restrito: quando algo negativo abre a frase, o verbo pula na frente do sujeito — "Never have I seen that", "Only then did he understand". É exatamente a inversão do alemão ("Heute gehe ich"), só que o inglês a reduziu a um punhado de casos e o alemão a aplica sempre. Não é uma regra estrangeira: é uma regra que o inglês quase perdeu.',
    trap: {
      wrong: 'Heute ich gehe ins Kino.',
      right: 'Heute gehe ich ins Kino.',
      why: 'Português e inglês deixam você começar com "hoje" sem mexer em mais nada. O alemão cobra o preço: se algo ocupa a primeira posição, o sujeito passa para depois do verbo.',
    },
    level: 'A2',
  },
  {
    id: 'negation',
    title: 'Negar duas vezes',
    question: 'Por que "I don\'t know nothing" está errado, se em português a dupla negação é o certo?',
    targets: ['en', 'de'],
    groups: [
      ['pt', 'es', 'ru'],
      ['en', 'de'],
    ],
    behavior: {
      pt: 'A dupla negação é obrigatória: "não vi nada". Uma negação sozinha soa incompleta.',
      es: 'Igual: "no vi nada".',
      ru: 'Obrigatória e ainda mais insistente: todas as palavras negativas se acumulam. "Я никогда ничего никому не говорил" tem quatro negações numa frase só.',
      en: 'Uma negação só. Duas se anulam e viram afirmação — ou soam como fala não padrão.',
      de: 'Uma negação só, e ainda escolhendo entre "nicht" (nega verbo ou frase) e "kein" (nega substantivo).',
    },
    examples: [
      {
        gloss: 'eu não vi nada',
        pt: 'Não vi nada.',
        en: "I didn't see anything.",
        es: 'No vi nada.',
        de: 'Ich habe nichts gesehen.',
        ru: 'Я ничего не видел.',
        note: 'Português, espanhol e russo negam duas vezes. O inglês troca "nothing" por "anything" para negar uma vez só.',
      },
      {
        gloss: 'eu não tenho carro',
        pt: 'Não tenho carro.',
        en: "I don't have a car.",
        es: 'No tengo coche.',
        de: 'Ich habe kein Auto.',
        ru: 'У меня нет машины.',
        note: 'Aqui o alemão usa "kein", não "nicht", porque o que está sendo negado é o substantivo. O russo muda a frase inteira: "нет" exige o genitivo (машины), e não há verbo "ter".',
      },
    ],
    trap: {
      wrong: "I don't know nothing.",
      right: "I don't know anything.",
      why: 'A tradução literal do português produz exatamente esta frase, e em inglês padrão ela significa o contrário: que você sabe alguma coisa.',
    },
    level: 'A2',
  },
  {
    id: 'have-age',
    title: 'Ter ou ser uma idade',
    question: 'Por que em inglês eu "sou" 30 anos em vez de "ter" 30 anos?',
    targets: ['en', 'de'],
    // O alemao fica do lado do INGLES aqui: "ich bin 30 Jahre alt" usa sein,
    // nao haben. E o alemao que confirma a estranheza do ingles, e nao o
    // contrario -- estudando ingles, ele e o aliado. O russo fica sozinho: nao
    // usa nem ter nem ser, poe a pessoa no dativo.
    groups: [['pt', 'es'], ['en', 'de'], ['ru']],
    behavior: {
      pt: 'A idade se TEM: "tenho 30 anos".',
      es: 'Igual: "tengo 30 años".',
      ru: 'Nem ter nem ser: a pessoa vai para o dativo e a frase fica impessoal — "мне тридцать лет", algo como "a mim há trinta anos".',
      de: 'A idade se É, mas com "velho" junto: "ich bin 30 Jahre alt", literalmente "eu sou 30 anos velho".',
      en: 'A idade se É: "I am 30". Ter idade não existe como construção.',
    },
    examples: [
      {
        gloss: 'eu tenho trinta anos',
        pt: 'Tenho trinta anos.',
        en: 'I am thirty (years old).',
        es: 'Tengo treinta años.',
        de: 'Ich bin dreißig Jahre alt.',
        ru: 'Мне тридцать лет.',
      },
      {
        gloss: 'estou com fome',
        pt: 'Estou com fome.',
        en: 'I am hungry.',
        es: 'Tengo hambre.',
        de: 'Ich habe Hunger.',
        ru: 'Я голоден.',
        note: 'E os blocos se invertem: para fome, o alemão volta para o lado do espanhol (TEM fome) e o russo vai para o lado do inglês (É faminto). Por isso não adianta decorar "alemão é como inglês" — o alinhamento muda de construção para construção.',
      },
    ],
    trap: {
      wrong: 'I have thirty years.',
      right: 'I am thirty.',
      why: 'Vem direto de "tengo treinta años" e de "tenho trinta anos" — as duas línguas que você já tem na cabeça empurram para o mesmo erro. Em inglês a frase soa como se você possuísse trinta anos de alguma coisa.',
    },
    level: 'A1',
  },
  {
    id: 'articles-usage',
    title: 'Quando o artigo aparece e quando some',
    question: 'Por que "a vida é bela" vira "life is beautiful", sem artigo?',
    targets: ['en', 'de', 'es'],
    groups: [['pt', 'es', 'de'], ['en'], ['ru']],
    behavior: {
      pt: 'Usa artigo para falar de algo em geral: "a vida", "os brasileiros", "o amor".',
      es: 'Igual ao português: "la vida es bella".',
      de: 'Também usa: "das Leben ist schön".',
      en: 'Sem artigo para conceitos gerais e substantivos incontáveis: "life is beautiful".',
      ru: 'Não existe artigo nenhum, em nenhum caso. O que o artigo faria — separar o já conhecido do novo — o russo faz pela ordem das palavras.',
    },
    examples: [
      {
        gloss: 'a vida é bela',
        pt: 'A vida é bela.',
        en: 'Life is beautiful.',
        es: 'La vida es bella.',
        de: 'Das Leben ist schön.',
        ru: 'Жизнь прекрасна.',
        note: 'O inglês é o único que solta o artigo aqui por REGRA. O russo solta porque não tem artigo para soltar.',
      },
      {
        gloss: 'eu gosto de música',
        pt: 'Eu gosto de música.',
        en: 'I like music.',
        es: 'Me gusta la música.',
        de: 'Ich mag Musik.',
        ru: 'Я люблю музыку.',
      },
    ],
    bridge:
      'Você já sente essa diferença em português, só que resolvida de outro jeito: "gosto de música" (música em geral, sem artigo) contra "gosto da música que você tocou" (uma música específica, com artigo). A distinção genérico x específico já está na sua cabeça — o inglês apenas a levou a sério em toda parte, enquanto o português só a marca depois de certas preposições.',
    trap: {
      wrong: 'The life is beautiful.',
      right: 'Life is beautiful.',
      why: 'Português, espanhol e alemão pedem o artigo, então três das línguas na sua cabeça votam pelo erro. Em inglês, "the life" só cabe quando é uma vida específica: "the life of a doctor".',
    },
    level: 'A2',
  },
  {
    id: 'false-friends',
    title: 'Palavras que parecem iguais e não são',
    question: 'O espanhol é tão parecido com o português que dá para chutar. Onde isso me trai?',
    targets: ['es'],
    groups: [['pt'], ['es'], ['en'], ['de'], ['ru']],
    behavior: {
      pt: 'Base do falso amigo: a palavra existe e é comum.',
      es: 'A mesma forma existe, mas o sentido escorregou — às vezes para um lugar constrangedor.',
      en: 'Ajuda pouco aqui, mas às vezes revela a origem comum da palavra.',
      de: 'Distante demais para gerar este tipo de erro.',
      ru: 'Distante na forma, mas cria armadilha própria pelos empréstimos internacionais: "магазин" é loja, não revista.',
    },
    examples: [
      {
        gloss: 'grávida / comprido',
        pt: 'Ela está grávida. / A rua é comprida.',
        en: 'She is pregnant. / The street is long.',
        es: 'Ella está embarazada. / La calle es larga.',
        de: 'Sie ist schwanger. / Die Straße ist lang.',
        ru: 'Она беременна. / Улица длинная.',
        note: '"Embarazada" é grávida, não envergonhada. E "largo" é comprido, não largo.',
      },
      {
        gloss: 'escritório / oficina',
        pt: 'o escritório / a oficina mecânica',
        en: 'the office / the workshop',
        es: 'la oficina / el taller',
        de: 'das Büro / die Werkstatt',
        ru: 'офис / мастерская',
        note: '"Oficina" em espanhol é escritório. A oficina mecânica é "taller".',
      },
    ],
    bridge:
      'Use o inglês como desempate. Quando português e espanhol divergem, o inglês costuma ficar do lado do espanhol, porque as duas línguas pegaram a palavra pelo mesmo caminho latino: "oficina" (es) = "office" (en), "largo" (es) = "long" (en), "sensible" (es) = "sensitive" (en). Na dúvida sobre uma palavra espanhola que parece portuguesa, pergunte o que o inglês faz com ela — a resposta acerta com frequência surpreendente.',
    trap: {
      wrong: 'Estoy embarazada. (querendo dizer "estou envergonhada")',
      right: 'Estoy avergonzada.',
      why: 'É o falso amigo mais caro do espanhol para brasileiros. A semelhança com "embaraçada" leva direto ao erro.',
    },
    level: 'A2',
  },
  {
    id: 'subjunctive',
    title: 'O subjuntivo que só metade das línguas tem',
    question: 'Como digo "se eu fosse" ou "espero que ele venha" em inglês e alemão?',
    targets: ['en', 'de', 'es'],
    // Ingles e alemao ficam juntos: os dois perderam o subjuntivo produtivo e
    // resolvem hipotese com auxiliar (would/wurde) mais uma forma fossil
    // (were/ware). Separa-los por causa do Konjunktiv II seria uma distincao
    // de gramatico, nao de aluno -- para quem estuda, a estrategia e a mesma.
    // O russo fica sozinho porque nem forma verbal ele tem: e uma particula.
    groups: [['pt', 'es'], ['en', 'de'], ['ru']],
    behavior: {
      pt: 'Subjuntivo vivo e obrigatório, com três tempos: que eu fale, se eu falasse, quando eu falar.',
      es: 'Igual ao português, quase forma por forma. É o seu maior atalho no espanhol.',
      ru: 'Não há subjuntivo: a partícula "бы" junto do passado cobre toda hipótese, em qualquer pessoa e qualquer tempo. É o sistema mais simples dos cinco.',
      de: 'Konjunktiv II, usado para hipóteses e pedidos educados — em geral com "würde".',
      en: 'Praticamente extinto. Sobrou "if I were" e pouco mais; o resto vira infinitivo ou modal.',
    },
    examples: [
      {
        gloss: 'espero que ele venha',
        pt: 'Espero que ele venha.',
        en: 'I hope he comes.',
        es: 'Espero que venga.',
        de: 'Ich hoffe, dass er kommt.',
        ru: 'Надеюсь, что он придёт.',
        note: 'Só português e espanhol mudam a forma do verbo. Inglês, alemão e russo usam o presente (ou o futuro) normal.',
      },
      {
        gloss: 'se eu fosse rico',
        pt: 'Se eu fosse rico...',
        en: 'If I were rich...',
        es: 'Si fuera rico...',
        de: 'Wenn ich reich wäre...',
        ru: 'Если бы я был богат...',
        note: 'Aqui todos marcam a hipótese. É o último reduto do subjuntivo inglês — e em russo a marca é só a partícula "бы".',
      },
    ],
    bridge:
      '"Would" e "würde" são a mesma palavra, herdada da mesma raiz germânica, e fazem o mesmo trabalho: carregar a hipótese que o verbo sozinho não carrega mais. O mesmo vale para o par que sobreviveu — "if I were" e "wenn ich wäre". Quando o inglês te obrigar a usar "would", o alemão vai pedir "würde" quase no mesmo lugar.',
    trap: {
      wrong: 'I hope that he come.',
      right: 'I hope he comes.',
      why: 'A tentação é traduzir o subjuntivo português por uma forma "especial" em inglês. Não existe: o verbo fica no presente comum, com o -s da terceira pessoa.',
    },
    level: 'B1',
  },
  {
    id: 'adjective-position',
    title: 'Antes ou depois do substantivo',
    question: 'Digo "casa branca" ou "branca casa"?',
    targets: ['en', 'de', 'ru'],
    groups: [
      ['en', 'de', 'ru'],
      ['pt', 'es'],
    ],
    behavior: {
      en: 'O adjetivo vem SEMPRE antes do substantivo. Sem exceção prática.',
      de: 'Também antes — e ainda declina conforme gênero, número e caso.',
      ru: 'Antes também, e declinando por gênero, número e caso — exatamente como o alemão.',
      pt: 'Normalmente depois. Antes é possível e muda a nuance ("um grande homem" x "um homem grande").',
      es: 'Como o português.',
    },
    examples: [
      {
        gloss: 'a casa branca',
        pt: 'a casa branca',
        en: 'the white house',
        es: 'la casa blanca',
        de: 'das weiße Haus',
        ru: 'белый дом',
      },
      {
        gloss: 'um carro vermelho velho',
        pt: 'um carro vermelho velho',
        en: 'an old red car',
        es: 'un coche rojo viejo',
        de: 'ein altes rotes Auto',
        ru: 'старая красная машина',
        note: 'Inglês, alemão e russo empilham tudo antes; o inglês ainda cobra uma ordem fixa (idade antes de cor).',
      },
    ],
    trap: {
      wrong: 'the house white',
      right: 'the white house',
      why: 'Ordem direta do português. Em inglês e alemão o adjetivo nunca fica atrás do substantivo que ele qualifica.',
    },
    level: 'A1',
  },
  {
    id: 'plural',
    title: 'Como se forma o plural',
    question: 'Por que o plural em alemão não segue regra nenhuma?',
    targets: ['de', 'en', 'es', 'ru'],
    groups: [['de'], ['en'], ['pt', 'es'], ['ru']],
    behavior: {
      pt: 'Regular: -s, com ajustes previsíveis (-ão, -l, -m).',
      es: 'Regular: -s depois de vogal, -es depois de consoante.',
      ru: 'A terminação depende do gênero e da última consoante (-ы, -и, -а, -я), e ainda muda de novo conforme o caso da frase. Previsível, mas nunca é só acrescentar uma letra.',
      en: 'Regular: -s ou -es, com um punhado de irregulares antigos (man/men, child/children).',
      de: 'Cinco terminações possíveis (-e, -en, -er, -s, nada) e ainda pode mudar a vogal do meio (Umlaut). Não há como prever.',
    },
    examples: [
      {
        gloss: 'os livros',
        pt: 'os livros',
        en: 'the books',
        es: 'los libros',
        de: 'die Bücher',
        ru: 'книги',
        note: 'Buch vira Bücher: mudou a vogal E ganhou -er. Em russo книга vira книги, trocando a terminação.',
      },
      {
        gloss: 'as mulheres',
        pt: 'as mulheres',
        en: 'the women',
        es: 'las mujeres',
        de: 'die Frauen',
        ru: 'женщины',
        note: 'O inglês também tem irregulares antigos: woman/women, com a mesma lógica de mudar a vogal.',
      },
    ],
    bridge:
      'O plural alemão parece caótico, mas o inglês guarda fósseis do mesmo sistema: man/men, foot/feet, goose/geese mudam a vogal exatamente como Buch/Bücher. As duas línguas herdaram isso da mesma origem germânica — o inglês perdeu quase todos os casos, o alemão manteve. Já o plural russo parece caótico por outro motivo: ele é regular, mas a regra depende de gênero, terminação e caso ao mesmo tempo. Em alemão você memoriza palavra por palavra; em russo você aprende o sistema uma vez.',
    level: 'A1',
  },
  {
    id: 'prepositions-place',
    title: 'In, on, at — e o caso que vem junto',
    question: 'Como escolho a preposição de lugar, se em português é quase sempre "em"?',
    targets: ['en', 'de', 'ru'],
    groups: [['pt', 'es'], ['en'], ['de', 'ru']],
    behavior: {
      pt: '"Em" cobre quase tudo: na casa, na mesa, na estação.',
      es: '"En" cobre quase tudo, igual ao português.',
      en: 'Três preposições disputam o mesmo espaço: in (dentro), on (sobre uma superfície), at (num ponto).',
      de: 'Além de escolher a preposição, você escolhe o CASO: acusativo se há movimento para lá, dativo se é posição parada.',
      ru: 'Mesma mecânica do alemão: a preposição pede um caso, e o caso muda com o movimento — "на кухне" (preposicional, parado) contra "на кухню" (acusativo, indo).',
    },
    examples: [
      {
        gloss: 'estou na cozinha — parado',
        pt: 'Estou na cozinha.',
        en: 'I am in the kitchen.',
        es: 'Estoy en la cocina.',
        de: 'Ich bin in der Küche.',
        ru: 'Я на кухне.',
        note: 'Alemão em dativo (der) e russo em preposicional (кухне), os dois porque não há movimento.',
      },
      {
        gloss: 'vou para a cozinha — movimento',
        pt: 'Vou para a cozinha.',
        en: 'I go into the kitchen.',
        es: 'Voy a la cocina.',
        de: 'Ich gehe in die Küche.',
        ru: 'Я иду на кухню.',
        note: 'Mesma preposição, mas agora acusativo (die / кухню), porque há deslocamento. Alemão e russo cobram a mesma troca.',
      },
    ],
    bridge:
      'O inglês faz uma distinção parecida com in/into e on/onto: "I am in the kitchen" contra "I go into the kitchen". Alemão e russo pegam essa mesma ideia de parado x em movimento e, em vez de trocar a preposição, trocam o caso — e fazem isso do mesmo jeito, o que torna cada um dos dois um atalho para o outro.',
    level: 'B1',
  },
  {
    id: 'modal-verbs',
    title: 'Poder, dever, querer',
    question: 'Por que "I can to go" está errado?',
    targets: ['en', 'de'],
    groups: [
      ['en', 'de'],
      ['pt', 'es', 'ru'],
    ],
    behavior: {
      en: 'Modais (can, must, should) são seguidos de infinitivo SEM "to", e não levam -s na terceira pessoa.',
      de: 'Modais (können, müssen, wollen) mandam o segundo verbo, no infinitivo, para o FIM da frase.',
      pt: 'O verbo seguinte vai no infinitivo, logo depois: "posso ir".',
      es: 'Igual ao português: "puedo ir".',
      ru: 'Infinitivo logo depois, como em português. A pegadinha é outra: "должен" e "нужно" não são verbos, e a obrigação joga a pessoa para o dativo ("мне нужно").',
    },
    examples: [
      {
        gloss: 'eu posso ir',
        pt: 'Eu posso ir.',
        en: 'I can go.',
        es: 'Puedo ir.',
        de: 'Ich kann gehen.',
        ru: 'Я могу пойти.',
      },
      {
        gloss: 'eu tenho que trabalhar hoje',
        pt: 'Eu tenho que trabalhar hoje.',
        en: 'I must work today.',
        es: 'Tengo que trabajar hoy.',
        de: 'Ich muss heute arbeiten.',
        ru: 'Мне нужно сегодня работать.',
        note: 'No alemão, "arbeiten" foi para o fim, depois de "heute". O inglês mantém tudo junto. Em russo o infinitivo fica no fim como no alemão, mas por outro motivo: quem trabalha virou dativo e a frase ficou impessoal.',
      },
    ],
    trap: {
      wrong: 'She can to go. / He cans go.',
      right: 'She can go.',
      why: 'Modal em inglês não leva "to" depois nem "-s" na terceira pessoa. São as duas únicas regras, e as duas contrariam o resto da língua.',
    },
    level: 'A2',
  },
];

/**
 * Quem confirma a intuicao do aluno e quem contrasta com ela.
 *
 * A preferencia e sempre por outro idioma de ESTUDO, nao pelo portugues: o
 * objetivo do modulo e usar os outros idiomas para aprender aquele. O
 * portugues so entra quando nenhum idioma de estudo serve -- e quando entra, e
 * sinal de que a comparacao mais util e mesmo com a lingua materna.
 */
export interface Support {
  /** Idioma que se comporta como o alvo. Null quando o alvo esta sozinho. */
  ally: Lang | null;
  /** Idioma que se comporta de forma diferente do alvo. */
  contrast: Lang | null;
}

export function supportFor(topic: ContrastTopic, target: Lang): Support {
  const own = topic.groups.find((g) => g.includes(target)) ?? [target];
  const ranked = ([...STUDY_LANGUAGES, 'pt'] as Lang[]).filter((l) => l !== target);

  return {
    ally: ranked.find((l) => own.includes(l)) ?? null,
    contrast: ranked.find((l) => !own.includes(l)) ?? null,
  };
}

/** Topicos que fazem sentido estudar tendo `target` como idioma alvo. */
export function topicsFor(target: Lang): ContrastTopic[] {
  return CONTRAST_TOPICS.filter((t) => t.targets.includes(target));
}

export function findTopic(id: string): ContrastTopic | undefined {
  return CONTRAST_TOPICS.find((t) => t.id === id);
}

export function isLang(value: string): value is Lang {
  return (
    value === 'pt' || value === 'en' || value === 'es' || value === 'de' || value === 'ru'
  );
}
