import '../src/common/timezone';
import { CefrLevel, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LANGUAGES = [
  { code: 'en', name: 'English', flag: 'GB' },
  { code: 'es', name: 'Espanol', flag: 'ES' },
  { code: 'de', name: 'Deutsch', flag: 'DE' },
  { code: 'ru', name: 'Russkiy', flag: 'RU' },
];

/** Os idiomas em que TODO conceito precisa existir. */
const STUDY_CODES = LANGUAGES.map((l) => l.code);

const ACHIEVEMENTS = [
  { code: 'FIRST_SESSION', name: 'Primeira sessao', description: 'Concluiu a primeira sessao de estudo.', xp: 50 },
  { code: 'TEN_SESSIONS', name: '10 sessoes', description: 'Concluiu 10 sessoes de estudo.', xp: 150 },
  { code: 'STREAK_7', name: '7 dias seguidos', description: 'Manteve o streak por 7 dias.', xp: 100 },
  { code: 'STREAK_30', name: '30 dias seguidos', description: 'Manteve o streak por 30 dias.', xp: 500 },
  { code: 'WORDS_100', name: '100 palavras', description: 'Tem 100 termos no vocabulario.', xp: 100 },
  { code: 'WORDS_1000', name: '1000 palavras', description: 'Tem 1000 termos no vocabulario.', xp: 1000 },
  { code: 'FIRST_CONVERSATION', name: 'Primeira conversa', description: 'Conversou com o tutor de IA.', xp: 75 },
  { code: 'FIRST_PROMOTION', name: 'Primeiro chefe', description: 'Venceu um chefe de fase e subiu um idioma de nivel.', xp: 300 },
];

/**
 * Vocabulario inicial organizado por CONCEITO, nao por idioma.
 *
 * A unidade de aprendizado deixou de ser a palavra e passou a ser o
 * significado: "trabalho" entra na sessao uma vez e chega ao aluno nos quatro
 * idiomas de uma vez so. E o que faz uma lingua sustentar a memoria das
 * outras -- "Arbeit" fica muito mais facil quando ela entrou pendurada no
 * mesmo gancho que "work", "trabajo" e "rabota".
 *
 * Cada realizacao continua trazendo exemplo e traducao do exemplo, conforme o
 * principio 2.3: nunca "palavra = traducao" solta.
 */
type SeedEntry = {
  term: string;
  meaning: string;
  example: string;
  translation: string;
};

type SeedConcept = {
  /** Chave estavel em portugues. */
  slug: string;
  /** Como o conceito se le em portugues. */
  gloss: string;
  /** O que vale notar sobre o conceito atravessando os quatro idiomas. */
  note?: string;
  level: CefrLevel;
  entries: Record<string, SeedEntry>;
};

const CONCEPTS: SeedConcept[] = [
  {
    slug: 'trabalho',
    gloss: 'o trabalho',
    level: CefrLevel.A1,
    note: 'Os quatro dizem "ir ao trabalho" com preposicao, mas alemao e russo ainda marcam o caso do substantivo depois dela.',
    entries: {
      en: { term: 'work', meaning: 'o trabalho', example: 'I go to work by bus.', translation: 'Vou para o trabalho de onibus.' },
      es: { term: 'el trabajo', meaning: 'o trabalho', example: 'Voy al trabajo en autobus.', translation: 'Vou para o trabalho de onibus.' },
      de: { term: 'die Arbeit', meaning: 'o trabalho', example: 'Ich fahre mit dem Bus zur Arbeit.', translation: 'Vou para o trabalho de onibus.' },
      ru: { term: 'работа', meaning: 'o trabalho (rabota)', example: 'Я еду на работу на автобусе.', translation: 'Vou para o trabalho de onibus.' },
    },
  },
  {
    slug: 'casa',
    gloss: 'a casa, o lar',
    level: CefrLevel.A1,
    note: 'Ingles, alemao e russo tem uma forma propria para "em casa" (at home / zu Hause / дома) que nao e o substantivo comum.',
    entries: {
      en: { term: 'home', meaning: 'a casa, o lar', example: 'I am at home.', translation: 'Estou em casa.' },
      es: { term: 'la casa', meaning: 'a casa', example: 'Estoy en casa.', translation: 'Estou em casa.' },
      de: { term: 'das Haus', meaning: 'a casa (em casa = "zu Hause")', example: 'Ich bin zu Hause.', translation: 'Estou em casa.' },
      ru: { term: 'дом', meaning: 'a casa (dom; em casa = "дома")', example: 'Я дома.', translation: 'Estou em casa.' },
    },
  },
  {
    slug: 'semana',
    gloss: 'a semana',
    level: CefrLevel.A1,
    entries: {
      en: { term: 'week', meaning: 'a semana', example: 'Next week I am travelling.', translation: 'Semana que vem eu viajo.' },
      es: { term: 'la semana', meaning: 'a semana', example: 'La semana que viene viajo.', translation: 'Semana que vem eu viajo.' },
      de: { term: 'die Woche', meaning: 'a semana', example: 'Naechste Woche fahre ich weg.', translation: 'Semana que vem eu viajo.' },
      ru: { term: 'неделя', meaning: 'a semana (nedelya)', example: 'На следующей неделе я уезжаю.', translation: 'Semana que vem eu viajo.' },
    },
  },
  {
    slug: 'entender',
    gloss: 'entender',
    level: CefrLevel.A1,
    entries: {
      en: { term: 'to understand', meaning: 'entender', example: 'I do not understand you.', translation: 'Eu nao te entendo.' },
      es: { term: 'entender', meaning: 'entender', example: 'No te entiendo.', translation: 'Eu nao te entendo.' },
      de: { term: 'verstehen', meaning: 'entender', example: 'Ich verstehe dich nicht.', translation: 'Eu nao te entendo.' },
      ru: { term: 'понимать', meaning: 'entender (ponimat)', example: 'Я тебя не понимаю.', translation: 'Eu nao te entendo.' },
    },
  },
  {
    slug: 'precisar',
    gloss: 'precisar de',
    level: CefrLevel.A1,
    note: 'Aqui o russo troca de estrutura: nao existe "eu preciso", e sim "a mim e necessario" -- quem precisa vai para o dativo.',
    entries: {
      en: { term: 'to need', meaning: 'precisar de', example: 'I need more time.', translation: 'Preciso de mais tempo.' },
      es: { term: 'necesitar', meaning: 'precisar de', example: 'Necesito mas tiempo.', translation: 'Preciso de mais tempo.' },
      de: { term: 'brauchen', meaning: 'precisar de (pede acusativo)', example: 'Ich brauche mehr Zeit.', translation: 'Preciso de mais tempo.' },
      ru: { term: 'нужно', meaning: 'precisar de (nuzhno; literalmente "a mim e necessario")', example: 'Мне нужно больше времени.', translation: 'Preciso de mais tempo.' },
    },
  },
  {
    slug: 'sempre',
    gloss: 'sempre',
    level: CefrLevel.A1,
    entries: {
      en: { term: 'always', meaning: 'sempre', example: 'He is always late.', translation: 'Ele sempre chega atrasado.' },
      es: { term: 'siempre', meaning: 'sempre', example: 'El siempre llega tarde.', translation: 'Ele sempre chega atrasado.' },
      de: { term: 'immer', meaning: 'sempre', example: 'Er kommt immer zu spaet.', translation: 'Ele sempre chega atrasado.' },
      ru: { term: 'всегда', meaning: 'sempre (vsegda)', example: 'Он всегда опаздывает.', translation: 'Ele sempre chega atrasado.' },
    },
  },
  {
    slug: 'ontem',
    gloss: 'ontem',
    level: CefrLevel.A1,
    entries: {
      en: { term: 'yesterday', meaning: 'ontem', example: 'Yesterday I was tired.', translation: 'Ontem eu estava cansado.' },
      es: { term: 'ayer', meaning: 'ontem', example: 'Ayer estaba cansado.', translation: 'Ontem eu estava cansado.' },
      de: { term: 'gestern', meaning: 'ontem', example: 'Gestern war ich muede.', translation: 'Ontem eu estava cansado.' },
      ru: { term: 'вчера', meaning: 'ontem (vchera)', example: 'Вчера я был уставшим.', translation: 'Ontem eu estava cansado.' },
    },
  },
  {
    slug: 'ja',
    gloss: 'ja (antes do esperado)',
    level: CefrLevel.A1,
    entries: {
      en: { term: 'already', meaning: 'ja', example: 'I have already eaten.', translation: 'Eu ja comi.' },
      es: { term: 'ya', meaning: 'ja', example: 'Ya he comido.', translation: 'Eu ja comi.' },
      de: { term: 'schon', meaning: 'ja', example: 'Ich habe schon gegessen.', translation: 'Eu ja comi.' },
      ru: { term: 'уже', meaning: 'ja (uzhe)', example: 'Я уже поел.', translation: 'Eu ja comi.' },
    },
  },
  {
    slug: 'ir',
    gloss: 'ir',
    level: CefrLevel.A1,
    note: 'O russo separa ir a pe (идти) de ir em veiculo (ехать). O alemao faz algo parecido com gehen e fahren.',
    entries: {
      en: { term: 'to go', meaning: 'ir', example: 'We are going to the cinema.', translation: 'Nos vamos ao cinema.' },
      es: { term: 'ir', meaning: 'ir', example: 'Vamos al cine.', translation: 'Nos vamos ao cinema.' },
      de: { term: 'gehen', meaning: 'ir (a pe; de veiculo e "fahren")', example: 'Wir gehen ins Kino.', translation: 'Nos vamos ao cinema.' },
      ru: { term: 'идти', meaning: 'ir a pe (idti; de veiculo e "ехать")', example: 'Мы идём в кино.', translation: 'Nos vamos ao cinema.' },
    },
  },
  {
    slug: 'tela',
    gloss: 'a tela',
    level: CefrLevel.A1,
    entries: {
      en: { term: 'screen', meaning: 'a tela', example: 'The screen is too bright.', translation: 'A tela esta muito brilhante.' },
      es: { term: 'la pantalla', meaning: 'a tela', example: 'La pantalla esta muy brillante.', translation: 'A tela esta muito brilhante.' },
      de: { term: 'der Bildschirm', meaning: 'a tela', example: 'Der Bildschirm ist zu hell.', translation: 'A tela esta muito brilhante.' },
      ru: { term: 'экран', meaning: 'a tela (ekran)', example: 'Экран слишком яркий.', translation: 'A tela esta muito brilhante.' },
    },
  },
  {
    slug: 'ainda-nao',
    gloss: 'ainda (nao)',
    level: CefrLevel.A2,
    entries: {
      en: { term: 'yet', meaning: 'ainda (em frase negativa vai para o fim)', example: 'I have not finished yet.', translation: 'Ainda nao terminei.' },
      es: { term: 'todavia', meaning: 'ainda', example: 'Todavia no he terminado.', translation: 'Ainda nao terminei.' },
      de: { term: 'noch', meaning: 'ainda', example: 'Ich bin noch nicht fertig.', translation: 'Ainda nao terminei.' },
      ru: { term: 'ещё', meaning: 'ainda (eshchyo)', example: 'Я ещё не закончил.', translation: 'Ainda nao terminei.' },
    },
  },
  {
    slug: 'porque',
    gloss: 'porque (a causa)',
    level: CefrLevel.A2,
    note: 'So o alemao muda a ordem da frase: "weil" manda o verbo para o fim. Ingles, espanhol e russo mantem a ordem normal.',
    entries: {
      en: { term: 'because', meaning: 'porque', example: 'I am staying home because I am sick.', translation: 'Fico em casa porque estou doente.' },
      es: { term: 'porque', meaning: 'porque', example: 'Me quedo en casa porque estoy enfermo.', translation: 'Fico em casa porque estou doente.' },
      de: { term: 'weil', meaning: 'porque (manda o verbo para o fim da oracao)', example: 'Ich bleibe zu Hause, weil ich krank bin.', translation: 'Fico em casa porque estou doente.' },
      ru: { term: 'потому что', meaning: 'porque (potomu chto)', example: 'Я остаюсь дома, потому что я болен.', translation: 'Fico em casa porque estou doente.' },
    },
  },
  {
    slug: 'compromisso',
    gloss: 'o compromisso, a hora marcada',
    level: CefrLevel.A2,
    entries: {
      en: { term: 'appointment', meaning: 'o compromisso marcado', example: 'I have an appointment tomorrow.', translation: 'Tenho um compromisso amanha.' },
      es: { term: 'la cita', meaning: 'o compromisso marcado', example: 'Tengo una cita manana.', translation: 'Tenho um compromisso amanha.' },
      de: { term: 'der Termin', meaning: 'o compromisso marcado', example: 'Ich habe morgen einen Termin.', translation: 'Tenho um compromisso amanha.' },
      ru: { term: 'встреча', meaning: 'o compromisso, o encontro marcado (vstrecha)', example: 'У меня завтра встреча.', translation: 'Tenho um compromisso amanha.' },
    },
  },
  {
    slug: 'com-frequencia',
    gloss: 'com frequencia',
    level: CefrLevel.A2,
    entries: {
      en: { term: 'often', meaning: 'com frequencia', example: 'I go to the gym often.', translation: 'Vou a academia com frequencia.' },
      es: { term: 'a menudo', meaning: 'com frequencia', example: 'Voy al gimnasio a menudo.', translation: 'Vou a academia com frequencia.' },
      de: { term: 'oft', meaning: 'com frequencia', example: 'Ich gehe oft ins Fitnessstudio.', translation: 'Vou a academia com frequencia.' },
      ru: { term: 'часто', meaning: 'com frequencia (chasto)', example: 'Я часто хожу в спортзал.', translation: 'Vou a academia com frequencia.' },
    },
  },
  {
    slug: 'perceber',
    gloss: 'perceber, dar-se conta',
    level: CefrLevel.B1,
    entries: {
      en: { term: 'to realize', meaning: 'perceber, dar-se conta', example: 'I realized the mistake.', translation: 'Percebi o erro.' },
      es: { term: 'darse cuenta', meaning: 'perceber, dar-se conta', example: 'Me di cuenta del error.', translation: 'Percebi o erro.' },
      de: { term: 'merken', meaning: 'perceber ("sich etwas merken" e memorizar, cuidado)', example: 'Ich habe den Fehler gemerkt.', translation: 'Percebi o erro.' },
      ru: { term: 'заметить', meaning: 'perceber, notar (zametit)', example: 'Я заметил ошибку.', translation: 'Percebi o erro.' },
    },
  },
  {
    slug: 'entrar-em-contato',
    gloss: 'entrar em contato',
    level: CefrLevel.B1,
    entries: {
      en: { term: 'to reach out', meaning: 'entrar em contato', example: 'I will reach out to the team tomorrow.', translation: 'Vou entrar em contato com a equipe amanha.' },
      es: { term: 'ponerse en contacto', meaning: 'entrar em contato', example: 'Manana me pondre en contacto con el equipo.', translation: 'Vou entrar em contato com a equipe amanha.' },
      de: { term: 'sich melden', meaning: 'entrar em contato (verbo reflexivo)', example: 'Ich melde mich morgen beim Team.', translation: 'Vou entrar em contato com a equipe amanha.' },
      ru: { term: 'связаться', meaning: 'entrar em contato (svyazatsya; pede "с" + instrumental)', example: 'Я завтра свяжусь с командой.', translation: 'Vou entrar em contato com a equipe amanha.' },
    },
  },
  {
    slug: 'valer-a-pena',
    gloss: 'valer a pena',
    level: CefrLevel.B1,
    entries: {
      en: { term: 'to be worth it', meaning: 'valer a pena', example: 'The extra effort was worth it.', translation: 'O esforco extra valeu a pena.' },
      es: { term: 'valer la pena', meaning: 'valer a pena', example: 'El esfuerzo extra valio la pena.', translation: 'O esforco extra valeu a pena.' },
      de: { term: 'sich lohnen', meaning: 'valer a pena (verbo reflexivo)', example: 'Der zusaetzliche Aufwand hat sich gelohnt.', translation: 'O esforco extra valeu a pena.' },
      ru: { term: 'стоить того', meaning: 'valer a pena (stoit togo)', example: 'Дополнительные усилия того стоили.', translation: 'O esforco extra valeu a pena.' },
    },
  },
  {
    slug: 'mesmo-assim',
    gloss: 'mesmo assim',
    level: CefrLevel.A2,
    note: 'Em alemao "trotzdem" ocupa a primeira posicao e empurra o sujeito para depois do verbo -- os outros tres nao mexem na ordem.',
    entries: {
      en: { term: 'even so', meaning: 'mesmo assim', example: 'It was hard, but even so I made it.', translation: 'Foi dificil, mesmo assim eu consegui.' },
      es: { term: 'aun asi', meaning: 'mesmo assim', example: 'Fue dificil, aun asi lo logre.', translation: 'Foi dificil, mesmo assim eu consegui.' },
      de: { term: 'trotzdem', meaning: 'mesmo assim (inverte sujeito e verbo)', example: 'Es war schwer, trotzdem habe ich es geschafft.', translation: 'Foi dificil, mesmo assim eu consegui.' },
      ru: { term: 'всё равно', meaning: 'mesmo assim, de qualquer jeito (vsyo ravno)', example: 'Было трудно, но я всё равно справился.', translation: 'Foi dificil, mesmo assim eu consegui.' },
    },
  },
  {
    slug: 'sentir-falta',
    gloss: 'sentir falta de',
    level: CefrLevel.B1,
    note: 'Ingles e alemao tratam como objeto direto; espanhol e russo pedem preposicao.',
    entries: {
      en: { term: 'to miss', meaning: 'sentir falta de', example: 'I miss my family.', translation: 'Sinto falta da minha familia.' },
      es: { term: 'echar de menos', meaning: 'sentir falta de', example: 'Echo de menos a mi familia.', translation: 'Sinto falta da minha familia.' },
      de: { term: 'vermissen', meaning: 'sentir falta de (objeto direto, sem preposicao)', example: 'Ich vermisse meine Familie.', translation: 'Sinto falta da minha familia.' },
      ru: { term: 'скучать по', meaning: 'sentir falta de (skuchat po; pede dativo depois de "по")', example: 'Я скучаю по своей семье.', translation: 'Sinto falta da minha familia.' },
    },
  },
  {
    slug: 'escritorio',
    gloss: 'o escritorio',
    level: CefrLevel.A1,
    note: 'Falso cognato classico: "la oficina" em espanhol e escritorio, nao oficina mecanica.',
    entries: {
      en: { term: 'office', meaning: 'o escritorio', example: 'I work in a small office.', translation: 'Trabalho num escritorio pequeno.' },
      es: { term: 'la oficina', meaning: 'o escritorio (falso cognato: nao e oficina mecanica)', example: 'Trabajo en una oficina pequena.', translation: 'Trabalho num escritorio pequeno.' },
      de: { term: 'das Buero', meaning: 'o escritorio', example: 'Ich arbeite in einem kleinen Buero.', translation: 'Trabalho num escritorio pequeno.' },
      ru: { term: 'офис', meaning: 'o escritorio (ofis)', example: 'Я работаю в маленьком офисе.', translation: 'Trabalho num escritorio pequeno.' },
    },
  },
  {
    slug: 'copo',
    gloss: 'o copo',
    level: CefrLevel.A1,
    note: 'Outro falso cognato: "el vaso" em espanhol e copo, nao vaso de flores.',
    entries: {
      en: { term: 'glass', meaning: 'o copo', example: 'I want a glass of water.', translation: 'Quero um copo de agua.' },
      es: { term: 'el vaso', meaning: 'o copo (falso cognato: nao e vaso de flores)', example: 'Quiero un vaso de agua.', translation: 'Quero um copo de agua.' },
      de: { term: 'das Glas', meaning: 'o copo', example: 'Ich moechte ein Glas Wasser.', translation: 'Quero um copo de agua.' },
      ru: { term: 'стакан', meaning: 'o copo (stakan)', example: 'Я хочу стакан воды.', translation: 'Quero um copo de agua.' },
    },
  },
  {
    slug: 'no-entanto',
    gloss: 'no entanto',
    level: CefrLevel.A2,
    entries: {
      en: { term: 'however', meaning: 'no entanto', example: 'However, the result was good.', translation: 'No entanto, o resultado foi bom.' },
      es: { term: 'sin embargo', meaning: 'no entanto', example: 'Sin embargo, el resultado fue bueno.', translation: 'No entanto, o resultado foi bom.' },
      de: { term: 'jedoch', meaning: 'no entanto', example: 'Das Ergebnis war jedoch gut.', translation: 'No entanto, o resultado foi bom.' },
      ru: { term: 'однако', meaning: 'no entanto (odnako)', example: 'Однако результат был хорошим.', translation: 'No entanto, o resultado foi bom.' },
    },
  },
];

async function main() {
  console.log('Semeando idiomas...');
  for (const language of LANGUAGES) {
    await prisma.language.upsert({
      where: { code: language.code },
      create: language,
      update: { name: language.name, flag: language.flag },
    });
  }

  console.log('Semeando conquistas...');
  for (const achievement of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      create: achievement,
      update: achievement,
    });
  }

  // Um conceito incompleto quebraria a promessa do produto: se ele entra na
  // sessao, entra nos quatro idiomas. Melhor falhar o seed do que semear um
  // conceito manco, que depois viraria uma revisao so em ingles.
  for (const concept of CONCEPTS) {
    const missing = STUDY_CODES.filter((code) => !concept.entries[code]);
    if (missing.length > 0) {
      throw new Error(`Conceito "${concept.slug}" sem traducao em: ${missing.join(', ')}.`);
    }
  }

  console.log('Semeando conceitos e vocabulario...');
  const languages = await prisma.language.findMany();
  const languageId = new Map(languages.map((l) => [l.code, l.id]));

  let terms = 0;
  for (const seed of CONCEPTS) {
    const concept = await prisma.concept.upsert({
      where: { slug: seed.slug },
      create: { slug: seed.slug, gloss: seed.gloss, note: seed.note, level: seed.level, source: 'seed' },
      update: { gloss: seed.gloss, note: seed.note, level: seed.level },
    });

    for (const [code, entry] of Object.entries(seed.entries)) {
      const id = languageId.get(code);
      if (!id) continue;

      await prisma.vocabulary.upsert({
        where: { languageId_term: { languageId: id, term: entry.term } },
        create: {
          languageId: id,
          conceptId: concept.id,
          term: entry.term,
          meaning: entry.meaning,
          example: entry.example,
          translation: entry.translation,
          level: seed.level,
          source: 'seed',
        },
        // O vinculo com o conceito e atualizado mesmo em termo que ja existia:
        // e assim que o vocabulario semeado antes desta mudanca entra na rede.
        update: {
          conceptId: concept.id,
          meaning: entry.meaning,
          example: entry.example,
          translation: entry.translation,
        },
      });
      terms += 1;
    }
  }

  console.log(
    `Pronto: ${LANGUAGES.length} idiomas, ${ACHIEVEMENTS.length} conquistas, ${CONCEPTS.length} conceitos, ${terms} termos.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
