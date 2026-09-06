/**
 * Catalogo de contrastes gramaticais.
 *
 * A ideia do modulo: o aluno estuda tres idiomas ao mesmo tempo, e a confusao
 * quase nunca esta dentro de um idioma isolado -- esta no descompasso entre
 * eles. Quem fala portugues e quer "estar" em ingles nao tem um problema de
 * ingles, tem um problema de mapeamento. Por isso cada topico aqui descreve UM
 * conceito atraves dos quatro idiomas de uma vez.
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

export type Lang = 'pt' | 'en' | 'es' | 'de';

/** Os tres que o aluno estuda. O portugues e a lingua materna, o apoio. */
export const STUDY_LANGUAGES: readonly Lang[] = ['en', 'es', 'de'] as const;

export const LANG_NAME: Record<Lang, string> = {
  pt: 'português',
  en: 'inglês',
  es: 'espanhol',
  de: 'alemão',
};

/** Uma mesma frase escrita nos quatro idiomas, para comparacao lado a lado. */
export interface ContrastExample {
  /** O que a frase quer dizer, em portugues corrido. */
  gloss: string;
  pt: string;
  en: string;
  es: string;
  de: string;
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
    targets: ['en', 'de'],
    groups: [
      ['pt', 'es'],
      ['en', 'de'],
    ],
    behavior: {
      pt: 'Dois verbos: "ser" para o que define, "estar" para o que é estado ou situação.',
      es: 'Igual ao português: ser/estar, com a mesma lógica. Sua intuição funciona quase inteira aqui.',
      en: 'Um verbo só, "to be". A diferença some do verbo e reaparece em outro lugar: no adjetivo, no tempo verbal ou no contexto.',
      de: 'Um verbo só, "sein". Como no inglês, o estado passageiro aparece por outros meios, não pelo verbo.',
    },
    examples: [
      {
        gloss: 'característica permanente',
        pt: 'Ele é chato.',
        en: 'He is boring.',
        es: 'Él es aburrido.',
        de: 'Er ist langweilig.',
      },
      {
        gloss: 'estado passageiro — mesmo adjetivo, sentido oposto',
        pt: 'Ele está entediado.',
        en: 'He is bored.',
        es: 'Él está aburrido.',
        de: 'Er langweilt sich.',
        note: 'Em espanhol muda só o verbo. Em inglês muda o adjetivo (boring/bored). Em alemão vira um verbo reflexivo.',
      },
    ],
    trap: {
      wrong: 'I am boring. (querendo dizer "estou entediado")',
      right: 'I am bored.',
      why: 'O inglês não distingue no verbo, então distingue no adjetivo: -ing é o que a coisa causa, -ed é o que você sente. Dizer "I am boring" é se declarar uma pessoa chata.',
    },
    level: 'A1',
  },
  {
    id: 'separable-verbs',
    title: 'Verbos que se partem ao meio',
    question: 'Por que o alemão joga metade do verbo para o fim da frase?',
    targets: ['de', 'en'],
    groups: [
      ['de', 'en'],
      ['pt', 'es'],
    ],
    behavior: {
      de: 'Verbos separáveis: "aufstehen" vira "ich stehe früh auf". O prefixo desgruda e vai para o fim.',
      en: 'Phrasal verbs: "stand up", "give up", "turn on". A partícula também se solta: "turn it on".',
      pt: 'Não existe. O verbo é uma peça só; o sentido extra vem de outro verbo ou de uma locução.',
      es: 'Não existe, igual ao português.',
    },
    examples: [
      {
        gloss: 'levantar-se cedo',
        pt: 'Eu me levanto cedo.',
        en: 'I get up early.',
        es: 'Me levanto temprano.',
        de: 'Ich stehe früh auf.',
        note: 'Inglês e alemão têm as duas peças (get + up / stehe + auf). Português e espanhol resolvem com um reflexivo.',
      },
      {
        gloss: 'desistir',
        pt: 'Não desista.',
        en: "Don't give up.",
        es: 'No te rindas.',
        de: 'Gib nicht auf.',
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
    targets: ['de'],
    groups: [['de'], ['pt', 'es', 'en']],
    behavior: {
      de: 'Quatro casos (nominativo, acusativo, dativo, genitivo). O artigo muda de forma conforme a função do substantivo na frase.',
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
      },
      {
        gloss: 'o cachorro como objeto',
        pt: 'O homem vê o cachorro.',
        en: 'The man sees the dog.',
        es: 'El hombre ve al perro.',
        de: 'Der Mann sieht den Hund.',
        note: 'Em alemão "Hund" ganhou "den". Em português, espanhol e inglês a palavra é idêntica — só mudou de lugar.',
      },
    ],
    bridge:
      'Você já usa casos todos os dias, só que apenas nos pronomes: "eu" vira "me" e "mim" conforme a função ("eu vi", "me viu", "para mim"). Em inglês é o mesmo: I / me. O alemão não inventou nada — ele estendeu a TODOS os substantivos aquilo que o português faz com meia dúzia de pronomes.',
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
      ['pt', 'es'],
      ['en', 'de'],
    ],
    behavior: {
      pt: 'O sujeito pode sumir: a terminação do verbo já diz quem fala. "Falo português."',
      es: 'Igual ao português, e ainda mais frequente. "Hablo español."',
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
        note: 'Português e espanhol dispensam o pronome. Inglês e alemão não.',
      },
      {
        gloss: 'está chovendo',
        pt: 'Está chovendo.',
        en: 'It is raining.',
        es: 'Está lloviendo.',
        de: 'Es regnet.',
        note: 'Aqui nem existe sujeito de verdade, mas inglês e alemão inventam um ("it", "es") só para preencher a vaga.',
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
    targets: ['de', 'es'],
    // Agrupado por TER ou nao ter genero, e nao por quantos generos: o que o
    // aluno precisa confirmar e a categoria ("substantivo carrega genero"), e
    // e nisso que portugues, espanhol e alemao concordam. Que o alemao tenha
    // um terceiro genero e que os generos nao batam entre si e justamente a
    // licao -- ela vive nos exemplos, nao na particao.
    groups: [['pt', 'es', 'de'], ['en']],
    behavior: {
      pt: 'Dois gêneros: masculino e feminino. Todo substantivo tem um.',
      es: 'Dois gêneros também — mas nem sempre os mesmos do português.',
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
        note: 'Feminina em português e alemão, masculina em espanhol. Não há lógica a extrair — há que memorizar.',
      },
      {
        gloss: 'a menina',
        pt: 'a menina',
        en: 'the girl',
        es: 'la niña',
        de: 'das Mädchen',
        note: 'Em alemão "menina" é NEUTRO: o diminutivo -chen sempre neutraliza o gênero, mesmo contra o sentido.',
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
    targets: ['en', 'de', 'es'],
    groups: [['en'], ['es'], ['de'], ['pt']],
    behavior: {
      en: 'Present perfect ("I have eaten") para o que ainda respinga no agora; simple past ("I ate") para o que está fechado. Marcador de tempo encerrado exige simple past.',
      es: 'Pretérito perfecto ("he comido") para hoje, esta semana, este ano; indefinido ("comí") para períodos encerrados. A régua é o período, não a consequência.',
      de: 'Perfekt ("ich habe gegessen") é o passado FALADO padrão, sem nuance nenhuma. O Präteritum fica para a escrita.',
      pt: 'Cuidado: "tenho comido" NÃO é o present perfect. Em português isso virou hábito repetido, sentido que nenhum dos outros três tem.',
    },
    examples: [
      {
        gloss: 'eu comi — agora há pouco, ainda estou satisfeito',
        pt: 'Eu comi.',
        en: 'I have eaten.',
        es: 'He comido.',
        de: 'Ich habe gegessen.',
      },
      {
        gloss: 'eu comi ontem — período fechado',
        pt: 'Eu comi ontem.',
        en: 'I ate yesterday.',
        es: 'Comí ayer.',
        de: 'Ich habe gestern gegessen.',
        note: 'O inglês é obrigado a trocar para o simple past por causa do "yesterday". O alemão não muda nada.',
      },
    ],
    bridge:
      'Este é o único tópico em que os quatro idiomas se comportam de um jeito diferente cada um — por isso ele confunde tanto. Mas a FORMA é a mesma nos quatro: verbo auxiliar "ter/haver" + particípio (tenho comido / have eaten / he comido / habe gegessen). Você não precisa aprender a construir nada novo; precisa aprender só QUANDO cada língua a usa. Em inglês a régua é a consequência no presente, em espanhol é o período de tempo, em alemão não há régua nenhuma (é o passado falado padrão) e em português a forma foi sequestrada para significar hábito repetido.',
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
    groups: [['de'], ['en'], ['pt', 'es']],
    behavior: {
      de: 'O verbo conjugado é sempre o SEGUNDO elemento da frase principal. Em oração subordinada ele vai para o fim.',
      en: 'Ordem rígida sujeito-verbo-objeto. Mudar a ordem muda o sentido ou quebra a frase.',
      pt: 'Ordem flexível: dá para mover elementos por ênfase sem quebrar nada.',
      es: 'Flexível como o português.',
    },
    examples: [
      {
        gloss: 'hoje eu vou ao cinema',
        pt: 'Hoje eu vou ao cinema.',
        en: 'Today I go to the cinema.',
        es: 'Hoy voy al cine.',
        de: 'Heute gehe ich ins Kino.',
        note: 'Em alemão, começar com "Heute" empurra o sujeito para depois do verbo: o verbo defende a segunda posição.',
      },
      {
        gloss: 'eu sei que ele vem hoje',
        pt: 'Eu sei que ele vem hoje.',
        en: 'I know that he comes today.',
        es: 'Sé que él viene hoy.',
        de: 'Ich weiß, dass er heute kommt.',
        note: 'Depois de "dass" o verbo alemão desce para o fim da oração.',
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
      ['pt', 'es'],
      ['en', 'de'],
    ],
    behavior: {
      pt: 'A dupla negação é obrigatória: "não vi nada". Uma negação sozinha soa incompleta.',
      es: 'Igual: "no vi nada".',
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
        note: 'Português e espanhol negam duas vezes. O inglês troca "nothing" por "anything" para negar uma vez só.',
      },
      {
        gloss: 'eu não tenho carro',
        pt: 'Não tenho carro.',
        en: "I don't have a car.",
        es: 'No tengo coche.',
        de: 'Ich habe kein Auto.',
        note: 'Aqui o alemão usa "kein", não "nicht", porque o que está sendo negado é o substantivo.',
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
    // contrario -- estudando ingles, ele e o aliado.
    groups: [
      ['pt', 'es'],
      ['en', 'de'],
    ],
    behavior: {
      pt: 'A idade se TEM: "tenho 30 anos".',
      es: 'Igual: "tengo 30 años".',
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
      },
      {
        gloss: 'estou com fome',
        pt: 'Estou com fome.',
        en: 'I am hungry.',
        es: 'Tengo hambre.',
        de: 'Ich habe Hunger.',
        note: 'E os blocos se invertem: para fome, o alemão volta para o lado do espanhol (TEM fome) e o inglês fica sozinho (É faminto). Por isso não adianta decorar "alemão é como inglês" — o alinhamento muda de construção para construção.',
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
    groups: [
      ['pt', 'es', 'de'],
      ['en'],
    ],
    behavior: {
      pt: 'Usa artigo para falar de algo em geral: "a vida", "os brasileiros", "o amor".',
      es: 'Igual ao português: "la vida es bella".',
      de: 'Também usa: "das Leben ist schön".',
      en: 'Sem artigo para conceitos gerais e substantivos incontáveis: "life is beautiful".',
    },
    examples: [
      {
        gloss: 'a vida é bela',
        pt: 'A vida é bela.',
        en: 'Life is beautiful.',
        es: 'La vida es bella.',
        de: 'Das Leben ist schön.',
        note: 'O inglês é o único dos quatro que solta o artigo aqui.',
      },
      {
        gloss: 'eu gosto de música',
        pt: 'Eu gosto de música.',
        en: 'I like music.',
        es: 'Me gusta la música.',
        de: 'Ich mag Musik.',
      },
    ],
    bridge:
      'Você já sente essa diferença em português, só que resolvida de outro jeito: "gosto de música" (música em geral, sem artigo) contra "gosto da música que você tocou" (uma música específica, com artigo). A distinção genérico x específico já está na sua cabeça — o inglês apenas a levou a sério em toda parte, enquanto o português só a marca depois de certas preposições.',
    trap: {
      wrong: 'The life is beautiful.',
      right: 'Life is beautiful.',
      why: 'Português, espanhol e alemão pedem o artigo, então três das quatro línguas na sua cabeça votam pelo erro. Em inglês, "the life" só cabe quando é uma vida específica: "the life of a doctor".',
    },
    level: 'A2',
  },
  {
    id: 'false-friends',
    title: 'Palavras que parecem iguais e não são',
    question: 'O espanhol é tão parecido com o português que dá para chutar. Onde isso me trai?',
    targets: ['es'],
    groups: [['pt'], ['es'], ['en'], ['de']],
    behavior: {
      pt: 'Base do falso amigo: a palavra existe e é comum.',
      es: 'A mesma forma existe, mas o sentido escorregou — às vezes para um lugar constrangedor.',
      en: 'Ajuda pouco aqui, mas às vezes revela a origem comum da palavra.',
      de: 'Distante demais para gerar este tipo de erro.',
    },
    examples: [
      {
        gloss: 'grávida / comprido',
        pt: 'Ela está grávida. / A rua é comprida.',
        en: 'She is pregnant. / The street is long.',
        es: 'Ella está embarazada. / La calle es larga.',
        de: 'Sie ist schwanger. / Die Straße ist lang.',
        note: '"Embarazada" é grávida, não envergonhada. E "largo" é comprido, não largo.',
      },
      {
        gloss: 'escritório / oficina',
        pt: 'o escritório / a oficina mecânica',
        en: 'the office / the workshop',
        es: 'la oficina / el taller',
        de: 'das Büro / die Werkstatt',
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
    groups: [
      ['pt', 'es'],
      ['en', 'de'],
    ],
    behavior: {
      pt: 'Subjuntivo vivo e obrigatório, com três tempos: que eu fale, se eu falasse, quando eu falar.',
      es: 'Igual ao português, quase forma por forma. É o seu maior atalho no espanhol.',
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
        note: 'Só português e espanhol mudam a forma do verbo. Inglês e alemão usam o presente normal.',
      },
      {
        gloss: 'se eu fosse rico',
        pt: 'Se eu fosse rico...',
        en: 'If I were rich...',
        es: 'Si fuera rico...',
        de: 'Wenn ich reich wäre...',
        note: 'Aqui os quatro marcam a hipótese. É o último reduto do subjuntivo inglês.',
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
    targets: ['en', 'de'],
    groups: [
      ['en', 'de'],
      ['pt', 'es'],
    ],
    behavior: {
      en: 'O adjetivo vem SEMPRE antes do substantivo. Sem exceção prática.',
      de: 'Também antes — e ainda declina conforme gênero, número e caso.',
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
      },
      {
        gloss: 'um carro vermelho velho',
        pt: 'um carro vermelho velho',
        en: 'an old red car',
        es: 'un coche rojo viejo',
        de: 'ein altes rotes Auto',
        note: 'Inglês e alemão empilham tudo antes, e ainda numa ordem fixa: idade antes de cor.',
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
    targets: ['de', 'en', 'es'],
    groups: [['de'], ['en'], ['pt', 'es']],
    behavior: {
      pt: 'Regular: -s, com ajustes previsíveis (-ão, -l, -m).',
      es: 'Regular: -s depois de vogal, -es depois de consoante.',
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
        note: 'Buch vira Bücher: mudou a vogal E ganhou -er.',
      },
      {
        gloss: 'as mulheres',
        pt: 'as mulheres',
        en: 'the women',
        es: 'las mujeres',
        de: 'die Frauen',
        note: 'O inglês também tem irregulares antigos: woman/women, com a mesma lógica de mudar a vogal.',
      },
    ],
    bridge:
      'O plural alemão parece caótico, mas o inglês guarda fósseis do mesmo sistema: man/men, foot/feet, goose/geese mudam a vogal exatamente como Buch/Bücher. As duas línguas herdaram isso da mesma origem germânica — o inglês perdeu quase todos os casos, o alemão manteve.',
    level: 'A1',
  },
  {
    id: 'prepositions-place',
    title: 'In, on, at — e o caso que vem junto',
    question: 'Como escolho a preposição de lugar, se em português é quase sempre "em"?',
    targets: ['en', 'de'],
    groups: [['pt', 'es'], ['en'], ['de']],
    behavior: {
      pt: '"Em" cobre quase tudo: na casa, na mesa, na estação.',
      es: '"En" cobre quase tudo, igual ao português.',
      en: 'Três preposições disputam o mesmo espaço: in (dentro), on (sobre uma superfície), at (num ponto).',
      de: 'Além de escolher a preposição, você escolhe o CASO: acusativo se há movimento para lá, dativo se é posição parada.',
    },
    examples: [
      {
        gloss: 'estou na cozinha — parado',
        pt: 'Estou na cozinha.',
        en: 'I am in the kitchen.',
        es: 'Estoy en la cocina.',
        de: 'Ich bin in der Küche.',
        note: 'Alemão em dativo (der), porque não há movimento.',
      },
      {
        gloss: 'vou para a cozinha — movimento',
        pt: 'Vou para a cozinha.',
        en: 'I go into the kitchen.',
        es: 'Voy a la cocina.',
        de: 'Ich gehe in die Küche.',
        note: 'Mesma preposição "in", mas agora acusativo (die), porque há deslocamento.',
      },
    ],
    bridge:
      'O inglês faz uma distinção parecida com in/into e on/onto: "I am in the kitchen" contra "I go into the kitchen". O alemão pega essa mesma ideia de parado x em movimento e, em vez de trocar a preposição, troca o caso.',
    level: 'B1',
  },
  {
    id: 'modal-verbs',
    title: 'Poder, dever, querer',
    question: 'Por que "I can to go" está errado?',
    targets: ['en', 'de'],
    groups: [
      ['en', 'de'],
      ['pt', 'es'],
    ],
    behavior: {
      en: 'Modais (can, must, should) são seguidos de infinitivo SEM "to", e não levam -s na terceira pessoa.',
      de: 'Modais (können, müssen, wollen) mandam o segundo verbo, no infinitivo, para o FIM da frase.',
      pt: 'O verbo seguinte vai no infinitivo, logo depois: "posso ir".',
      es: 'Igual ao português: "puedo ir".',
    },
    examples: [
      {
        gloss: 'eu posso ir',
        pt: 'Eu posso ir.',
        en: 'I can go.',
        es: 'Puedo ir.',
        de: 'Ich kann gehen.',
      },
      {
        gloss: 'eu tenho que trabalhar hoje',
        pt: 'Eu tenho que trabalhar hoje.',
        en: 'I must work today.',
        es: 'Tengo que trabajar hoy.',
        de: 'Ich muss heute arbeiten.',
        note: 'No alemão, "arbeiten" foi para o fim, depois de "heute". O inglês mantém tudo junto.',
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
 * objetivo do modulo e usar dois dos tres idiomas para aprender o terceiro. O
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
  return value === 'pt' || value === 'en' || value === 'es' || value === 'de';
}
