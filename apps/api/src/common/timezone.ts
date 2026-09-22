/**
 * Fuso horario da aplicacao: UTC-3.
 *
 * Importar este modulo TEM efeito colateral -- ele escreve `process.env.TZ`.
 * E por isso que ele aparece como a PRIMEIRA linha de cada ponto de entrada
 * (`main.ts`, `serverless.ts`, os scripts de `prisma/`), antes de qualquer
 * import que possa construir uma data.
 *
 * Por que isso importa e nao e cosmetico: o sistema inteiro decide "que dia e
 * hoje" com metodos de hora LOCAL -- `setHours(0, 0, 0, 0)` em
 * `study.service.ts` (a janela da sessao do dia) e em `gamification.service.ts`
 * (a virada do streak). Num servidor em UTC, que e o padrao da Vercel, o dia
 * virava as 21h de Brasilia: estudar as 22h contava para amanha, e o streak
 * podia quebrar sozinho numa noite em que o aluno estudou.
 *
 * Por que `Etc/GMT+3` e nao `America/Sao_Paulo`: o pedido e UTC-3 fixo. Hoje os
 * dois sao identicos, porque o Brasil aboliu o horario de verao em 2019 -- mas
 * se ele voltar, `America/Sao_Paulo` passaria a -2 no verao e a virada do dia
 * mudaria de hora sozinha. Fixo nao muda.
 *
 * E o sinal invertido nao e engano: no banco de dados de fusos da IANA, a
 * familia `Etc/GMT±N` segue a convencao POSIX, em que o sinal e o oposto do
 * deslocamento. `Etc/GMT+3` = UTC-3. Para mudar para o horario de Brasilia com
 * horario de verao, troque por 'America/Sao_Paulo' -- e so esta constante.
 */
export const APP_TIMEZONE = 'Etc/GMT+3';

/**
 * Offset em minutos, no sinal de `Date.prototype.getTimezoneOffset()`
 * (positivo a oeste de Greenwich). Usado por quem precisa montar uma data
 * local a partir de um instante sem depender do TZ do processo.
 */
export const APP_UTC_OFFSET_MINUTES = 180;

process.env.TZ = APP_TIMEZONE;

/**
 * A data no formato `AAAA-MM-DD` do fuso da aplicacao.
 *
 * Existe porque `toISOString().slice(0, 10)` devolve o dia em UTC, que nao e o
 * dia do aluno: uma sessao das 22h de terca sairia agrupada como quarta.
 */
export function appDayKey(date: Date): string {
  const local = new Date(date.getTime() - APP_UTC_OFFSET_MINUTES * 60_000);
  return local.toISOString().slice(0, 10);
}
