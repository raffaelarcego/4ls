import { describe, expect, it } from 'vitest';
import {
  COOLDOWN_DAYS,
  dampenSkills,
  examScore,
  gate,
  MIN_ITEMS,
  nextLevel,
  passed,
  PROMOTION_SCORE,
  roundScore,
  RoundTally,
  weakestRound,
} from './promotion.rules';

const NOW = new Date('2026-09-21T12:00:00Z');

function daysAgo(days: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  return d;
}

function tallies(over: Partial<Record<'sentences' | 'reading' | 'vocabulary', [number, number]>> = {}): RoundTally[] {
  const base: Record<string, [number, number]> = {
    sentences: [4, 4],
    reading: [4, 4],
    vocabulary: [4, 4],
    ...over,
  };
  return Object.entries(base).map(([round, [correct, total]]) => ({
    round: round as RoundTally['round'],
    correct,
    total,
  }));
}

describe('escada de níveis', () => {
  it('sobe um degrau por vez', () => {
    expect(nextLevel('A1')).toBe('A2');
    expect(nextLevel('B2')).toBe('C1');
  });

  it('não passa do topo', () => {
    expect(nextLevel('C2')).toBeNull();
  });
});

describe('nota do exame', () => {
  /**
   * Acertos sobre itens, nao media das rodadas: com a media, uma rodada de dois
   * itens pesaria igual a uma de quatro.
   */
  it('pesa por item, não por rodada', () => {
    const score = examScore([
      { round: 'sentences', correct: 4, total: 4 },
      { round: 'reading', correct: 0, total: 2 },
    ]);

    // 4 de 6 = 67. A media das rodadas daria 50.
    expect(score).toBe(67);
  });

  it('rodada sem itens não tem nota', () => {
    expect(roundScore({ round: 'reading', correct: 0, total: 0 })).toBeNull();
  });
});

describe('aprovação no chefe', () => {
  it('aprova quem vai bem nas três rodadas', () => {
    expect(passed(tallies())).toBe(true);
  });

  it('reprova abaixo da nota do exame', () => {
    expect(passed(tallies({ sentences: [1, 4], reading: [2, 4] }))).toBe(false);
  });

  /**
   * O caso que o piso por rodada existe para pegar: 9 de 12 e 75... mas mesmo
   * chegando aos 80 no total, quem nao monta frase nao esta pronto para o nivel
   * seguinte -- o produto inteiro e sobre montar frase.
   */
  it('reprova quem passou no total e afundou numa rodada', () => {
    const notas = tallies({ sentences: [1, 4], reading: [4, 4], vocabulary: [4, 4] });
    // 9 de 12 = 75: reprova pelo total tambem. Com uma rodada extra o total
    // passaria, e e ai que o piso trabalha sozinho.
    const comFolga: RoundTally[] = [
      { round: 'sentences', correct: 2, total: 4 },
      { round: 'reading', correct: 8, total: 8 },
      { round: 'vocabulary', correct: 8, total: 8 },
    ];

    expect(examScore(comFolga)).toBeGreaterThanOrEqual(80);
    expect(passed(comFolga)).toBe(false);
    expect(passed(notas)).toBe(false);
  });

  it('exame sem itens não promove ninguém', () => {
    expect(passed([])).toBe(false);
  });

  it('aponta a rodada que afundou', () => {
    expect(weakestRound(tallies({ sentences: [1, 4] }))).toBe('sentences');
  });

  it('não aponta rodada nenhuma quando todas foram bem', () => {
    expect(weakestRound(tallies())).toBeNull();
  });
});

describe('portão do chefe', () => {
  const base = {
    currentLevel: 'A1',
    composite: PROMOTION_SCORE,
    lastFailedAt: null,
    itemCount: MIN_ITEMS,
    now: NOW,
  };

  it('abre com desempenho e material', () => {
    const g = gate(base);
    expect(g.state).toBe('ready');
    expect(g.nextLevel).toBe('A2');
  });

  it('diz quantos pontos faltam quando o desempenho ainda não chegou', () => {
    const g = gate({ ...base, composite: 71.2 });
    expect(g.state).toBe('growing');
    expect(g.missingScore).toBe(14);
  });

  /**
   * A espera vem ANTES da nota na ordem das checagens: mandar "estude mais"
   * para quem so precisa esperar ate sabado e dizer a coisa errada.
   */
  it('mantém fechado durante a espera, mesmo com desempenho de sobra', () => {
    const g = gate({ ...base, composite: 99, lastFailedAt: daysAgo(2) });
    expect(g.state).toBe('cooldown');
    expect(g.availableAt).not.toBeNull();
  });

  it('reabre passada a espera', () => {
    const g = gate({ ...base, lastFailedAt: daysAgo(COOLDOWN_DAYS + 1) });
    expect(g.state).toBe('ready');
  });

  it('não abre exame sem material suficiente', () => {
    const g = gate({ ...base, itemCount: MIN_ITEMS - 1 });
    expect(g.state).toBe('unprepared');
  });

  it('no topo da escala não há chefe', () => {
    const g = gate({ ...base, currentLevel: 'C2', composite: 100 });
    expect(g.state).toBe('maxed');
    expect(g.nextLevel).toBeNull();
  });
});

describe('competências depois da subida', () => {
  /**
   * Sem encolher, a composta continua acima de 85 e o chefe do nivel seguinte
   * abriria no dia seguinte -- subindo o aluno de A1 a B1 numa semana.
   */
  it('baixa a nota para a régua do nível novo', () => {
    const depois = dampenSkills({ grammar: 90, listening: 80, reading: 0 });

    expect(depois.grammar).toBe(54);
    expect(depois.listening).toBe(48);
    expect(depois.reading).toBe(0);
  });
});
