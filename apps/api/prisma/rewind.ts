import { PrismaClient } from '@prisma/client';

/**
 * Utilitario de desenvolvimento: empurra as sessoes de estudo um dia para tras.
 *
 * Existe para permitir testar o motor adaptativo sem esperar o dia virar.
 * Depois de rodar, o proximo GET /study/today planeja uma sessao nova, ja
 * levando em conta o desempenho registrado na sessao anterior.
 *
 *   npm run db:rewind -w @4l/api
 *
 * Passe um numero de dias para voltar mais de um:  npm run db:rewind -- 3
 */
const prisma = new PrismaClient();

async function main() {
  const days = Number(process.argv[2] ?? 1);
  if (!Number.isFinite(days) || days < 1) {
    throw new Error('Informe um numero de dias maior que zero.');
  }

  const sessions = await prisma.studySession.findMany({
    select: { id: true, date: true },
  });

  for (const session of sessions) {
    const date = new Date(session.date);
    date.setDate(date.getDate() - days);
    await prisma.studySession.update({ where: { id: session.id }, data: { date } });
  }

  // O streak precisa acompanhar, senao a proxima sessao concluida o zeraria.
  const streaks = await prisma.streak.findMany({ where: { lastActiveDay: { not: null } } });
  for (const streak of streaks) {
    const lastActiveDay = new Date(streak.lastActiveDay!);
    lastActiveDay.setDate(lastActiveDay.getDate() - days);
    await prisma.streak.update({ where: { id: streak.id }, data: { lastActiveDay } });
  }

  console.log(
    `${sessions.length} sessao(oes) e ${streaks.length} streak(s) movidos ${days} dia(s) para tras.`,
  );
  console.log('Recarregue o dashboard: uma nova sessao sera planejada.');
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
