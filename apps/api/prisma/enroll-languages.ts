import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_LANGUAGE_SETUP,
  DEFAULT_MINUTES_PER_LANGUAGE,
} from '../src/modules/auth/auth.service';

/**
 * Matricula os usuarios existentes nos idiomas que entraram depois deles.
 *
 * O cadastro matricula nos idiomas do momento e nunca mais volta ao assunto --
 * o que e certo para quem se cadastra hoje e errado para quem ja estava aqui
 * quando o russo entrou. Sem este script, o usuario antigo simplesmente nao
 * tem russo: nao aparece no dashboard, nao entra na sessao, e o "mesmo
 * conceito nos quatro idiomas" fica valendo para tres.
 *
 *   npm run db:enroll-languages -w @4l/api
 *   npm run db:enroll-languages -w @4l/api -- --dry-run
 *
 * Idempotente: rodar de novo nao duplica matricula nem remexe nos minutos de
 * quem ja esta com a conta certa.
 */

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const languages = await prisma.language.findMany();
  const byCode = new Map(languages.map((l) => [l.code, l.id]));

  const users = await prisma.user.findMany({
    include: { userLanguages: { include: { language: true } } },
  });

  let enrolled = 0;
  let rebalanced = 0;

  for (const user of users) {
    const have = new Set(user.userLanguages.map((ul) => ul.language.code));
    const missing = DEFAULT_LANGUAGE_SETUP.filter(
      (setup) => byCode.has(setup.code) && !have.has(setup.code),
    );

    if (missing.length === 0) {
      console.log(`${user.email}: ja tem os ${have.size} idiomas.`);
      continue;
    }

    console.log(`${user.email}: falta ${missing.map((m) => m.code).join(', ')}`);

    if (!dryRun) {
      await prisma.userLanguage.createMany({
        data: missing.map((setup) => ({
          userId: user.id,
          languageId: byCode.get(setup.code)!,
          currentLevel: setup.currentLevel,
          targetLevel: setup.targetLevel,
          priority: setup.priority,
          minutesPerDay: DEFAULT_MINUTES_PER_LANGUAGE,
        })),
        skipDuplicates: true,
      });
    }
    enrolled += missing.length;

    /*
     * Redistribui os minutos SO quando o aluno nunca mexeu neles.
     *
     * Quem esta com a distribuicao padrao ganha a nova, que fecha certo com o
     * dia (4 x 15 = 60). Quem ajustou a propria divisao fica como esta: o
     * planejador normaliza a proporcao de qualquer jeito, e reescrever uma
     * escolha do usuario para deixar um numero bonito na tela seria trocar a
     * intencao dele pela nossa.
     */
    const total = user.userLanguages.reduce((sum, ul) => sum + ul.minutesPerDay, 0);
    const untouched =
      user.userLanguages.length > 0 &&
      user.userLanguages.every((ul) => ul.minutesPerDay === user.userLanguages[0].minutesPerDay);

    if (untouched && total !== user.dailyMinutes - DEFAULT_MINUTES_PER_LANGUAGE * missing.length) {
      const count = user.userLanguages.length + missing.length;
      const each = Math.max(5, Math.round(user.dailyMinutes / count));

      console.log(`   redistribuindo: ${count} idiomas x ${each}min`);
      if (!dryRun) {
        await prisma.userLanguage.updateMany({
          where: { userId: user.id },
          data: { minutesPerDay: each },
        });
      }
      rebalanced += 1;
    } else if (!untouched) {
      console.log('   minutos por idioma foram ajustados por voce; deixados como estao.');
    }
  }

  console.log(
    dryRun
      ? `\nSimulacao: ${enrolled} matricula(s) e ${rebalanced} redistribuicao(oes). Nada gravado.`
      : `\nPronto: ${enrolled} matricula(s), ${rebalanced} redistribuicao(oes).`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
