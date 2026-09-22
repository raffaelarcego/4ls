import '../src/common/timezone';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import {
  ConceptsService,
  conceptSlug,
  minLevel,
} from '../src/modules/concepts/concepts.service';
import { PrismaService } from '../src/infrastructure/database/prisma.service';

/**
 * Backfill: puxa para a rede de conceitos o vocabulario que ficou de fora.
 *
 * Por que ele existe: o produto passou a ensinar conceitos em vez de palavras,
 * mas os termos salvos ANTES dessa mudanca ficaram com `conceptId` nulo. Eles
 * continuam funcionando como card de revisao -- so que sozinhos, que e
 * exatamente o que a mudanca veio corrigir. "to look forward to" ficaria para
 * sempre sendo uma palavra em ingles em vez de um significado que voce tambem
 * sabe dizer em espanhol, alemao e russo.
 *
 *   npm run db:backfill-concepts -w @4l/api
 *   npm run db:backfill-concepts -w @4l/api -- --dry-run
 *   npm run db:backfill-concepts -w @4l/api -- --limit=20
 *
 * O script roda dentro de um contexto Nest de proposito: ele reusa o
 * ConceptsService de producao, com o mesmo prompt, a mesma validacao e as
 * mesmas regras de matricula. Reescrever essa logica aqui criaria uma segunda
 * versao da regra central do produto, que e a ultima coisa que se quer ver
 * divergir.
 *
 * Por isso ele roda COMPILADO (`nest build` antes), e nao pelo tsx como os
 * outros scripts: o tsx usa esbuild, que nao emite `design:paramtypes`, e sem
 * esses metadados a injecao de dependencia do Nest entrega `undefined` em todo
 * construtor. O erro aparece longe da causa -- um provider qualquer estourando
 * em `config.get` --, entao vale saber disto antes de trocar o comando.
 *
 * Tres fases, nesta ordem por um motivo:
 *
 *   1. LIGAR (nao custa nada): cada termo orfao ganha um conceito, derivado do
 *      significado em portugues. E aqui que "trabalho" e "el trabajo" se
 *      descobrem a mesma coisa, sem gastar um token.
 *   2. COMPLETAR (custa IA): so os conceitos que sobraram incompletos pedem as
 *      realizacoes que faltam. Fazer isso depois da fase 1 e o que evita pagar
 *      para traduzir algo que ja existia no banco em outro idioma.
 *   3. MATRICULAR (nao custa nada): quem ja tinha o conceito em UM idioma passa
 *      a te-lo nos quatro. Ninguem recebe conceito que nunca estudou -- este
 *      script fecha lacunas, nao empurra conteudo novo.
 */

/** Teto de chamadas de IA por execucao. Backfill nao deve surpreender na fatura. */
const DEFAULT_LIMIT = 100;

/** Pausa entre chamadas de IA, para nao esbarrar em rate limit do provider. */
const PAUSE_MS = 250;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limit = readLimit();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });

  try {
    const prisma = app.get(PrismaService);
    const concepts = app.get(ConceptsService);

    const languages = await prisma.language.findMany({ orderBy: { code: 'asc' } });
    const codes = languages.map((l) => l.code);
    if (codes.length === 0) {
      throw new Error('Nenhum idioma no banco. Rode o seed antes: npm run db:seed -w @4l/api');
    }

    /*
     * O nivel alvo de cada idioma e o MENOR entre os alunos que o estudam.
     *
     * A fase 2 e independente de usuario -- um conceito e completado uma vez e
     * serve a todos --, mas o exemplo gerado precisa de um nivel. Escolher o
     * menor e o unico erro seguro: uma frase simples demais ainda ensina o
     * termo a quem esta adiantado, enquanto uma frase acima do nivel e inutil
     * para quem esta comecando. Sem nenhum aluno no idioma, A1.
     */
    const enrollments = await prisma.userLanguage.findMany({
      include: { language: { select: { code: true, name: true } } },
    });

    const targets = languages.map((language) => {
      const levels = enrollments
        .filter((e) => e.language.code === language.code)
        .map((e) => e.currentLevel as string);

      return {
        code: language.code,
        name: language.name,
        level: levels.reduce((lowest, level) => minLevel(lowest, level), 'C2' as string),
      };
    });

    console.log(`Idiomas: ${targets.map((t) => `${t.code} (${t.level})`).join(', ')}`);

    // ---------------------------------------------------------------- fase 1
    const orphans = await prisma.vocabulary.findMany({
      where: { conceptId: null },
      include: { language: { select: { code: true } } },
      orderBy: { createdAt: 'asc' },
    });

    if (orphans.length === 0) {
      console.log('Nenhum termo solto: todo o vocabulario ja esta na rede de conceitos.');
      return;
    }

    console.log(`\n[1/3] Ligando ${orphans.length} termo(s) solto(s) a um conceito...`);

    /** Conceitos tocados nesta execucao, na ordem em que apareceram. */
    const touched: string[] = [];

    for (const entry of orphans) {
      const slug = conceptSlug(entry.meaning);
      if (!slug) {
        console.warn(`  ! "${entry.term}" (${entry.language.code}): significado vazio, pulado.`);
        continue;
      }

      if (dryRun) {
        console.log(`  · ${entry.language.code} "${entry.term}" -> conceito "${slug}"`);
        if (!touched.includes(slug)) touched.push(slug);
        continue;
      }

      const concept = await prisma.concept.upsert({
        where: { slug },
        create: {
          slug,
          // O significado do termo e a melhor glosa disponivel: foi escrito
          // para este sentido, e nao para o conceito em abstrato. Vale mais que
          // um rotulo derivado do slug.
          gloss: entry.meaning.trim(),
          level: entry.level,
          source: 'backfill',
        },
        update: {},
      });

      await prisma.vocabulary.update({
        where: { id: entry.id },
        data: { conceptId: concept.id },
      });

      if (!touched.includes(concept.id)) touched.push(concept.id);
    }

    if (dryRun) {
      console.log(
        `\nSimulacao: ${orphans.length} termo(s) em ${touched.length} conceito(s). Nada foi gravado.`,
      );
      return;
    }

    console.log(`  ${touched.length} conceito(s) tocado(s).`);

    // ---------------------------------------------------------------- fase 2
    const incomplete: string[] = [];
    for (const conceptId of touched) {
      if (await missing(prisma, conceptId, codes)) incomplete.push(conceptId);
    }

    console.log(`\n[2/3] ${incomplete.length} conceito(s) incompleto(s).`);

    const target = incomplete.slice(0, limit);
    if (incomplete.length > target.length) {
      console.log(
        `  Teto de ${limit} por execucao: ${incomplete.length - target.length} ficam para a proxima.`,
      );
    }

    let completed = 0;
    for (const [index, conceptId] of target.entries()) {
      const concept = await prisma.concept.findUnique({ where: { id: conceptId } });
      process.stdout.write(`  (${index + 1}/${target.length}) ${concept?.slug ?? conceptId}... `);

      // O service ja engole a falha da IA e segue: um conceito que nao fechou
      // hoje nao pode derrubar o backfill dos outros noventa e nove.
      await concepts.complete(conceptId, targets);

      const ainda = await missing(prisma, conceptId, codes);
      console.log(ainda ? `incompleto (falta ${ainda})` : 'ok');
      if (!ainda) completed += 1;

      if (index < target.length - 1) await sleep(PAUSE_MS);
    }

    console.log(`  ${completed} de ${target.length} conceito(s) fechados nos ${codes.length} idiomas.`);

    // ---------------------------------------------------------------- fase 3
    console.log('\n[3/3] Matriculando quem ja tinha o conceito em algum idioma...');

    let enrolled = 0;
    for (const conceptId of touched) {
      // So quem ja estudava o conceito em ALGUM idioma. Matricular todo mundo
      // transformaria um backfill numa carga de conteudo novo na fila de
      // revisao de quem nunca pediu por ele.
      const owners = await prisma.userVocabulary.findMany({
        where: { vocabulary: { conceptId } },
        select: { userId: true },
        distinct: ['userId'],
      });

      for (const owner of owners) {
        enrolled += await concepts.enroll(owner.userId, conceptId);
      }
    }

    console.log(`  ${enrolled} card(s) novo(s) criado(s).`);
    console.log('\nPronto. Os termos antigos agora viajam com as irmas dos outros idiomas.');
  } finally {
    await app.close();
  }
}

/** Idiomas em que o conceito ainda nao existe, ou null quando esta completo. */
async function missing(
  prisma: PrismaService,
  conceptId: string,
  codes: string[],
): Promise<string | null> {
  const entries = await prisma.vocabulary.findMany({
    where: { conceptId, language: { code: { in: codes } } },
    select: { language: { select: { code: true } } },
  });

  const have = new Set(entries.map((e) => e.language.code));
  const falta = codes.filter((code) => !have.has(code));
  return falta.length > 0 ? falta.join(', ') : null;
}

function readLimit(): number {
  const flag = process.argv.find((arg) => arg.startsWith('--limit='));
  if (!flag) return DEFAULT_LIMIT;

  const value = Number(flag.slice('--limit='.length));
  if (!Number.isFinite(value) || value < 1) {
    throw new Error('--limit precisa ser um numero maior que zero.');
  }
  return Math.floor(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
