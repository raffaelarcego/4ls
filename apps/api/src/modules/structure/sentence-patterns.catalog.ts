/**
 * Catalogo de padroes de FORMACAO DE FRASE, por idioma.
 *
 * Por que ele existe: saber o que "Arbeit" significa nao ensina a dizer
 * "amanha de manha eu vou para o trabalho de onibus". Cada idioma monta a
 * frase com uma ordem, uma marcacao e umas obrigacoes proprias, e sem isso o
 * aluno junta palavras certas numa frase que nenhum nativo diria. Vocabulario
 * sem estrutura e um dicionario ambulante.
 *
 * Por que curado e nao gerado por IA -- mesma razao do catalogo de contrastes:
 * uma regra de ordem de palavras errada e pior que nenhuma, porque o aluno a
 * aplica em TUDO que fala. O mapa fica fixo aqui; a IA escreve as frases,
 * desmonta os exemplos e cria os exercicios EM CIMA deste mapa.
 *
 * `contrast` nao e enfeite: e o campo que liga esta aula ao resto do produto.
 * Quem estuda quatro idiomas nao erra a ordem por ignorancia, erra por
 * interferencia -- e a interferencia so se combate mostrando de onde ela vem.
 */

export type StructureLevel = 'A1' | 'A2' | 'B1' | 'B2';

export interface SentencePattern {
  /** Estavel: e a chave do pool e do progresso. */
  id: string;
  languageCode: string;
  title: string;
  /** A duvida do aluno, escrita como ele a formularia. */
  question: string;
  /** A regra, escrita por nos. A IA nao pode contradizer. */
  behavior: string;
  /** Como os outros idiomas do aluno resolvem o mesmo ponto. */
  contrast: string;
  level: StructureLevel;
}

export const LEVEL_ORDER: StructureLevel[] = ['A1', 'A2', 'B1', 'B2'];

export const SENTENCE_PATTERNS: SentencePattern[] = [
  // ------------------------------------------------------------------ ingles
  {
    id: 'en-basic-order',
    languageCode: 'en',
    title: 'A ordem que nao se mexe',
    question: 'Por que nao posso mover as palavras em ingles como faco em portugues?',
    behavior:
      'O ingles marca a funcao pela POSICAO, nao pela forma da palavra: sujeito, verbo, objeto, nessa ordem, sempre. O sujeito e obrigatorio mesmo quando nao existe ninguem agindo ("it is raining"). O adverbio de tempo vai para o inicio ou para o fim da frase, nunca entre o verbo e o objeto.',
    contrast:
      'Portugues e espanhol movem elementos por enfase e ainda podem omitir o sujeito, porque a terminacao do verbo diz quem fala. O alemao fixa o verbo na 2a posicao e deixa o resto se mover. O russo tem a ordem mais livre dos quatro, porque a terminacao do substantivo marca a funcao -- justamente o que o ingles perdeu.',
    level: 'A1',
  },
  {
    id: 'en-questions',
    languageCode: 'en',
    title: 'Toda pergunta pede um auxiliar',
    question: 'Por que nao basta mudar a entonacao para perguntar em ingles?',
    behavior:
      'A pergunta em ingles se constroi com auxiliar + sujeito + verbo principal no infinitivo sem "to": "Do you work here?". O auxiliar (do/does/did) carrega o tempo e a pessoa, entao o verbo principal fica na forma nua. Com "be" e com modais nao ha auxiliar extra: o proprio verbo pula na frente do sujeito.',
    contrast:
      'Portugues e espanhol perguntam so pela entonacao ("Voce trabalha aqui?"). O alemao inverte sujeito e verbo, sem auxiliar ("Arbeitest du hier?"). O russo tambem nao usa auxiliar nenhum -- basta a entonacao ou a particula "ли". O ingles esta sozinho neste ponto entre os quatro.',
    level: 'A1',
  },
  {
    id: 'en-adjective-order',
    languageCode: 'en',
    title: 'Adjetivos empilhados antes do substantivo',
    question: 'Em que ordem entram os adjetivos quando eu uso mais de um?',
    behavior:
      'O adjetivo vem sempre ANTES do substantivo, e quando ha varios a ordem e fixa: opiniao, tamanho, idade, forma, cor, origem, material. "a nice big old round red Italian wooden table". Nao ha virgula entre adjetivos de categorias diferentes.',
    contrast:
      'Portugues e espanhol poem o adjetivo depois ("mesa vermelha") e a ordem entre varios e bem mais livre. O alemao tambem poe antes, mas ainda declina cada adjetivo por genero, numero e caso. O russo poe antes e tambem concorda em genero, numero e caso.',
    level: 'A2',
  },
  {
    id: 'en-time-place',
    languageCode: 'en',
    title: 'Onde entram tempo, modo e lugar',
    question: 'Digo "I go every day to work" ou "I go to work every day"?',
    behavior:
      'A ordem padrao dos adjuntos em ingles e MODO, LUGAR, TEMPO -- nessa sequencia, depois do objeto: "She spoke quietly in the office yesterday." O adjunto de tempo tambem pode abrir a frase, para dar enfase. O que nao se faz e separar o verbo do objeto direto com um adjunto.',
    contrast:
      'O alemao usa a ordem oposta na parte central da frase -- tempo, causa, modo, lugar (TeKaMoLo) --, e e daqui que vem metade dos erros de quem estuda os dois. Portugues e espanhol sao flexiveis. O russo tende a por o tempo no comeco.',
    level: 'B1',
  },

  // --------------------------------------------------------------- espanhol
  {
    id: 'es-basic-order',
    languageCode: 'es',
    title: 'O sujeito que pode sumir',
    question: 'Quando escrevo "yo" e quando deixo o verbo falar sozinho?',
    behavior:
      'A terminacao do verbo ja diz quem fala, entao o pronome sujeito so aparece para dar enfase ou desfazer ambiguidade: "hablo espanol" e a forma normal, "yo hablo espanol" contrasta com outra pessoa. A ordem e sujeito-verbo-objeto, mas move-se com facilidade por enfase.',
    contrast:
      'E igual ao portugues -- este e o seu maior atalho no espanhol. Ja ingles e alemao exigem o sujeito sempre, mesmo quando nao ha ninguem agindo. O russo tambem conjuga o verbo por pessoa, mas na pratica mantem o pronome com muito mais frequencia que o espanhol.',
    level: 'A1',
  },
  {
    id: 'es-gustar',
    languageCode: 'es',
    title: 'A frase que vira do avesso',
    question: 'Por que "me gusta el cafe" e nao "yo gusto el cafe"?',
    behavior:
      'Verbos como gustar, encantar, interesar, doler invertem os papeis: quem sente vira objeto indireto (me, te, le, nos, os, les) e o que se gosta vira SUJEITO -- e e ele que manda no verbo. Por isso "me gustan los libros" leva o verbo no plural.',
    contrast:
      'O portugues resolve com o sujeito normal ("eu gosto de cafe"), e e essa semelhanca enganosa que produz o erro. O alemao tem a mesma inversao em "mir gefaellt" e "mir tut weh". O russo faz igual em "мне нравится" -- quem gosta vai para o dativo. Contra a sua intuicao portuguesa, tres dos quatro idiomas invertem.',
    level: 'A2',
  },
  {
    id: 'es-pronoun-placement',
    languageCode: 'es',
    title: 'Onde grudar o pronome',
    question: 'E "lo quiero hacer" ou "quiero hacerlo"?',
    behavior:
      'O pronome atono vem ANTES do verbo conjugado ("lo veo") e DEPOIS, colado, no infinitivo, no gerundio e no imperativo afirmativo ("verlo", "viendolo", "hazlo"). Com perifrase (verbo + infinitivo) as duas posicoes valem: "lo quiero hacer" ou "quiero hacerlo". No imperativo negativo volta para antes: "no lo hagas".',
    contrast:
      'O portugues brasileiro poe quase tudo antes e evita a enclise, entao a forma "hazlo" soa estranha. O ingles nunca move o pronome objeto: ele fica onde o objeto ficaria. O alemao move o pronome para bem perto do verbo conjugado. O russo tambem mantem o pronome na posicao do objeto, mas no caso certo.',
    level: 'A2',
  },
  {
    id: 'es-subjunctive-trigger',
    languageCode: 'es',
    title: 'O que dispara o subjuntivo',
    question: 'Quando o verbo depois de "que" muda de forma?',
    behavior:
      'Verbos de desejo, duvida, emocao, ordem e negacao pedem subjuntivo na oracao introduzida por "que": "quiero que vengas", "no creo que sea verdad". Constatacao de fato mantem o indicativo: "creo que es verdad". O gatilho esta na oracao PRINCIPAL, nao na subordinada.',
    contrast:
      'O portugues faz quase igual, forma por forma -- e o seu maior atalho aqui. Ingles e alemao praticamente perderam o subjuntivo e resolvem com infinitivo ou modal ("I want you to come", "ich will, dass du kommst"). O russo usa a particula "бы" com o passado para o mesmo efeito.',
    level: 'B1',
  },

  // ----------------------------------------------------------------- alemao
  {
    id: 'de-verb-second',
    languageCode: 'de',
    title: 'O verbo defende a segunda posicao',
    question: 'Por que "Heute ich gehe" esta errado?',
    behavior:
      'Na frase principal alema o verbo conjugado e SEMPRE o segundo elemento -- nao a segunda palavra, o segundo constituinte. Se algo diferente do sujeito abre a frase (tempo, lugar, um complemento inteiro), o sujeito passa para depois do verbo: "Heute gehe ich ins Kino."',
    contrast:
      'Portugues, espanhol e russo deixam voce comecar por onde quiser sem mexer no resto. O ingles guarda um resto da mesma regra em casos raros ("Never have I seen that"), mas na frase comum mantem sujeito-verbo. O alemao esta praticamente sozinho, e e por isso que este e o erro numero um de brasileiros.',
    level: 'A1',
  },
  {
    id: 'de-case-roles',
    languageCode: 'de',
    title: 'O caso diz quem faz o que',
    question: 'Por que "der" vira "den" e "dem" no meio da frase?',
    behavior:
      'O artigo e o adjetivo mudam de forma conforme a funcao do substantivo: nominativo para o sujeito, acusativo para o objeto direto, dativo para o objeto indireto, genitivo para posse. Verbos e preposicoes especificos exigem um caso fixo, e isso se aprende junto com a palavra, nao depois.',
    contrast:
      'O russo funciona exatamente assim, com seis casos em vez de quatro -- estudar os dois ao mesmo tempo e a sua maior vantagem aqui. Portugues, espanhol e ingles marcam a funcao pela posicao e so guardam caso nos pronomes ("eu/me/mim", "I/me").',
    level: 'A1',
  },
  {
    id: 'de-verb-final',
    languageCode: 'de',
    title: 'A subordinada joga o verbo para o fim',
    question: 'Por que depois de "weil" e "dass" o verbo vai la para tras?',
    behavior:
      'Conjuncoes subordinativas (weil, dass, wenn, obwohl, ob) mandam o verbo conjugado para o FIM da oracao: "Ich bleibe zu Hause, weil ich krank bin." A virgula antes da oracao e obrigatoria. Ja "denn" e "und" nao sao subordinativas e nao mexem na ordem.',
    contrast:
      'Nenhum dos outros tres faz isto: ingles, espanhol e russo mantem a ordem normal depois de "because", "porque" e "потому что". E uma regra que voce so tem em alemao, e ela precisa ser pensada ANTES de comecar a oracao.',
    level: 'A2',
  },
  {
    id: 'de-bracket',
    languageCode: 'de',
    title: 'O parentese verbal',
    question: 'Por que o segundo verbo fica isolado la no fim da frase?',
    behavior:
      'Modal, auxiliar ou verbo separavel abrem um PARENTESE: a parte conjugada fica na 2a posicao e a outra metade (infinitivo, participio ou prefixo separavel) fecha a frase no fim. Tudo o mais fica espremido no meio: "Ich muss heute frueh nach Hause gehen."',
    contrast:
      'O ingles mantem os dois verbos juntos ("I must go home early today") e so parte os phrasal verbs quando o objeto e pronome ("turn it on"). Portugues e espanhol tambem mantem juntos. O russo nao tem esta construcao. A frase alema so fica pronta quando voce chega ao fim -- e isso muda o jeito de planejar a fala.',
    level: 'A2',
  },
  {
    id: 'de-tekamolo',
    languageCode: 'de',
    title: 'TeKaMoLo: a ordem do meio da frase',
    question: 'Em que ordem entram tempo, lugar e modo no meio da frase alema?',
    behavior:
      'No campo central a ordem padrao e TEmpo, KAusa, MOdo, LOcal: "Ich fahre morgen wegen der Arbeit mit dem Zug nach Berlin." Objeto dativo vem antes do acusativo quando os dois sao substantivos; se um deles for pronome, o pronome vem primeiro.',
    contrast:
      'O ingles usa quase a ordem inversa -- modo, lugar, tempo --, e trocar as duas e o erro classico de quem estuda os dois juntos. Portugues e espanhol sao flexiveis e nao cobram nada. O russo prefere o tempo no inicio, o que casa com o "Te" do alemao.',
    level: 'B1',
  },

  // ------------------------------------------------------------------ russo
  {
    id: 'ru-no-copula',
    languageCode: 'ru',
    title: 'A frase sem verbo "ser"',
    question: 'Como digo "eu sou brasileiro" se nao existe verbo "ser" no presente?',
    behavior:
      'No presente o russo simplesmente nao usa copula: "Я студент" e literalmente "eu estudante". O mesmo vale para adjetivos ("Он болен") e para lugar ("Я дома"). O verbo "быть" reaparece no passado (был/была/было/были) e no futuro (буду).',
    contrast:
      'Portugues e espanhol distinguem ser e estar, e os dois sao obrigatorios. Ingles e alemao usam um verbo so, tambem obrigatorio ("I am a student", "ich bin Student"). O russo e o unico dos quatro que dispensa o verbo -- e justamente por isso um brasileiro tende a inventar um verbo que nao existe ali.',
    level: 'A1',
  },
  {
    id: 'ru-cases-roles',
    languageCode: 'ru',
    title: 'A terminacao diz a funcao',
    question: 'Por que "работа" vira "работу" e "работе" dependendo da frase?',
    behavior:
      'O russo tem seis casos (nominativo, acusativo, genitivo, dativo, instrumental, preposicional) e a TERMINACAO do substantivo marca a funcao dele na frase. Como a funcao esta na palavra, a ordem e livre e serve para enfase: "Маша любит Ивана" e "Ивана любит Маша" tem o mesmo sentido literal.',
    contrast:
      'O alemao faz exatamente a mesma coisa, com quatro casos -- e o seu melhor aliado aqui: se voce ja aceitou que "den Mann" e o objeto, o russo esta pedindo a mesma ideia com outra roupa. Portugues, espanhol e ingles nao tem nada disso fora dos pronomes, e dependem da posicao.',
    level: 'A1',
  },
  {
    id: 'ru-no-articles',
    languageCode: 'ru',
    title: 'Nao existe artigo',
    question: 'Como digo "o livro" e "um livro" se nao ha artigos?',
    behavior:
      'O russo nao tem artigo nenhum -- nem definido nem indefinido. "Книга" e livro, o livro ou um livro, conforme o contexto. Quando a distincao importa de verdade, ela vem de outros recursos: a ORDEM (o que ja e conhecido vem primeiro, o novo vem depois) ou palavras como "один" e "этот".',
    contrast:
      'Os outros tres cobram artigo, e ainda cobram concordancia: o alemao muda a forma por genero e caso, o espanhol e o portugues por genero e numero, o ingles escolhe entre a/an/the. Aqui o russo e o mais simples dos quatro -- o trabalho e desaprender a colocar o artigo.',
    level: 'A1',
  },
  {
    id: 'ru-dative-impersonal',
    languageCode: 'ru',
    title: 'Frases sem sujeito, com dativo',
    question: 'Por que "eu preciso" vira "мне нужно"?',
    behavior:
      'Um grupo grande de construcoes russas nao tem sujeito: quem sente ou precisa vai para o DATIVO e a frase fica impessoal. "Мне нужно" (a mim e necessario), "Мне нравится" (a mim agrada), "Мне холодно" (a mim esta frio), "Мне тридцать лет" (a mim ha trinta anos).',
    contrast:
      'O espanhol faz o mesmo com gustar ("me gusta") e o alemao com "mir gefaellt" e "mir ist kalt" -- tres dos quatro idiomas invertem. Quem esta sozinho e o ingles, que poe o sujeito sempre ("I need", "I like", "I am cold"). Se voce ja engoliu "me gusta", esta construcao nao e novidade: e a mesma ideia.',
    level: 'A2',
  },
  {
    id: 'ru-aspect',
    languageCode: 'ru',
    title: 'Todo verbo vem em par',
    question: 'Por que cada verbo russo tem duas formas, como "делать" e "сделать"?',
    behavior:
      'Os verbos russos vem em pares de ASPECTO. O imperfectivo (делать) descreve o processo, a repeticao ou o habito; o perfectivo (сделать) descreve a acao concluida, com resultado. O perfectivo nao tem presente: conjugado no presente, ele significa futuro.',
    contrast:
      'Portugues e espanhol carregam essa distincao no TEMPO verbal (fazia x fiz, hacia x hice), nao no verbo -- entao a ideia ja existe na sua cabeca, so muda de lugar. O ingles se aproxima com o continuo ("I was doing" x "I did"). O alemao praticamente nao marca isso e depende do contexto.',
    level: 'B1',
  },
  {
    id: 'ru-motion-verbs',
    languageCode: 'ru',
    title: 'Ir a pe ou ir de carro',
    question: 'Quando uso "идти" e quando uso "ехать"?',
    behavior:
      'O russo obriga a escolher o meio: идти/ходить e ir a pe, ехать/ездить e ir em veiculo. Alem disso, a primeira forma de cada par e para um trajeto determinado em andamento e a segunda para ida e volta ou habito. Prefixos ainda mudam a direcao: при- (chegar), у- (partir), вы- (sair).',
    contrast:
      'O alemao faz metade disso com gehen (a pe) e fahren (de veiculo) -- e o seu aliado aqui. Portugues, espanhol e ingles usam um verbo so para tudo ("ir", "to go") e deixam o meio de transporte para uma preposicao no fim. Em russo a escolha esta no proprio verbo, antes de voce comecar a frase.',
    level: 'A2',
  },
];

/** Padroes de um idioma que cabem ate o nivel do aluno. */
export function patternsFor(languageCode: string, level: string): SentencePattern[] {
  const ceiling = LEVEL_ORDER.indexOf(level as StructureLevel);
  // Nivel acima do catalogo (C1/C2) recebe tudo; nivel desconhecido, so o A1.
  const max = ceiling === -1 ? (level >= 'C' ? LEVEL_ORDER.length - 1 : 0) : ceiling;

  return SENTENCE_PATTERNS.filter(
    (p) => p.languageCode === languageCode && LEVEL_ORDER.indexOf(p.level) <= max,
  );
}

export function findPattern(id: string): SentencePattern | undefined {
  return SENTENCE_PATTERNS.find((p) => p.id === id);
}

/** Id usado em grammar_progress para o progresso de estrutura. */
export function progressTopicId(patternId: string): string {
  return `structure:${patternId}`;
}
