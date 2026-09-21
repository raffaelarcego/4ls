/**
 * Os textos de leitura: a MESMA historia, lida nos quatro idiomas.
 *
 * O bloco de leitura era o unico grande buraco do produto. Ele caia nos
 * exercicios gerados -- cinco perguntas de multipla escolha sobre nada --, e
 * "compreensao de texto" sem texto e um nome bonito para um quiz. Pior: era o
 * unico bloco de input que nao cumpria a promessa central, porque cada idioma
 * recebia um assunto diferente e nao havia o que comparar.
 *
 * Aqui a unidade e a HISTORIA, escrita em portugues no `premise`. Cada idioma
 * recebe a mesma historia, na mesma ordem de frases, escrita no nivel daquele
 * idioma. Isso produz duas coisas que nenhuma leitura isolada produz:
 *
 * 1. ANDAIME REAL. Ele le a historia primeiro no idioma mais forte. Quando ela
 *    voltar em russo, ele ja sabe o que esta escrito ali -- e ler sabendo o
 *    conteudo e o que permite ler ACIMA do proprio nivel sem travar na terceira
 *    linha. E o mesmo principio do andaime da revisao, aplicado a texto.
 *
 * 2. CONTRASTE FRASE A FRASE. As versoes sao alinhadas por indice: a frase 3 do
 *    alemao diz o que diz a frase 3 do ingles. Isso deixa a tela oferecer "e
 *    como fica esta frase nos outros tres?" em qualquer ponto do texto -- o
 *    contraste no lugar exato em que a duvida aparece, que e o unico lugar em
 *    que ele ensina.
 *
 * O texto nao vive aqui, so a premissa. O texto vem da geracao, fora do horario
 * de estudo (ver `warm-content.ts`), pela mesma razao das outras aulas: gerar
 * quatro versoes de uma historia custa minutos, e a funcao na Vercel morre aos
 * 60s.
 *
 * Por que o catalogo e curado, e nao um tema pedido a IA na hora: um texto sem
 * premissa fixa sai diferente a cada geracao, entao as quatro versoes deixam de
 * ser a mesma historia -- que e a unica coisa que este modulo faz. A premissa
 * escrita em portugues e o que amarra as quatro.
 */

export type ReadingLevel = 'A1' | 'A2' | 'B1';

/** A forma do texto. Muda o registro, e o registro tambem se aprende. */
export type ReadingGenre = 'historia' | 'noticia' | 'relato';

export interface ReadingTopic {
  id: string;
  /** O titulo em portugues. O titulo de cada idioma vem na geracao. */
  title: string;
  /**
   * O que acontece no texto, em portugues, com comeco meio e fim.
   * E a espinha que mantem as quatro versoes sendo a mesma historia.
   */
  premise: string;
  /**
   * O que reparar enquanto le. Uma linha, em portugues.
   * Nao e regra de gramatica: e o ponto em que os quatro idiomas se separam
   * neste texto, e por isso o texto foi escolhido.
   */
  focus: string;
  genre: ReadingGenre;
  level: ReadingLevel;
}

export const READING_TOPICS: ReadingTopic[] = [
  {
    id: 'a-manha-atrasada',
    title: 'A manhã atrasada',
    premise:
      'Alguém acorda tarde, toma café em pé, sai correndo de casa e pega o ônibus errado. ' +
      'Desce na parada seguinte, decide ir a pé e chega ao trabalho quase na hora.',
    focus: 'Como cada idioma diz a hora e encaixa o horário na frase.',
    genre: 'historia',
    level: 'A1',
  },
  {
    id: 'o-mercado-da-esquina',
    title: 'O mercado da esquina',
    premise:
      'Alguém vai ao mercado da esquina comprar pão, leite e frutas. Na fila do caixa ' +
      'percebe que esqueceu a carteira em casa. A vizinha que estava atrás paga por ela.',
    focus:
      'Onde vai o artigo diante das coisas que se compram — e onde ele simplesmente não existe.',
    genre: 'historia',
    level: 'A1',
  },
  {
    id: 'o-vizinho-novo',
    title: 'O vizinho novo',
    premise:
      'Um vizinho novo se apresenta no corredor do prédio. Diz de onde veio, o que faz e ' +
      'que mora sozinho com um gato. Os dois combinam de tomar um café no sábado.',
    focus: 'Como cada idioma resolve "eu sou", "eu me chamo" e "eu trabalho com".',
    genre: 'historia',
    level: 'A1',
  },
  {
    id: 'o-cachorro-sumido',
    title: 'O cachorro sumido',
    premise:
      'No parque, um cachorro solta a coleira e some atrás de um pássaro. O dono procura ' +
      'por toda parte e pergunta às pessoas. O cachorro volta sozinho, molhado, meia hora depois.',
    focus: 'As preposições de lugar e de movimento: atrás de, dentro de, para dentro.',
    genre: 'historia',
    level: 'A1',
  },
  {
    id: 'a-mudanca',
    title: 'A mudança',
    premise:
      'Uma pessoa se muda para outra cidade por causa do trabalho. Embala a casa em caixas, ' +
      'se despede dos amigos e passa a primeira noite no apartamento vazio, ouvindo o barulho ' +
      'de uma rua que ainda não conhece.',
    focus: 'Como cada idioma marca o passado de uma sequência de acontecimentos.',
    genre: 'relato',
    level: 'A2',
  },
  {
    id: 'a-entrevista',
    title: 'A entrevista',
    premise:
      'Alguém chega quarenta minutos adiantado para uma entrevista de emprego. Espera num café ' +
      'em frente, repassa o que vai dizer e entra. A entrevista dura dez minutos e termina sem ' +
      'resposta — ela só chega uma semana depois, por e-mail.',
    focus:
      'O futuro e a expectativa: o que vai acontecer, o que aconteceria, o que acabou acontecendo.',
    genre: 'relato',
    level: 'A2',
  },
  {
    id: 'o-trem-parado',
    title: 'O trem parado',
    premise:
      'Um trem para dentro do túnel e as luzes piscam. Os passageiros esperam sem informação ' +
      'nenhuma por vinte minutos. Um deles começa a conversar com a pessoa ao lado, e o trem ' +
      'volta a andar justo quando a conversa estava boa.',
    focus: 'A voz passiva e o impessoal: quem age quando ninguém é nomeado.',
    genre: 'historia',
    level: 'A2',
  },
  {
    id: 'a-receita-da-avo',
    title: 'A receita da avó',
    premise:
      'Alguém tenta fazer o bolo da avó seguindo uma receita escrita à mão. Falta um ' +
      'ingrediente e a letra está ilegível numa linha. O bolo sai diferente, mas a casa fica ' +
      'com o cheiro certo.',
    focus: 'O imperativo das instruções e as quantidades: como cada idioma manda fazer algo.',
    genre: 'historia',
    level: 'A2',
  },
  {
    id: 'o-rio-que-voltou',
    title: 'O rio que voltou',
    premise:
      'Uma notícia curta: um rio que atravessa a cidade voltou a ter peixes depois de dez anos ' +
      'de obras de saneamento. Moradores contam que o cheiro sumiu. Especialistas alertam que a ' +
      'recuperação ainda depende do que as indústrias vão despejar daqui para a frente.',
    focus: 'O registro de notícia: frases longas, dados citados e o que se atribui a outra pessoa.',
    genre: 'noticia',
    level: 'B1',
  },
  {
    id: 'a-carta-antiga',
    title: 'A carta antiga',
    premise:
      'Ao reformar a casa, alguém encontra uma carta de 1962 dentro da parede. A carta é de ' +
      'um homem que pede desculpas a alguém que não é nomeado. A pessoa procura os antigos ' +
      'donos da casa e não encontra ninguém — decide guardar a carta onde estava.',
    focus: 'O passado dentro do passado: contar hoje algo que já era antigo quando aconteceu.',
    genre: 'relato',
    level: 'B1',
  },
  {
    id: 'trabalhar-de-casa',
    title: 'Trabalhar de casa',
    premise:
      'Um relato sobre trabalhar de casa: o tempo que se ganha sem trânsito, o dia que não ' +
      'termina nunca, e a descoberta de que o problema não era o escritório, era a agenda. ' +
      'Termina com uma escolha: dois dias em casa, três fora.',
    focus: 'Opinião e ressalva: concordar em parte, discordar com educação, admitir o contrário.',
    genre: 'relato',
    level: 'B1',
  },
  {
    id: 'a-fila-do-museu',
    title: 'A fila do museu',
    premise:
      'Numa fila de museu que dá a volta no quarteirão, duas pessoas começam a conversar sobre ' +
      'a exposição. Descobrem que trabalharam na mesma empresa em épocas diferentes. Quando a ' +
      'fila anda, entram separados e não se veem mais lá dentro.',
    focus: 'As frases relativas: prender uma informação a mais dentro da frase, sem começar outra.',
    genre: 'historia',
    level: 'B1',
  },
];

const LEVEL_ORDER: ReadingLevel[] = ['A1', 'A2', 'B1'];

/**
 * Quantas frases o texto tem, por nivel.
 *
 * E o mesmo numero nos quatro idiomas de proposito -- as versoes sao alinhadas
 * por indice, entao um idioma com uma frase a mais quebraria o alinhamento que
 * sustenta a comparacao. O que cresce com o nivel e o tamanho de cada frase,
 * nao a quantidade delas.
 */
export function sentenceCountFor(level: ReadingLevel): number {
  if (level === 'A1') return 6;
  if (level === 'A2') return 8;
  return 10;
}

/** Os textos ensinaveis ate um nivel, na ordem do catalogo. */
export function readingTopicsUpTo(level: ReadingLevel): ReadingTopic[] {
  const ceiling = LEVEL_ORDER.indexOf(level);
  return READING_TOPICS.filter((topic) => LEVEL_ORDER.indexOf(topic.level) <= ceiling);
}

export function findReadingTopic(id: string): ReadingTopic | undefined {
  return READING_TOPICS.find((topic) => topic.id === id);
}

/**
 * A chave deste texto em `grammar_progress`.
 *
 * O prefixo existe pela mesma razao do `cando:`: a tabela guarda progresso por
 * (usuario, topico, idioma) e e compartilhada entre os catalogos que vivem no
 * codigo. Sem prefixo, um id de texto colidiria com um id de contraste.
 */
export function readingTopicId(id: string): string {
  return `reading:${id}`;
}
