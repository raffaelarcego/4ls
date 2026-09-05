import { CefrLevel, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LANGUAGES = [
  { code: 'en', name: 'English', flag: 'US' },
  { code: 'es', name: 'Espanol', flag: 'ES' },
  { code: 'de', name: 'Deutsch', flag: 'DE' },
];

const ACHIEVEMENTS = [
  { code: 'FIRST_SESSION', name: 'Primeira sessao', description: 'Concluiu a primeira sessao de estudo.', xp: 50 },
  { code: 'TEN_SESSIONS', name: '10 sessoes', description: 'Concluiu 10 sessoes de estudo.', xp: 150 },
  { code: 'STREAK_7', name: '7 dias seguidos', description: 'Manteve o streak por 7 dias.', xp: 100 },
  { code: 'STREAK_30', name: '30 dias seguidos', description: 'Manteve o streak por 30 dias.', xp: 500 },
  { code: 'WORDS_100', name: '100 palavras', description: 'Tem 100 termos no vocabulario.', xp: 100 },
  { code: 'WORDS_1000', name: '1000 palavras', description: 'Tem 1000 termos no vocabulario.', xp: 1000 },
  { code: 'FIRST_CONVERSATION', name: 'Primeira conversa', description: 'Conversou com o tutor de IA.', xp: 75 },
];

/**
 * Vocabulario inicial em contexto -- nunca "palavra = traducao" solta.
 * Cada item traz exemplo e traducao do exemplo, conforme o principio 2.3.
 */
type SeedWord = {
  term: string;
  meaning: string;
  example: string;
  translation: string;
  level: CefrLevel;
};

const VOCABULARY: Record<string, SeedWord[]> = {
  en: [
    { term: 'to reach out', meaning: 'entrar em contato', example: 'I will reach out to the team tomorrow.', translation: 'Vou entrar em contato com a equipe amanha.', level: CefrLevel.B1 },
    { term: 'to look forward to', meaning: 'aguardar ansiosamente', example: 'I look forward to hearing from you.', translation: 'Aguardo seu retorno.', level: CefrLevel.B1 },
    { term: 'straightforward', meaning: 'direto, simples', example: 'The setup is pretty straightforward.', translation: 'A configuracao e bem simples.', level: CefrLevel.B2 },
    { term: 'to keep track of', meaning: 'acompanhar, controlar', example: 'I keep track of my expenses in a spreadsheet.', translation: 'Eu controlo meus gastos numa planilha.', level: CefrLevel.B1 },
    { term: 'to come up with', meaning: 'bolar, inventar', example: 'She came up with a great idea.', translation: 'Ela bolou uma otima ideia.', level: CefrLevel.B1 },
    { term: 'thorough', meaning: 'minucioso', example: 'He did a thorough review of the code.', translation: 'Ele fez uma revisao minuciosa do codigo.', level: CefrLevel.B2 },
    { term: 'to be worth it', meaning: 'valer a pena', example: 'The extra effort was worth it.', translation: 'O esforco extra valeu a pena.', level: CefrLevel.B1 },
    { term: 'regardless of', meaning: 'independentemente de', example: 'We will ship it regardless of the delay.', translation: 'Vamos entregar independentemente do atraso.', level: CefrLevel.B2 },
    { term: 'to figure out', meaning: 'descobrir, entender', example: 'I could not figure out the problem.', translation: 'Eu nao consegui entender o problema.', level: CefrLevel.B1 },
    { term: 'to rely on', meaning: 'depender de, confiar em', example: 'We rely on this service every day.', translation: 'Dependemos deste servico todos os dias.', level: CefrLevel.B1 },
    { term: 'seamless', meaning: 'sem atrito, fluido', example: 'The migration was seamless.', translation: 'A migracao foi fluida.', level: CefrLevel.C1 },
    { term: 'to bring up', meaning: 'trazer a tona, mencionar', example: 'She brought up an important point.', translation: 'Ela mencionou um ponto importante.', level: CefrLevel.B2 },
    { term: 'unless', meaning: 'a menos que', example: 'We cannot deploy unless the tests pass.', translation: 'Nao podemos publicar a menos que os testes passem.', level: CefrLevel.B1 },
    { term: 'to narrow down', meaning: 'restringir, afunilar', example: 'Let us narrow down the options.', translation: 'Vamos afunilar as opcoes.', level: CefrLevel.B2 },
    { term: 'cumbersome', meaning: 'trabalhoso, pesado', example: 'The old process was cumbersome.', translation: 'O processo antigo era trabalhoso.', level: CefrLevel.C1 },
  ],
  es: [
    { term: 'sin embargo', meaning: 'no entanto', example: 'Sin embargo, el resultado fue bueno.', translation: 'No entanto, o resultado foi bom.', level: CefrLevel.A2 },
    { term: 'el trabajo', meaning: 'o trabalho', example: 'Voy al trabajo en autobus.', translation: 'Vou para o trabalho de onibus.', level: CefrLevel.A1 },
    { term: 'tener ganas de', meaning: 'estar com vontade de', example: 'Tengo ganas de viajar.', translation: 'Estou com vontade de viajar.', level: CefrLevel.A2 },
    { term: 'aunque', meaning: 'embora, ainda que', example: 'Aunque llueva, vamos a salir.', translation: 'Ainda que chova, vamos sair.', level: CefrLevel.B1 },
    { term: 'la carpeta', meaning: 'a pasta (falso cognato: nao e carpete)', example: 'Guarda el archivo en esa carpeta.', translation: 'Guarde o arquivo naquela pasta.', level: CefrLevel.A2 },
    { term: 'el vaso', meaning: 'o copo (falso cognato: nao e vaso)', example: 'Quiero un vaso de agua.', translation: 'Quero um copo de agua.', level: CefrLevel.A1 },
    { term: 'la oficina', meaning: 'o escritorio (falso cognato: nao e oficina)', example: 'Trabajo en una oficina pequena.', translation: 'Trabalho num escritorio pequeno.', level: CefrLevel.A1 },
    { term: 'acordarse de', meaning: 'lembrar-se de', example: 'No me acuerdo de su nombre.', translation: 'Nao me lembro do nome dele.', level: CefrLevel.A2 },
    { term: 'ahora mismo', meaning: 'agora mesmo', example: 'Lo necesito ahora mismo.', translation: 'Preciso disso agora mesmo.', level: CefrLevel.A2 },
    { term: 'darse cuenta', meaning: 'perceber, dar-se conta', example: 'Me di cuenta del error.', translation: 'Percebi o erro.', level: CefrLevel.B1 },
    { term: 'el rato', meaning: 'o momento, um tempinho', example: 'Espera un rato, por favor.', translation: 'Espere um pouco, por favor.', level: CefrLevel.A2 },
    { term: 'echar de menos', meaning: 'sentir falta', example: 'Echo de menos a mi familia.', translation: 'Sinto falta da minha familia.', level: CefrLevel.B1 },
    { term: 'la pantalla', meaning: 'a tela', example: 'La pantalla esta muy brillante.', translation: 'A tela esta muito brilhante.', level: CefrLevel.A1 },
    { term: 'todavia', meaning: 'ainda', example: 'Todavia no he terminado.', translation: 'Ainda nao terminei.', level: CefrLevel.A2 },
    { term: 'a menudo', meaning: 'com frequencia', example: 'Voy al gimnasio a menudo.', translation: 'Vou a academia com frequencia.', level: CefrLevel.A2 },
  ],
  de: [
    { term: 'das Haus', meaning: 'a casa', example: 'Ich bin zu Hause.', translation: 'Estou em casa.', level: CefrLevel.A1 },
    { term: 'die Arbeit', meaning: 'o trabalho', example: 'Ich fahre zur Arbeit.', translation: 'Vou para o trabalho.', level: CefrLevel.A1 },
    { term: 'gehen', meaning: 'ir, andar', example: 'Wir gehen ins Kino.', translation: 'Nos vamos ao cinema.', level: CefrLevel.A1 },
    { term: 'gestern', meaning: 'ontem', example: 'Gestern war ich muede.', translation: 'Ontem eu estava cansado.', level: CefrLevel.A1 },
    { term: 'weil', meaning: 'porque (manda o verbo para o fim)', example: 'Ich bleibe zu Hause, weil ich krank bin.', translation: 'Fico em casa porque estou doente.', level: CefrLevel.A2 },
    { term: 'der Termin', meaning: 'o compromisso, a consulta', example: 'Ich habe morgen einen Termin.', translation: 'Tenho um compromisso amanha.', level: CefrLevel.A2 },
    { term: 'brauchen', meaning: 'precisar de', example: 'Ich brauche mehr Zeit.', translation: 'Preciso de mais tempo.', level: CefrLevel.A1 },
    { term: 'schon', meaning: 'ja', example: 'Ich habe schon gegessen.', translation: 'Eu ja comi.', level: CefrLevel.A1 },
    { term: 'die Woche', meaning: 'a semana', example: 'Naechste Woche fahre ich weg.', translation: 'Semana que vem eu viajo.', level: CefrLevel.A1 },
    { term: 'verstehen', meaning: 'entender', example: 'Ich verstehe dich nicht.', translation: 'Eu nao te entendo.', level: CefrLevel.A1 },
    { term: 'deshalb', meaning: 'por isso (inverte sujeito e verbo)', example: 'Es regnet, deshalb bleibe ich hier.', translation: 'Esta chovendo, por isso eu fico aqui.', level: CefrLevel.A2 },
    { term: 'sich freuen auf', meaning: 'estar animado com algo futuro', example: 'Ich freue mich auf das Wochenende.', translation: 'Estou animado para o fim de semana.', level: CefrLevel.A2 },
    { term: 'die Wohnung', meaning: 'o apartamento', example: 'Meine Wohnung ist klein.', translation: 'Meu apartamento e pequeno.', level: CefrLevel.A1 },
    { term: 'immer', meaning: 'sempre', example: 'Er kommt immer zu spaet.', translation: 'Ele sempre chega atrasado.', level: CefrLevel.A1 },
    { term: 'trotzdem', meaning: 'mesmo assim', example: 'Es war schwer, trotzdem habe ich es geschafft.', translation: 'Foi dificil, mesmo assim eu consegui.', level: CefrLevel.A2 },
  ],
};

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

  console.log('Semeando vocabulario...');
  let count = 0;
  for (const [code, words] of Object.entries(VOCABULARY)) {
    const language = await prisma.language.findUniqueOrThrow({ where: { code } });
    for (const word of words) {
      await prisma.vocabulary.upsert({
        where: { languageId_term: { languageId: language.id, term: word.term } },
        create: { ...word, languageId: language.id, source: 'seed' },
        update: {},
      });
      count += 1;
    }
  }

  console.log(`Pronto: ${LANGUAGES.length} idiomas, ${ACHIEVEMENTS.length} conquistas, ${count} termos.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
