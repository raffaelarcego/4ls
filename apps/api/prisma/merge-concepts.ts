import { PrismaClient } from '@prisma/client';

/**
 * Funde dois conceitos que sao o mesmo significado.
 *
 * Existe porque a colisao e inevitavel e o codigo, de proposito, nao a resolve
 * sozinho. Quando a IA gera "sich freuen auf" para "aguardar ansiosamente" e
 * esse termo ja e de "estar animado com algo futuro", os dois conceitos sao
 * quase sempre um so -- mas nem sempre: "pasta" de arquivo e "pasta" de comer
 * compartilhariam termo sem compartilhar significado. Quem decide e uma pessoa
 * olhando, e e para essa pessoa que este script existe.
 *
 *   npm run db:merge-concepts -w @4l/api -- <origem> <destino>
 *   npm run db:merge-concepts -w @4l/api -- aguardar-ansiosamente estar-animado --dry-run
 *
 * A origem some; as realizacoes dela passam para o destino, junto com quem as
 * estudava. O progresso de conceito do destino prevalece -- ele e o que fica.
 */

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dryRun = process.argv.includes('--dry-run');
  const [fromSlug, intoSlug] = args;

  if (!fromSlug || !intoSlug) {
    throw new Error('Uso: db:merge-concepts -- <slug-origem> <slug-destino> [--dry-run]');
  }
  if (fromSlug === intoSlug) throw new Error('Origem e destino sao o mesmo conceito.');

  const [from, into] = await Promise.all([
    prisma.concept.findUnique({
      where: { slug: fromSlug },
      include: { entries: { include: { language: true } } },
    }),
    prisma.concept.findUnique({
      where: { slug: intoSlug },
      include: { entries: { include: { language: true } } },
    }),
  ]);

  if (!from) throw new Error(`Conceito "${fromSlug}" nao existe.`);
  if (!into) throw new Error(`Conceito "${intoSlug}" nao existe.`);

  console.log(`ORIGEM   ${from.slug} — "${from.gloss}"`);
  for (const e of from.entries) console.log(`   ${e.language.code} ${e.term}`);
  console.log(`DESTINO  ${into.slug} — "${into.gloss}"`);
  for (const e of into.entries) console.log(`   ${e.language.code} ${e.term}`);

  // Um idioma que os dois ja preenchem nao pode ser movido: violaria a unicidade
  // (idioma, termo)? Nao -- mas deixaria o destino com duas realizacoes no mesmo
  // idioma, que e o mesmo defeito por outro caminho.
  const ocupados = new Set(into.entries.map((e) => e.language.code));
  const mover = from.entries.filter((e) => !ocupados.has(e.language.code));
  const conflito = from.entries.filter((e) => ocupados.has(e.language.code));

  console.log(`\nMover: ${mover.map((e) => `${e.language.code} "${e.term}"`).join(', ') || '(nada)'}`);
  if (conflito.length > 0) {
    console.log(
      `Descartar (destino ja tem o idioma): ${conflito
        .map((e) => `${e.language.code} "${e.term}"`)
        .join(', ')}`,
    );
  }

  if (dryRun) {
    console.log('\nSimulacao: nada foi gravado.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const entry of mover) {
      await tx.vocabulary.update({ where: { id: entry.id }, data: { conceptId: into.id } });
    }

    // As realizacoes descartadas perdem o vinculo em vez de sumirem: o aluno
    // pode te-las na fila de revisao, e apagar um card por causa de uma fusao
    // de catalogo seria apagar historico de estudo.
    for (const entry of conflito) {
      await tx.vocabulary.update({ where: { id: entry.id }, data: { conceptId: null } });
    }

    // O progresso de conceito da origem some junto com ela; o do destino fica.
    await tx.conceptProgress.deleteMany({ where: { conceptId: from.id } });
    await tx.concept.delete({ where: { id: from.id } });
  });

  console.log(`\nPronto: "${from.slug}" fundido em "${into.slug}".`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
