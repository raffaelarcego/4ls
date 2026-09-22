import { describe, expect, it } from 'vitest';
import { APP_TIMEZONE, APP_UTC_OFFSET_MINUTES, appDayKey } from './timezone';

/*
 * A virada do dia e o contrato mais silencioso do sistema: ela decide qual
 * sessao e "a de hoje" e se o streak continua ou zera. Quando ela erra, nada
 * quebra -- o app so mostra o dia errado, e o aluno conclui que perdeu um dia
 * que ele nao perdeu. Estes testes existem para que uma variavel de ambiente
 * esquecida falhe aqui, e nao no streak dele.
 */
describe('fuso da aplicacao', () => {
  it('roda em UTC-3', () => {
    expect(process.env.TZ).toBe(APP_TIMEZONE);
    expect(new Date().getTimezoneOffset()).toBe(APP_UTC_OFFSET_MINUTES);
  });

  it('estudar as 22h conta para hoje, nao para amanha', () => {
    // 2026-09-22 22:00 em Brasilia = 2026-09-23 01:00 em UTC. Num servidor em
    // UTC o dia ja teria virado; aqui nao.
    const night = new Date('2026-09-23T01:00:00.000Z');

    expect(night.getDate()).toBe(22);
    expect(appDayKey(night)).toBe('2026-09-22');
  });

  it('a meia-noite local abre o dia seguinte', () => {
    // 2026-09-23 00:00 em Brasilia = 03:00 UTC.
    const midnight = new Date('2026-09-23T03:00:00.000Z');

    expect(appDayKey(midnight)).toBe('2026-09-23');
    expect(appDayKey(new Date(midnight.getTime() - 1))).toBe('2026-09-22');
  });

  it('startOfDay corta as 00:00 locais, e nao as 21h do dia anterior', () => {
    // A mesma conta que study.service.ts e gamification.service.ts fazem.
    const start = new Date('2026-09-22T15:30:00.000Z');
    start.setHours(0, 0, 0, 0);

    expect(start.toISOString()).toBe('2026-09-22T03:00:00.000Z');
  });
});
