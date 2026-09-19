/**
 * Fundamentos: as primeiras pecas da frase, para quem nao sabe NADA do idioma.
 *
 * O alfabeto resolveu "eu nao consigo ler os caracteres". Ficou de pe o degrau
 * seguinte, que o aluno descreveu assim: nao daria para aprender ingles se, antes
 * da primeira aula, ele nao soubesse o que e o verbo to be. O catalogo de can-dos
 * comeca em A1, e A1 ja supoe que existe uma frase para montar -- supoe pronome,
 * supoe verbo, supoe ordem. Em alemao e em russo ele nao tem nenhuma das tres.
 *
 * Esta trilha e o degrau que faltava, e ela e deliberadamente MENOR que uma
 * can-do: a unidade aqui nao e uma funcao comunicativa ("como digo onde algo
 * esta?"), e uma peca de frase. Quatro decisoes sustentam o formato:
 *
 * 1. TODA LICAO TERMINA NUMA FRASE INTEIRA. Peca solta nao se fixa e, pior, nao
 *    responde a pergunta que o aluno realmente tem -- que e como juntar. Por isso
 *    cada licao carrega `sentences`, e cada frase vem quebrada em `parts` com o
 *    rotulo em portugues (QUEM / SER / O QUE). E a mesma tabela de montagem das
 *    can-dos, so que com as pecas que a propria licao acabou de ensinar.
 *
 * 2. SO SE MONTA COM O QUE JA FOI ENSINADO -- a mesma regra da escada do
 *    alfabeto. Por isso "Ich bin Raffael" aparece na licao 1 e o acusativo so na
 *    8: uma frase com uma peca nao apresentada vira decoreba de som.
 *
 * 3. A REGRA E DITA EM PORTUGUES, E DIZ O QUE MUDA EM RELACAO AO PORTUGUES.
 *    "O verbo alemao fica em segundo lugar" nao ensina nada sozinho; "o verbo e
 *    sempre a SEGUNDA peca, entao quando a frase comeca por outra coisa o sujeito
 *    cai para depois dele" ensina, porque nomeia o erro que ele vai cometer.
 *
 * 4. AS ARMADILHAS SAO MARCADAS UMA A UMA (`trap`), pelo mesmo motivo do
 *    alfabeto: o que parece portugues e nao e (o `ja` alemao que se le "ia", o
 *    `что` russo que se le "shto", o possessivo russo que concorda com a coisa e
 *    nao com o dono) e lido errado com confianca, e erro confiante nao se corrige
 *    sozinho com exposicao.
 *
 * O russo desta trilha vem em cirilico, e isso e proposital: quem chega aqui ja
 * fechou a trilha de alfabeto. A transliteracao em `reading` fica como apoio, nao
 * como muleta -- e o mesmo papel que ela tem nas palavras do alfabeto.
 *
 * Como o alfabeto, NAO passa por IA: o conteudo precisa estar certo (uma
 * terminacao verbal errada aqui contamina tudo que vem depois) e a trilha nao
 * pode depender de uma chamada de rede para abrir.
 */

/** Uma peca nova: uma palavra, com o que ela faz na frase. */
export interface FoundationPiece {
  /** A palavra no idioma. */
  term: string;
  /** O que ela quer dizer, em portugues. */
  meaning: string;
  /** Como soa, soletrado em portugues. */
  reading: string;
  /** O que esta peca exige e o portugues nao exige, quando ha o que dizer. */
  note?: string;
  /** O engano provavel. So as pecas que parecem outra coisa ganham este campo. */
  trap?: string;
}

/** Um pedaco de frase, com o papel que ele cumpre. */
export interface SentencePart {
  /** O texto no idioma, exatamente como aparece na frase. */
  chunk: string;
  /** O papel, em portugues: QUEM, SER, O QUE, ONDE, ACAO, NAO. */
  label: string;
}

/** Uma frase montavel com as pecas desta licao e das anteriores. */
export interface FoundationSentence {
  /** A frase inteira -- o que `parts` forma quando se junta na ordem. */
  text: string;
  reading: string;
  meaning: string;
  /** A frase quebrada, na ordem do idioma. E aqui que mora a aula de montagem. */
  parts: SentencePart[];
}

export interface FoundationLesson {
  id: string;
  /** O que esta licao resolve, em uma frase. */
  goal: string;
  title: string;
  /**
   * A regra de montagem, dita em portugues e em uma linha.
   *
   * E o texto mais importante da licao: e o que o aluno nao tem como deduzir
   * olhando as pecas, e e o que ele carrega para a frase seguinte.
   */
  rule: string;
  pieces: FoundationPiece[];
  sentences: FoundationSentence[];
}

/**
 * As trilhas existentes, por idioma.
 *
 * Nao ha trilha para ingles nem espanhol de proposito: o aluno ja monta frase
 * nos dois, e uma aula de "eu sou / voce e" para quem ja fala seria tempo de
 * estudo gasto no degrau que ele ja subiu. Quem decide isto e o estado real do
 * aluno, nao a dificuldade teorica do idioma.
 */
export const FOUNDATION_TRACKS: Record<string, FoundationLesson[]> = {
  de: [
    {
      id: 'de-fund-1',
      title: 'Eu sou, você é',
      goal: 'Montar a primeira frase alemã inteira: quem + o verbo ser + o quê.',
      rule: 'O verbo nunca some. Em português dá para dizer "sou brasileiro"; em alemão o "ich" e o "bin" são obrigatórios, os dois.',
      pieces: [
        { term: 'ich', meaning: 'eu', reading: 'ish', note: 'O "ch" é um chiado leve, soprado — nada de "k".' },
        { term: 'bin', meaning: 'sou, estou', reading: 'bin', note: 'Só serve para "ich". Cada pessoa tem a sua forma.' },
        { term: 'du', meaning: 'tu, você', reading: 'du', note: 'É o "você" de quem se tem intimidade. O formal vem depois.' },
        { term: 'bist', meaning: 'és, estás', reading: 'bist', note: 'Só serve para "du".' },
        { term: 'Brasilianer', meaning: 'brasileiro', reading: 'bra-zi-LI-a-ner', note: 'Substantivo em alemão começa com maiúscula, sempre — inclusive no meio da frase.' },
        { term: 'müde', meaning: 'cansado', reading: 'MÜ-de', note: 'O "ü" é dizer "i" com a boca arredondada de "u".' },
      ],
      sentences: [
        {
          text: 'Ich bin Raffael.',
          reading: 'ish bin RA-fa-el',
          meaning: 'Eu sou Raffael.',
          parts: [
            { chunk: 'Ich', label: 'QUEM' },
            { chunk: 'bin', label: 'SER' },
            { chunk: 'Raffael', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Ich bin Brasilianer.',
          reading: 'ish bin bra-zi-LI-a-ner',
          meaning: 'Eu sou brasileiro.',
          parts: [
            { chunk: 'Ich', label: 'QUEM' },
            { chunk: 'bin', label: 'SER' },
            { chunk: 'Brasilianer', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Du bist müde.',
          reading: 'du bist MÜ-de',
          meaning: 'Você está cansado.',
          parts: [
            { chunk: 'Du', label: 'QUEM' },
            { chunk: 'bist', label: 'SER' },
            { chunk: 'müde', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Ich bin müde.',
          reading: 'ish bin MÜ-de',
          meaning: 'Eu estou cansado.',
          parts: [
            { chunk: 'Ich', label: 'QUEM' },
            { chunk: 'bin', label: 'SER' },
            { chunk: 'müde', label: 'O QUÊ' },
          ],
        },
      ],
    },
    {
      id: 'de-fund-2',
      title: 'Isto é, ele é',
      goal: 'Apontar uma coisa e falar de uma terceira pessoa.',
      rule: '"ist" é a forma de ele, ela e de "das" (isto). Uma forma só para os três — é a mais usada de todas.',
      pieces: [
        { term: 'das', meaning: 'isto, isso', reading: 'das', note: 'Aponta qualquer coisa, de qualquer gênero: "das ist..." serve sempre.' },
        { term: 'ist', meaning: 'é, está', reading: 'ist' },
        { term: 'er', meaning: 'ele', reading: 'ér' },
        { term: 'sie', meaning: 'ela', reading: 'zi', trap: 'O mesmo "sie" também quer dizer "eles/elas" — e com maiúscula, "Sie", é o "você" formal. Quem separa os três é a forma do verbo.' },
        { term: 'ein', meaning: 'um, uma', reading: 'ain', trap: '"ei" alemão se lê "ai". "ein" é "ain".' },
        { term: 'Wasser', meaning: 'água', reading: 'VÁ-ser', trap: 'O "w" alemão se lê "v". Nunca "u".' },
        { term: 'Buch', meaning: 'livro', reading: 'burr', note: 'O "ch" depois de "u" é o nosso "rr" de "carro", raspado na garganta.' },
      ],
      sentences: [
        {
          text: 'Das ist Wasser.',
          reading: 'das ist VÁ-ser',
          meaning: 'Isto é água.',
          parts: [
            { chunk: 'Das', label: 'O QUÊ' },
            { chunk: 'ist', label: 'SER' },
            { chunk: 'Wasser', label: 'O QUE É' },
          ],
        },
        {
          text: 'Das ist ein Buch.',
          reading: 'das ist ain burr',
          meaning: 'Isto é um livro.',
          parts: [
            { chunk: 'Das', label: 'O QUÊ' },
            { chunk: 'ist', label: 'SER' },
            { chunk: 'ein Buch', label: 'O QUE É' },
          ],
        },
        {
          text: 'Er ist müde.',
          reading: 'ér ist MÜ-de',
          meaning: 'Ele está cansado.',
          parts: [
            { chunk: 'Er', label: 'QUEM' },
            { chunk: 'ist', label: 'SER' },
            { chunk: 'müde', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Sie ist Brasilianerin.',
          reading: 'zi ist bra-zi-LI-a-ne-rin',
          meaning: 'Ela é brasileira.',
          parts: [
            { chunk: 'Sie', label: 'QUEM' },
            { chunk: 'ist', label: 'SER' },
            { chunk: 'Brasilianerin', label: 'O QUÊ' },
          ],
        },
      ],
    },
    {
      id: 'de-fund-3',
      title: 'Dizer não',
      goal: 'Negar uma frase — e saber qual das duas negações usar.',
      rule: 'São duas palavras diferentes: "nicht" nega o verbo ou o adjetivo e vem DEPOIS dele; "kein" nega um substantivo e ocupa o lugar do "um".',
      pieces: [
        { term: 'nicht', meaning: 'não (nega verbo ou adjetivo)', reading: 'nisht', note: 'Vem depois do que está negando: "Ich bin nicht müde".' },
        { term: 'kein', meaning: 'nenhum, não é um', reading: 'kain', note: 'É o "ein" com um "k" na frente, e acompanha o gênero da palavra: kein Buch, keine Zeit.' },
        { term: 'nein', meaning: 'não (a resposta)', reading: 'nain', trap: 'Só serve para responder. Dentro da frase, nunca — ali é "nicht" ou "kein".' },
        { term: 'ja', meaning: 'sim', reading: 'iá', trap: 'O "j" alemão se lê "i". "ja" é "iá", não "já".' },
      ],
      sentences: [
        {
          text: 'Ich bin nicht müde.',
          reading: 'ish bin nisht MÜ-de',
          meaning: 'Eu não estou cansado.',
          parts: [
            { chunk: 'Ich', label: 'QUEM' },
            { chunk: 'bin', label: 'SER' },
            { chunk: 'nicht', label: 'NÃO' },
            { chunk: 'müde', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Das ist kein Buch.',
          reading: 'das ist kain burr',
          meaning: 'Isto não é um livro.',
          parts: [
            { chunk: 'Das', label: 'O QUÊ' },
            { chunk: 'ist', label: 'SER' },
            { chunk: 'kein', label: 'NÃO' },
            { chunk: 'Buch', label: 'O QUE É' },
          ],
        },
        {
          text: 'Du bist nicht Brasilianer.',
          reading: 'du bist nisht bra-zi-LI-a-ner',
          meaning: 'Você não é brasileiro.',
          parts: [
            { chunk: 'Du', label: 'QUEM' },
            { chunk: 'bist', label: 'SER' },
            { chunk: 'nicht', label: 'NÃO' },
            { chunk: 'Brasilianer', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Nein, das ist Wasser.',
          reading: 'nain, das ist VÁ-ser',
          meaning: 'Não, isto é água.',
          parts: [
            { chunk: 'Nein', label: 'RESPOSTA' },
            { chunk: 'das', label: 'O QUÊ' },
            { chunk: 'ist', label: 'SER' },
            { chunk: 'Wasser', label: 'O QUE É' },
          ],
        },
      ],
    },
    {
      id: 'de-fund-4',
      title: 'Perguntar',
      goal: 'Transformar qualquer frase que você já sabe numa pergunta.',
      rule: 'Para perguntar sim ou não, o verbo PULA para a frente: "Du bist müde" vira "Bist du müde?". Não existe um "será que" nem um "-ão" no fim — é só a troca de lugar.',
      pieces: [
        { term: 'was', meaning: 'o quê', reading: 'vas' },
        { term: 'wer', meaning: 'quem', reading: 'vér', trap: 'Parece o "where" inglês, mas é "quem". O "onde" é "wo".' },
        { term: 'wo', meaning: 'onde', reading: 'vô' },
        { term: 'hier', meaning: 'aqui', reading: 'rír', note: 'O "h" alemão é soprado, como no inglês "house" — não é o nosso "r".' },
      ],
      sentences: [
        {
          text: 'Bist du müde?',
          reading: 'bist du MÜ-de',
          meaning: 'Você está cansado?',
          parts: [
            { chunk: 'Bist', label: 'SER' },
            { chunk: 'du', label: 'QUEM' },
            { chunk: 'müde', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Was ist das?',
          reading: 'vas ist das',
          meaning: 'O que é isto?',
          parts: [
            { chunk: 'Was', label: 'PERGUNTA' },
            { chunk: 'ist', label: 'SER' },
            { chunk: 'das', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Wer ist er?',
          reading: 'vér ist ér',
          meaning: 'Quem é ele?',
          parts: [
            { chunk: 'Wer', label: 'PERGUNTA' },
            { chunk: 'ist', label: 'SER' },
            { chunk: 'er', label: 'QUEM' },
          ],
        },
        {
          text: 'Wo bist du?',
          reading: 'vô bist du',
          meaning: 'Onde você está?',
          parts: [
            { chunk: 'Wo', label: 'PERGUNTA' },
            { chunk: 'bist', label: 'SER' },
            { chunk: 'du', label: 'QUEM' },
          ],
        },
      ],
    },
    {
      id: 'de-fund-5',
      title: 'der, die, das',
      goal: 'Entender por que toda palavra alemã vem com um artigo colado.',
      rule: 'Todo substantivo tem um gênero, e ele NÃO segue o português: "a mesa" é masculino em alemão ("der Tisch"). Por isso a palavra se aprende junto com o artigo, sempre — "Tisch" sozinho é meia palavra.',
      pieces: [
        { term: 'der', meaning: 'o (masculino)', reading: 'dér' },
        { term: 'die', meaning: 'a (feminino)', reading: 'di', trap: 'Não tem nada a ver com o "die" inglês. É só o artigo feminino.' },
        { term: 'das', meaning: 'o/a (neutro)', reading: 'das', note: 'O mesmo "das" do "isto é" — aqui ele é artigo, e existe um terceiro gênero que o português não tem.' },
        { term: 'der Tisch', meaning: 'a mesa', reading: 'dér tish', trap: 'Masculino em alemão, feminino em português. O gênero não se traduz.' },
        { term: 'die Tür', meaning: 'a porta', reading: 'di tür' },
        { term: 'das Buch', meaning: 'o livro', reading: 'das burr', trap: 'Nem masculino nem feminino: neutro.' },
      ],
      sentences: [
        {
          text: 'Das ist der Tisch.',
          reading: 'das ist dér tish',
          meaning: 'Esta é a mesa.',
          parts: [
            { chunk: 'Das', label: 'O QUÊ' },
            { chunk: 'ist', label: 'SER' },
            { chunk: 'der Tisch', label: 'O QUE É' },
          ],
        },
        {
          text: 'Die Tür ist hier.',
          reading: 'di tür ist rír',
          meaning: 'A porta é aqui.',
          parts: [
            { chunk: 'Die Tür', label: 'O QUÊ' },
            { chunk: 'ist', label: 'SER' },
            { chunk: 'hier', label: 'ONDE' },
          ],
        },
        {
          text: 'Das Buch ist nicht hier.',
          reading: 'das burr ist nisht rír',
          meaning: 'O livro não está aqui.',
          parts: [
            { chunk: 'Das Buch', label: 'O QUÊ' },
            { chunk: 'ist', label: 'SER' },
            { chunk: 'nicht', label: 'NÃO' },
            { chunk: 'hier', label: 'ONDE' },
          ],
        },
        {
          text: 'Wo ist die Tür?',
          reading: 'vô ist di tür',
          meaning: 'Onde é a porta?',
          parts: [
            { chunk: 'Wo', label: 'PERGUNTA' },
            { chunk: 'ist', label: 'SER' },
            { chunk: 'die Tür', label: 'O QUÊ' },
          ],
        },
      ],
    },
    {
      id: 'de-fund-6',
      title: 'O verbo no presente',
      goal: 'Sair do verbo "ser" e dizer o que você faz.',
      rule: 'A terminação muda com quem faz: -e para ich, -st para du, -t para er/sie. O começo da palavra fica igual — só o fim muda.',
      pieces: [
        { term: 'wohnen', meaning: 'morar', reading: 'VÔ-nen', note: 'Esta é a forma de dicionário. Ninguém fala assim numa frase — ela sempre ganha uma terminação.' },
        { term: 'ich wohne', meaning: 'eu moro', reading: 'ish VÔ-ne' },
        { term: 'du wohnst', meaning: 'você mora', reading: 'du vônst' },
        { term: 'er wohnt', meaning: 'ele mora', reading: 'ér vônt' },
        { term: 'arbeiten', meaning: 'trabalhar', reading: 'AR-bai-ten', trap: '"ei" se lê "ai" — "arbeiten" é "ARbaiten".' },
        { term: 'in Brasilien', meaning: 'no Brasil', reading: 'in bra-ZÍ-li-en' },
      ],
      sentences: [
        {
          text: 'Ich wohne in Brasilien.',
          reading: 'ish VÔ-ne in bra-ZÍ-li-en',
          meaning: 'Eu moro no Brasil.',
          parts: [
            { chunk: 'Ich', label: 'QUEM' },
            { chunk: 'wohne', label: 'AÇÃO' },
            { chunk: 'in Brasilien', label: 'ONDE' },
          ],
        },
        {
          text: 'Du wohnst hier.',
          reading: 'du vônst rír',
          meaning: 'Você mora aqui.',
          parts: [
            { chunk: 'Du', label: 'QUEM' },
            { chunk: 'wohnst', label: 'AÇÃO' },
            { chunk: 'hier', label: 'ONDE' },
          ],
        },
        {
          text: 'Er arbeitet hier.',
          reading: 'ér AR-bai-tet rír',
          meaning: 'Ele trabalha aqui.',
          parts: [
            { chunk: 'Er', label: 'QUEM' },
            { chunk: 'arbeitet', label: 'AÇÃO' },
            { chunk: 'hier', label: 'ONDE' },
          ],
        },
        {
          text: 'Ich arbeite nicht hier.',
          reading: 'ish AR-bai-te nisht rír',
          meaning: 'Eu não trabalho aqui.',
          parts: [
            { chunk: 'Ich', label: 'QUEM' },
            { chunk: 'arbeite', label: 'AÇÃO' },
            { chunk: 'nicht', label: 'NÃO' },
            { chunk: 'hier', label: 'ONDE' },
          ],
        },
      ],
    },
    {
      id: 'de-fund-7',
      title: 'O verbo em segundo lugar',
      goal: 'A regra que mais derruba brasileiro no alemão.',
      rule: 'O verbo é SEMPRE a segunda peça da frase. Então, quando a frase começa por outra coisa — "hoje", "aqui" —, o sujeito não fica em primeiro: ele cai para depois do verbo. "Hoje eu trabalho" vira, literalmente, "Hoje trabalho eu".',
      pieces: [
        { term: 'heute', meaning: 'hoje', reading: 'HÓI-te', trap: '"eu" alemão se lê "ói". "heute" é "hóite".' },
        { term: 'morgen', meaning: 'amanhã', reading: 'MÓR-guen' },
        { term: 'jetzt', meaning: 'agora', reading: 'iétst', trap: 'Começa com o som de "i", não de "j".' },
        { term: 'auch', meaning: 'também', reading: 'aurr', note: '"au" se lê "au" mesmo, e o "ch" é o "rr" raspado.' },
      ],
      sentences: [
        {
          text: 'Heute arbeite ich.',
          reading: 'HÓI-te AR-bai-te ish',
          meaning: 'Hoje eu trabalho.',
          parts: [
            { chunk: 'Heute', label: 'QUANDO' },
            { chunk: 'arbeite', label: 'AÇÃO' },
            { chunk: 'ich', label: 'QUEM' },
          ],
        },
        {
          text: 'Jetzt bin ich müde.',
          reading: 'iétst bin ish MÜ-de',
          meaning: 'Agora eu estou cansado.',
          parts: [
            { chunk: 'Jetzt', label: 'QUANDO' },
            { chunk: 'bin', label: 'SER' },
            { chunk: 'ich', label: 'QUEM' },
            { chunk: 'müde', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Morgen wohnt er hier.',
          reading: 'MÓR-guen vônt ér rír',
          meaning: 'Amanhã ele mora aqui.',
          parts: [
            { chunk: 'Morgen', label: 'QUANDO' },
            { chunk: 'wohnt', label: 'AÇÃO' },
            { chunk: 'er', label: 'QUEM' },
            { chunk: 'hier', label: 'ONDE' },
          ],
        },
        {
          text: 'Hier arbeite ich auch.',
          reading: 'rír AR-bai-te ish aurr',
          meaning: 'Aqui eu trabalho também.',
          parts: [
            { chunk: 'Hier', label: 'ONDE' },
            { chunk: 'arbeite', label: 'AÇÃO' },
            { chunk: 'ich', label: 'QUEM' },
            { chunk: 'auch', label: 'TAMBÉM' },
          ],
        },
      ],
    },
    {
      id: 'de-fund-8',
      title: 'Ter — e o artigo que muda',
      goal: 'Dizer que você tem alguma coisa, e ver o primeiro caso alemão acontecer.',
      rule: 'Quando a coisa deixa de ser o sujeito e passa a ser o OBJETO da ação, o artigo masculino muda: "der" vira "den". Só o masculino muda — "die" e "das" ficam iguais. É este o famoso "caso" alemão, e ele começa aqui.',
      pieces: [
        { term: 'ich habe', meaning: 'eu tenho', reading: 'ish HÁ-be' },
        { term: 'du hast', meaning: 'você tem', reading: 'du hast' },
        { term: 'er hat', meaning: 'ele tem', reading: 'ér hat' },
        { term: 'den', meaning: 'o (masculino, como objeto)', reading: 'den', trap: 'É o mesmo "der", só que na posição de objeto. Esquecer disso é o erro mais comum de todos.' },
        { term: 'einen Stuhl', meaning: 'uma cadeira', reading: 'AI-nen chtul', note: '"Stuhl" é masculino, e como objeto o "ein" também vira "einen".' },
        { term: 'Zeit', meaning: 'tempo', reading: 'tsait', trap: '"z" alemão se lê "ts". E "ei" é "ai": "tsait".' },
      ],
      sentences: [
        {
          text: 'Ich habe Zeit.',
          reading: 'ish HÁ-be tsait',
          meaning: 'Eu tenho tempo.',
          parts: [
            { chunk: 'Ich', label: 'QUEM' },
            { chunk: 'habe', label: 'AÇÃO' },
            { chunk: 'Zeit', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Ich habe den Tisch.',
          reading: 'ish HÁ-be den tish',
          meaning: 'Eu tenho a mesa.',
          parts: [
            { chunk: 'Ich', label: 'QUEM' },
            { chunk: 'habe', label: 'AÇÃO' },
            { chunk: 'den Tisch', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Du hast das Buch.',
          reading: 'du hast das burr',
          meaning: 'Você tem o livro.',
          parts: [
            { chunk: 'Du', label: 'QUEM' },
            { chunk: 'hast', label: 'AÇÃO' },
            { chunk: 'das Buch', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Heute habe ich keine Zeit.',
          reading: 'HÓI-te HÁ-be ish KAI-ne tsait',
          meaning: 'Hoje eu não tenho tempo.',
          parts: [
            { chunk: 'Heute', label: 'QUANDO' },
            { chunk: 'habe', label: 'AÇÃO' },
            { chunk: 'ich', label: 'QUEM' },
            { chunk: 'keine Zeit', label: 'O QUÊ' },
          ],
        },
      ],
    },
  ],

  ru: [
    {
      id: 'ru-fund-1',
      title: 'A frase sem verbo',
      goal: 'Montar a primeira frase russa — e ela não tem verbo nenhum.',
      rule: 'No presente não existe o verbo "ser". "Я студент" é, literalmente, "eu estudante". A vontade de colocar alguma coisa no meio é forte, e é justamente ela que deixa a frase errada.',
      pieces: [
        { term: 'я', meaning: 'eu', reading: 'iá' },
        { term: 'ты', meaning: 'tu, você', reading: 'ty', note: 'O "ы" é aquele i puxado para trás que você viu no alfabeto.' },
        { term: 'студент', meaning: 'estudante (homem)', reading: 'stu-DIÉNT' },
        { term: 'бразилец', meaning: 'brasileiro', reading: 'bra-ZÍ-liets' },
        { term: 'дома', meaning: 'em casa', reading: 'DÓ-ma', note: 'Uma palavra só para "em casa" — não leva preposição.' },
      ],
      sentences: [
        {
          text: 'Я Рафаэл.',
          reading: 'iá ra-fa-EL',
          meaning: 'Eu sou Raffael.',
          parts: [
            { chunk: 'Я', label: 'QUEM' },
            { chunk: 'Рафаэл', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Я бразилец.',
          reading: 'iá bra-ZÍ-liets',
          meaning: 'Eu sou brasileiro.',
          parts: [
            { chunk: 'Я', label: 'QUEM' },
            { chunk: 'бразилец', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Ты студент.',
          reading: 'ty stu-DIÉNT',
          meaning: 'Você é estudante.',
          parts: [
            { chunk: 'Ты', label: 'QUEM' },
            { chunk: 'студент', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Я дома.',
          reading: 'iá DÓ-ma',
          meaning: 'Eu estou em casa.',
          parts: [
            { chunk: 'Я', label: 'QUEM' },
            { chunk: 'дома', label: 'ONDE' },
          ],
        },
      ],
    },
    {
      id: 'ru-fund-2',
      title: 'Isto é',
      goal: 'Apontar uma coisa e dizer o que ela é.',
      rule: '"Это" aponta qualquer coisa, de qualquer gênero, e também dispensa verbo: "это книга" é "isto livro".',
      pieces: [
        { term: 'это', meaning: 'isto, isso', reading: 'É-ta', trap: 'Escreve-se com "о" no fim, mas se lê "a" — sílaba sem acento vira "a" em russo.' },
        { term: 'книга', meaning: 'livro', reading: 'KNÍ-ga' },
        { term: 'вода', meaning: 'água', reading: 'va-DÁ', trap: 'O "о" sem acento de novo: escreve "voda", lê "vadá".' },
        { term: 'стол', meaning: 'mesa', reading: 'stol' },
        { term: 'дом', meaning: 'casa', reading: 'dom' },
      ],
      sentences: [
        {
          text: 'Это книга.',
          reading: 'É-ta KNÍ-ga',
          meaning: 'Isto é um livro.',
          parts: [
            { chunk: 'Это', label: 'O QUÊ' },
            { chunk: 'книга', label: 'O QUE É' },
          ],
        },
        {
          text: 'Это вода.',
          reading: 'É-ta va-DÁ',
          meaning: 'Isto é água.',
          parts: [
            { chunk: 'Это', label: 'O QUÊ' },
            { chunk: 'вода', label: 'O QUE É' },
          ],
        },
        {
          text: 'Это стол.',
          reading: 'É-ta stol',
          meaning: 'Isto é uma mesa.',
          parts: [
            { chunk: 'Это', label: 'O QUÊ' },
            { chunk: 'стол', label: 'O QUE É' },
          ],
        },
        {
          text: 'Это дом.',
          reading: 'É-ta dom',
          meaning: 'Isto é uma casa.',
          parts: [
            { chunk: 'Это', label: 'O QUÊ' },
            { chunk: 'дом', label: 'O QUE É' },
          ],
        },
      ],
    },
    {
      id: 'ru-fund-3',
      title: 'Ele, ela — e o gênero no fim da palavra',
      goal: 'Descobrir o gênero de qualquer palavra russa olhando a última letra.',
      rule: 'Não existe artigo em russo. O gênero mora no FIM do substantivo: termina em consoante = masculino (стол), em -а = feminino (книга), em -о = neutro (окно). É o oposto do alemão, onde o gênero mora no artigo na frente.',
      pieces: [
        { term: 'он', meaning: 'ele', reading: 'on' },
        { term: 'она', meaning: 'ela', reading: 'a-NÁ' },
        { term: 'оно', meaning: 'ele/ela (neutro)', reading: 'a-NÓ' },
        { term: 'окно', meaning: 'janela', reading: 'ak-NÓ', note: 'Termina em -о: neutro.' },
        { term: 'студентка', meaning: 'estudante (mulher)', reading: 'stu-DIÉNT-ka', note: 'O -ка no fim é o que faz a versão feminina da palavra.' },
        { term: 'здесь', meaning: 'aqui', reading: 'zdiés', note: 'O ь no fim não tem som — só amolece o "s".' },
      ],
      sentences: [
        {
          text: 'Он дома.',
          reading: 'on DÓ-ma',
          meaning: 'Ele está em casa.',
          parts: [
            { chunk: 'Он', label: 'QUEM' },
            { chunk: 'дома', label: 'ONDE' },
          ],
        },
        {
          text: 'Она студентка.',
          reading: 'a-NÁ stu-DIÉNT-ka',
          meaning: 'Ela é estudante.',
          parts: [
            { chunk: 'Она', label: 'QUEM' },
            { chunk: 'студентка', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Это окно.',
          reading: 'É-ta ak-NÓ',
          meaning: 'Isto é uma janela.',
          parts: [
            { chunk: 'Это', label: 'O QUÊ' },
            { chunk: 'окно', label: 'O QUE É' },
          ],
        },
        {
          text: 'Книга здесь.',
          reading: 'KNÍ-ga zdiés',
          meaning: 'O livro está aqui.',
          parts: [
            { chunk: 'Книга', label: 'O QUÊ' },
            { chunk: 'здесь', label: 'ONDE' },
          ],
        },
      ],
    },
    {
      id: 'ru-fund-4',
      title: 'Dizer não',
      goal: 'Negar qualquer frase que você já monta.',
      rule: '"не" vai imediatamente antes da palavra que você está negando, e só dela. "нет" é outra coisa: é a resposta "não" — e também o "não há".',
      pieces: [
        { term: 'не', meaning: 'não (dentro da frase)', reading: 'nie', note: 'Cola na palavra negada: "я не студент".' },
        { term: 'нет', meaning: 'não (a resposta); não há', reading: 'niét', trap: 'Não serve para negar no meio da frase. "Я нет студент" não existe.' },
        { term: 'да', meaning: 'sim', reading: 'da' },
        { term: 'тоже', meaning: 'também', reading: 'TÓ-je' },
      ],
      sentences: [
        {
          text: 'Я не студент.',
          reading: 'iá nie stu-DIÉNT',
          meaning: 'Eu não sou estudante.',
          parts: [
            { chunk: 'Я', label: 'QUEM' },
            { chunk: 'не', label: 'NÃO' },
            { chunk: 'студент', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Это не вода.',
          reading: 'É-ta nie va-DÁ',
          meaning: 'Isto não é água.',
          parts: [
            { chunk: 'Это', label: 'O QUÊ' },
            { chunk: 'не', label: 'NÃO' },
            { chunk: 'вода', label: 'O QUE É' },
          ],
        },
        {
          text: 'Нет, я дома.',
          reading: 'niét, iá DÓ-ma',
          meaning: 'Não, eu estou em casa.',
          parts: [
            { chunk: 'Нет', label: 'RESPOSTA' },
            { chunk: 'я', label: 'QUEM' },
            { chunk: 'дома', label: 'ONDE' },
          ],
        },
        {
          text: 'Он тоже здесь.',
          reading: 'on TÓ-je zdiés',
          meaning: 'Ele também está aqui.',
          parts: [
            { chunk: 'Он', label: 'QUEM' },
            { chunk: 'тоже', label: 'TAMBÉM' },
            { chunk: 'здесь', label: 'ONDE' },
          ],
        },
      ],
    },
    {
      id: 'ru-fund-5',
      title: 'Perguntar',
      goal: 'Fazer perguntas sem mexer em nada na frase.',
      rule: 'Para perguntar sim ou não, a frase não muda: "Ты дома" vira "Ты дома?" só pela entonação. Nada de inverter o verbo como no alemão, nada de "do" como no inglês.',
      pieces: [
        { term: 'кто', meaning: 'quem', reading: 'kto' },
        { term: 'что', meaning: 'o quê', reading: 'chto', trap: 'Escreve-se com "ч" (tch), mas se lê "sh": "shto". É uma das poucas palavras russas que mentem na escrita.' },
        { term: 'где', meaning: 'onde', reading: 'gdié' },
        { term: 'как', meaning: 'como', reading: 'kak' },
      ],
      sentences: [
        {
          text: 'Ты дома?',
          reading: 'ty DÓ-ma',
          meaning: 'Você está em casa?',
          parts: [
            { chunk: 'Ты', label: 'QUEM' },
            { chunk: 'дома', label: 'ONDE' },
          ],
        },
        {
          text: 'Что это?',
          reading: 'shto É-ta',
          meaning: 'O que é isto?',
          parts: [
            { chunk: 'Что', label: 'PERGUNTA' },
            { chunk: 'это', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Кто она?',
          reading: 'kto a-NÁ',
          meaning: 'Quem é ela?',
          parts: [
            { chunk: 'Кто', label: 'PERGUNTA' },
            { chunk: 'она', label: 'QUEM' },
          ],
        },
        {
          text: 'Где книга?',
          reading: 'gdié KNÍ-ga',
          meaning: 'Onde está o livro?',
          parts: [
            { chunk: 'Где', label: 'PERGUNTA' },
            { chunk: 'книга', label: 'O QUÊ' },
          ],
        },
      ],
    },
    {
      id: 'ru-fund-6',
      title: 'Meu, seu',
      goal: 'Dizer que algo é seu — e ver a concordância russa funcionar pela primeira vez.',
      rule: 'O possessivo copia o gênero da COISA, não do dono: мой дом (casa masculina), моя книга (livro feminino), моё окно (neutro). Em português "meu" muda pelo mesmo motivo — a diferença é que aqui o gênero da palavra russa não é o mesmo da portuguesa.',
      pieces: [
        { term: 'мой', meaning: 'meu (masculino)', reading: 'moi' },
        { term: 'моя', meaning: 'minha (feminino)', reading: 'ma-IÁ' },
        { term: 'моё', meaning: 'meu (neutro)', reading: 'ma-IÔ' },
        { term: 'твой', meaning: 'teu (masculino)', reading: 'tvoi' },
        { term: 'твоя', meaning: 'tua (feminino)', reading: 'tva-IÁ' },
        { term: 'друг', meaning: 'amigo', reading: 'druk', note: 'O "г" no fim da palavra endurece e vira "k".' },
      ],
      sentences: [
        {
          text: 'Это мой друг.',
          reading: 'É-ta moi druk',
          meaning: 'Este é o meu amigo.',
          parts: [
            { chunk: 'Это', label: 'O QUÊ' },
            { chunk: 'мой друг', label: 'O QUE É' },
          ],
        },
        {
          text: 'Это моя книга.',
          reading: 'É-ta ma-IÁ KNÍ-ga',
          meaning: 'Este é o meu livro.',
          parts: [
            { chunk: 'Это', label: 'O QUÊ' },
            { chunk: 'моя книга', label: 'O QUE É' },
          ],
        },
        {
          text: 'Где твой дом?',
          reading: 'gdié tvoi dom',
          meaning: 'Onde é a sua casa?',
          parts: [
            { chunk: 'Где', label: 'PERGUNTA' },
            { chunk: 'твой дом', label: 'O QUÊ' },
          ],
        },
        {
          text: 'Моё окно здесь.',
          reading: 'ma-IÔ ak-NÓ zdiés',
          meaning: 'A minha janela é aqui.',
          parts: [
            { chunk: 'Моё окно', label: 'O QUÊ' },
            { chunk: 'здесь', label: 'ONDE' },
          ],
        },
      ],
    },
    {
      id: 'ru-fund-7',
      title: 'O verbo no presente',
      goal: 'Sair das frases sem verbo e dizer o que você faz.',
      rule: 'A terminação muda com quem faz: -ю para я, -ешь para ты, -ет para он/она. E como a terminação já diz quem é, o pronome pode até sumir da frase.',
      pieces: [
        { term: 'работать', meaning: 'trabalhar', reading: 'ra-BÓ-tat', note: 'Forma de dicionário. Numa frase ela sempre troca de fim.' },
        { term: 'я работаю', meaning: 'eu trabalho', reading: 'iá ra-BÓ-ta-iu' },
        { term: 'ты работаешь', meaning: 'você trabalha', reading: 'ty ra-BÓ-ta-iech' },
        { term: 'он работает', meaning: 'ele trabalha', reading: 'on ra-BÓ-ta-iet' },
        { term: 'жить', meaning: 'morar, viver', reading: 'jit' },
        { term: 'я живу', meaning: 'eu moro', reading: 'iá ji-VÚ', trap: 'O radical muda: жить vira жив-. Não dá para colar a terminação no infinitivo.' },
      ],
      sentences: [
        {
          text: 'Я работаю дома.',
          reading: 'iá ra-BÓ-ta-iu DÓ-ma',
          meaning: 'Eu trabalho em casa.',
          parts: [
            { chunk: 'Я', label: 'QUEM' },
            { chunk: 'работаю', label: 'AÇÃO' },
            { chunk: 'дома', label: 'ONDE' },
          ],
        },
        {
          text: 'Ты здесь работаешь?',
          reading: 'ty zdiés ra-BÓ-ta-iech',
          meaning: 'Você trabalha aqui?',
          parts: [
            { chunk: 'Ты', label: 'QUEM' },
            { chunk: 'здесь', label: 'ONDE' },
            { chunk: 'работаешь', label: 'AÇÃO' },
          ],
        },
        {
          text: 'Я живу здесь.',
          reading: 'iá ji-VÚ zdiés',
          meaning: 'Eu moro aqui.',
          parts: [
            { chunk: 'Я', label: 'QUEM' },
            { chunk: 'живу', label: 'AÇÃO' },
            { chunk: 'здесь', label: 'ONDE' },
          ],
        },
        {
          text: 'Он не работает.',
          reading: 'on nie ra-BÓ-ta-iet',
          meaning: 'Ele não trabalha.',
          parts: [
            { chunk: 'Он', label: 'QUEM' },
            { chunk: 'не', label: 'NÃO' },
            { chunk: 'работает', label: 'AÇÃO' },
          ],
        },
      ],
    },
    {
      id: 'ru-fund-8',
      title: 'Onde: в, на e a terminação que muda',
      goal: 'Dizer onde algo está — e ver o primeiro caso russo acontecer.',
      rule: 'Lugar parado pede в ou на, e a palavra MUDA DE FIM: Москва vira в Москве, стол vira на столе. O caso não está num artigo na frente, como no alemão — está na última letra da própria palavra.',
      pieces: [
        { term: 'в', meaning: 'em, dentro de', reading: 'v', note: 'Uma letra só, colada na palavra seguinte na fala.' },
        { term: 'на', meaning: 'em cima de, em', reading: 'na' },
        { term: 'в Москве', meaning: 'em Moscou', reading: 'v mask-VIÉ', trap: 'Москва termina em -а; com "в" ela vira Москве. Dizer "в Москва" é o erro que todo iniciante comete.' },
        { term: 'на столе', meaning: 'em cima da mesa', reading: 'na sta-LIÉ', note: 'стол ganha um -е no fim.' },
        { term: 'в доме', meaning: 'dentro da casa', reading: 'v DÓ-mie' },
        { term: 'город', meaning: 'cidade', reading: 'GÓ-rat' },
      ],
      sentences: [
        {
          text: 'Я в Москве.',
          reading: 'iá v mask-VIÉ',
          meaning: 'Eu estou em Moscou.',
          parts: [
            { chunk: 'Я', label: 'QUEM' },
            { chunk: 'в Москве', label: 'ONDE' },
          ],
        },
        {
          text: 'Книга на столе.',
          reading: 'KNÍ-ga na sta-LIÉ',
          meaning: 'O livro está em cima da mesa.',
          parts: [
            { chunk: 'Книга', label: 'O QUÊ' },
            { chunk: 'на столе', label: 'ONDE' },
          ],
        },
        {
          text: 'Он работает в Москве.',
          reading: 'on ra-BÓ-ta-iet v mask-VIÉ',
          meaning: 'Ele trabalha em Moscou.',
          parts: [
            { chunk: 'Он', label: 'QUEM' },
            { chunk: 'работает', label: 'AÇÃO' },
            { chunk: 'в Москве', label: 'ONDE' },
          ],
        },
        {
          text: 'Моя книга не в доме.',
          reading: 'ma-IÁ KNÍ-ga nie v DÓ-mie',
          meaning: 'O meu livro não está dentro da casa.',
          parts: [
            { chunk: 'Моя книга', label: 'O QUÊ' },
            { chunk: 'не', label: 'NÃO' },
            { chunk: 'в доме', label: 'ONDE' },
          ],
        },
      ],
    },
  ],
};

/** As pecas das licoes ANTERIORES, para servirem de distrator plausivel. */
export function piecesUpTo(languageCode: string, lessonId: string): FoundationPiece[] {
  const lessons = FOUNDATION_TRACKS[languageCode] ?? [];
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index < 0) return [];
  return lessons.slice(0, index).flatMap((l) => l.pieces);
}

export function findFoundationLesson(
  languageCode: string,
  id: string,
): FoundationLesson | undefined {
  return (FOUNDATION_TRACKS[languageCode] ?? []).find((l) => l.id === id);
}

/**
 * Mesma convencao de `alphabetTopicId` e de `structure:`: o prefixo e o que
 * permite que alfabeto, fundamentos, estrutura e gramatica dividam a tabela
 * `grammar_progress` sem colidir.
 */
export function foundationTopicId(lessonId: string): string {
  return `foundation:${lessonId}`;
}
