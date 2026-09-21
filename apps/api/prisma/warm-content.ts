import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { StructureService } from '../src/modules/structure/structure.service';
import { CanDoService } from '../src/modules/cando/can-do.service';
import { ReadingService } from '../src/modules/reading/reading.service';

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
 *   npm run content:warm -w @4l/api -- --language=ru --target=1
 *   npm run content:warm -w @4l/api -- --email=alguem@exemplo.com
 *
 * Idempotente: so gera o que falta para o pool chegar ao alvo. Rodar de novo
 * com tudo cheio nao custa nenhuma chamada de IA.
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
  const target = Number(arg('target') ?? 3);

  // 'log' precisa entrar: o progresso deste script sai por ele, e sem isso a
  // execucao fica muda por varios minutos sem ninguem saber se esta viva.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const prisma = app.get(PrismaService);
  const structure = app.get(StructureService);
  const cando = app.get(CanDoService);
  const reading = app.get(ReadingService);

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
        // `warm` escolhe sozinho o proximo padrao de que este aluno precisa --
        // o menos dominado --, entao preparar "o proximo" é sempre preparar o
        // que ele vai receber de verdade, e nao um padrao qualquer do catalogo.
        const created = await structure.warm(user.id, code, target);
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
      const created = await cando.warm(user.id, target);
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
     * `target` nao entra aqui de proposito. Nos outros blocos ele e o tamanho
     * do pool -- quantas aulas diferentes do mesmo assunto manter para o aluno
     * nao decorar os exemplos. Na leitura isso seria trabalhar contra o modulo:
     * ele existe justamente para o MESMO texto voltar depois em outro idioma. A
     * variedade vem do catalogo, e o `warm` prepara o proximo texto de cada
     * idioma, sem repetir os que ja estao prontos.
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
