import '../src/common/timezone';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { StructureService } from '../src/modules/structure/structure.service';
import { CanDoService } from '../src/modules/cando/can-do.service';
import { ReadingService } from '../src/modules/reading/reading.service';
import { MorphologyService } from '../src/modules/morphology/morphology.service';

/**
 * Prepara o conteudo de estudo ANTES da hora do estudo.
 *
 * Gerar uma aula de estrutura leva cerca de dois minutos -- 116s medidos em
 * russo, porque o cirilico rende bem menos caractere por token que o alfabeto
 * latino e a aula inteira sai numa chamada so. A funcao da API na Vercel morre
 * aos 60s (`maxDuration`), entao gerar durante a sessao entregava "network
 * error" no meio do estudo, sempre no idioma mais dificil.
 *
 * A sessao passou a so LER conteudo pronto. Este script e quem paga o custo, e
 * ele pode demorar o quanto precisar porque ninguem esta esperando.
 *
 *   npm run content:warm -w @4l/api
 *   npm run content:warm -w @4l/api -- --language=ru --ahead=1
 *   npm run content:warm -w @4l/api -- --email=alguem@exemplo.com
 *
 * `--ahead` e quantos itens DISTINTOS deixar prontos a frente do aluno (padrao
 * 3), e nao quantas copias do mesmo item. A diferenca importa: os seletores
 * poem item nunca estudado na frente de qualquer um ja visto, entao encher de
 * copias do item de hoje nao impede que o de amanha chegue vazio -- que era
 * exatamente o defeito que quebrava os blocos de estrutura e can-do.
 *
 * Idempotente: so gera o que falta. Rodar de novo com tudo preparado nao custa
 * nenhuma chamada de IA.
 *
 * Compila antes de rodar (`nest build`) em vez de usar tsx, como o
 * `db:backfill-concepts`: este script sobe o container do Nest, e o tsx nao
 * emite metadata de decorator -- sem ela o container nao resolve as
 * dependencias e os providers nascem com o construtor vazio.
 */

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split('=')[1];
}

async function main() {
  const logger = new Logger('warm-content');
  const onlyLanguage = arg('language');
  const onlyEmail = arg('email');
  // `--target` continua aceito porque e o que esta no historico do terminal.
  const ahead = Number(arg('ahead') ?? arg('target') ?? 3);

  // 'log' precisa entrar: o progresso deste script sai por ele, e sem isso a
  // execucao fica muda por varios minutos sem ninguem saber se esta viva.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const prisma = app.get(PrismaService);
  const structure = app.get(StructureService);
  const cando = app.get(CanDoService);
  const reading = app.get(ReadingService);
  const morphology = app.get(MorphologyService);

  const users = await prisma.user.findMany({
    where: onlyEmail ? { email: onlyEmail } : undefined,
    include: { userLanguages: { include: { language: true } } },
  });

  if (users.length === 0) {
    logger.warn('Nenhum usuario encontrado.');
    await app.close();
    return;
  }

  let generated = 0;
  let failures = 0;

  for (const user of users) {
    const languages = user.userLanguages
      .map((ul) => ul.language.code)
      .filter((code) => !onlyLanguage || code === onlyLanguage);

    for (const code of languages) {
      const started = Date.now();
      try {
        // `warm` escolhe sozinho os proximos padroes de que este aluno precisa
        // -- os menos dominados --, entao preparar "os proximos" é sempre
        // preparar o que ele vai receber de verdade, e nao padroes quaisquer do
        // catalogo.
        const created = await structure.warm(user.id, code, ahead);
        generated += created;
        const seconds = Math.round((Date.now() - started) / 1000);
        logger.log(
          created > 0
            ? `${user.email} / ${code}: ${created} aula(s) em ${seconds}s.`
            : `${user.email} / ${code}: pool ja cheio.`,
        );
      } catch (error) {
        failures += 1;
        // Um idioma que falha nao pode levar os outros junto: o proximo aluno
        // e o proximo idioma ainda valem a pena.
        logger.error(`${user.email} / ${code}: ${(error as Error).message}`);
      }

      /*
       * As tabelas de caso sao por idioma, e so existem em alemao e russo --
       * `warm` devolve zero nos outros sem gastar nada. Ficam dentro do laco por
       * idioma, ao contrario da can-do e da leitura, porque a declinacao e um
       * fato daquela lingua e nao atravessa as quatro.
       */
      try {
        const created = await morphology.warm(user.id, code);
        generated += created;
        if (created > 0) {
          logger.log(`${user.email} / ${code}: ${created} tabela(s) de casos.`);
        }
      } catch (error) {
        failures += 1;
        logger.error(`${user.email} / ${code} (casos): ${(error as Error).message}`);
      }
    }

    /*
     * A can-do e preparada uma vez por aluno, e nao uma vez por idioma: a aula
     * ja traz os quatro idiomas juntos numa geracao so. Por isso ela fica fora
     * do laco acima.
     *
     * `--language` a pula: pedir um idioma so e pedir conteudo daquele idioma,
     * e a aula de can-do nao tem dono -- gera-la ali cobraria a geracao mais
     * cara do produto de quem so queria acertar o russo.
     */
    if (onlyLanguage) continue;

    const startedCanDo = Date.now();
    try {
      const created = await cando.warm(user.id, ahead);
      generated += created;
      const seconds = Math.round((Date.now() - startedCanDo) / 1000);
      logger.log(
        created > 0
          ? `${user.email} / can-do: ${created} aula(s) nos 4 idiomas em ${seconds}s.`
          : `${user.email} / can-do: pool ja cheio.`,
      );
    } catch (error) {
      failures += 1;
      logger.error(`${user.email} / can-do: ${(error as Error).message}`);
    }

    /*
     * O texto de leitura segue a can-do, e pela mesma razao: ele e o MESMO nos
     * quatro idiomas, entao nao pertence a nenhum e sai de uma geracao so.
     *
     * `--ahead` nao entra aqui de proposito: o `warm` da leitura tem folga
     * propria (menor, porque cada texto custa quatro idiomas numa resposta so)
     * e prepara os proximos textos de CADA idioma, sem repetir os prontos.
     */
    const startedReading = Date.now();
    try {
      const created = await reading.warm(user.id);
      generated += created;
      const seconds = Math.round((Date.now() - startedReading) / 1000);
      logger.log(
        created > 0
          ? `${user.email} / leitura: ${created} texto(s) nos 4 idiomas em ${seconds}s.`
          : `${user.email} / leitura: textos ja preparados.`,
      );
    } catch (error) {
      failures += 1;
      logger.error(`${user.email} / leitura: ${(error as Error).message}`);
    }
  }

  logger.log(`Pronto. ${generated} aula(s) gerada(s), ${failures} falha(s).`);
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
