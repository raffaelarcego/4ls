import { describe, expect, it } from 'vitest';
import { levelFromXp, titleForLevel, xpToNext } from './levels';

describe('curva de nivel', () => {
  it('comeca no nivel 1 sem nenhum XP', () => {
    const progress = levelFromXp(0);

    expect(progress.level).toBe(1);
    expect(progress.xpIntoLevel).toBe(0);
    expect(progress.percent).toBe(0);
  });

  it('nao quebra com XP negativo ou quebrado', () => {
    // O total vem de um `_sum` do Prisma, que pode chegar nulo ou estranho.
    expect(levelFromXp(-50).level).toBe(1);
    expect(levelFromXp(499.9).level).toBe(1);
  });

  it('sobe de nivel exatamente no limiar, nao um XP antes', () => {
    expect(levelFromXp(499).level).toBe(1);
    expect(levelFromXp(500).level).toBe(2);
    expect(levelFromXp(500).xpIntoLevel).toBe(0);
  });

  it('cada nivel custa mais que o anterior', () => {
    for (let level = 1; level < 30; level++) {
      expect(xpToNext(level + 1)).toBeGreaterThan(xpToNext(level));
    }
  });

  /**
   * A curva e o produto: uma sessao inteira rende perto de 250 XP, entao o
   * primeiro nivel precisa cair em poucos dias. Se esta conta mudar, a sensacao
   * de progresso muda junto -- por isso ela esta fixada em teste.
   */
  it('entrega o nivel 2 em cerca de dois dias de estudo', () => {
    const doisDias = 250 * 2;

    expect(levelFromXp(doisDias).level).toBe(2);
  });

  it('desacelera sem virar parede', () => {
    // Um mes de constancia ainda avanca vários niveis.
    const umMes = levelFromXp(250 * 30);

    expect(umMes.level).toBeGreaterThanOrEqual(5);
    expect(umMes.level).toBeLessThanOrEqual(12);
  });

  it('o que falta somado ao que ja tem fecha o nivel', () => {
    for (const xp of [0, 1, 499, 500, 1249, 9999, 100000]) {
      const p = levelFromXp(xp);
      expect(p.xpIntoLevel + p.xpRemaining).toBe(p.xpForLevel);
      expect(p.xpIntoLevel).toBeLessThan(p.xpForLevel);
    }
  });

  it('a barra nunca chega a 100 -- ao encher, o nivel sobe', () => {
    for (const xp of [0, 250, 499, 1000, 5000, 50000]) {
      expect(levelFromXp(xp).percent).toBeLessThan(100);
      expect(levelFromXp(xp).percent).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('titulos', () => {
  it('abre em Aprendiz e termina em Mestre das Quatro', () => {
    expect(titleForLevel(1)).toBe('Aprendiz');
    expect(titleForLevel(99)).toBe('Mestre das Quatro');
  });

  it('nunca volta atras conforme o nivel sobe', () => {
    const vistos: string[] = [];
    for (let level = 1; level <= 40; level++) {
      const title = titleForLevel(level);
      if (!vistos.includes(title)) vistos.push(title);
      // O titulo do nivel N nunca pode ser um que ja tinha sido superado.
      expect(vistos.indexOf(title)).toBe(vistos.length - 1);
    }
    expect(vistos.length).toBeGreaterThan(3);
  });
});
