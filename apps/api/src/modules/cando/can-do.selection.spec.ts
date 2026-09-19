import { describe, expect, it } from 'vitest';
import { CAN_DOS } from './can-do.catalog';
import {
  CanDoProgressRow,
  canDoCandidates,
  canDoMastery,
  lowestCanDoLevel,
  pickCanDo,
  toProgressRows,
} from './can-do.selection';

function row(overrides: Partial<CanDoProgressRow> = {}): CanDoProgressRow {
  return {
    canDoId: 'apresentar-se',
    languageCode: 'en',
    mastery: 50,
    lastStudiedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('nivel-teto do dia', () => {
  it('e o do idioma mais atrasado, nunca o do mais adiantado', () => {
    // A can-do so entra se der para ensina-la nos quatro ao mesmo tempo.
    expect(lowestCanDoLevel(['B1', 'A2', 'B1', 'A1'])).toBe('A1');
  });

  it('rebaixa nivel acima da escala em vez de zerar o dia', () => {
    // O catalogo para em B1: um aluno C1 em tudo continua tendo aula.
    expect(lowestCanDoLevel(['C1', 'B2'])).toBe('B1');
  });

  it('sem idioma nenhum, nao promete mais do que A1', () => {
    expect(lowestCanDoLevel([])).toBe('A1');
    expect(lowestCanDoLevel(['A0'])).toBe('A1');
  });

  it('limita as candidatas ao teto', () => {
    const candidates = canDoCandidates(['B1', 'A1']);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.level === 'A1')).toBe(true);
    expect(candidates.length).toBeLessThan(CAN_DOS.length);
  });
});

describe('dominio agregado', () => {
  it('divide pelos idiomas matriculados, nao pelos ja estudados', () => {
    // Treinada so em ingles e espanhol, a can-do esta pela metade -- e e isso
    // que a faz voltar ate fechar nos quatro.
    const rows = [
      row({ languageCode: 'en', mastery: 100 }),
      row({ languageCode: 'es', mastery: 100 }),
    ];

    expect(canDoMastery('apresentar-se', rows, 4)).toBe(50);
  });

  it('e zero para a can-do nunca estudada', () => {
    expect(canDoMastery('negar', [row()], 4)).toBe(0);
  });
});

describe('can-do do dia', () => {
  const candidates = canDoCandidates(['A1']);

  it('prefere a que ele nunca praticou', () => {
    const rows = candidates
      .slice(0, 3)
      .map((c) => row({ canDoId: c.id, mastery: 90 }));

    const chosen = pickCanDo(candidates, rows, 4)!;

    expect(rows.some((r) => r.canDoId === chosen.id)).toBe(false);
  });

  it('entre as ja vistas, volta na menos dominada', () => {
    // Todas vistas: sobra a comparacao por dominio, e nao rotacao cega.
    const rows = candidates.flatMap((c) =>
      ['en', 'es', 'de', 'ru'].map((languageCode) =>
        row({ canDoId: c.id, languageCode, mastery: c.id === 'negar' ? 10 : 80 }),
      ),
    );

    expect(pickCanDo(candidates, rows, 4)!.id).toBe('negar');
  });

  it('desempata pela mais antiga', () => {
    const rows = candidates.flatMap((c) =>
      ['en', 'es', 'de', 'ru'].map((languageCode) =>
        row({
          canDoId: c.id,
          languageCode,
          mastery: 60,
          lastStudiedAt: new Date(c.id === 'negar' ? '2025-01-01' : '2026-06-01'),
        }),
      ),
    );

    expect(pickCanDo(candidates, rows, 4)!.id).toBe('negar');
  });

  it('um idioma fraco basta para a can-do voltar', () => {
    // Ele monta a frase em espanhol e ainda erra a russa: a can-do nao esta
    // pronta, porque a promessa e saber fazer aquilo nos quatro.
    const rows = candidates.flatMap((c) =>
      ['en', 'es', 'de', 'ru'].map((languageCode) =>
        row({
          canDoId: c.id,
          languageCode,
          mastery: c.id === 'negar' && languageCode === 'ru' ? 0 : 100,
        }),
      ),
    );

    expect(pickCanDo(candidates, rows, 4)!.id).toBe('negar');
  });

  it('sem candidata, nao inventa uma', () => {
    expect(pickCanDo([], [], 4)).toBeUndefined();
  });
});

describe('leitura do progresso', () => {
  it('so olha as linhas com o prefixo de can-do', () => {
    // `grammar_progress` e dividida com estrutura e alfabeto: sem o prefixo, a
    // aula de "de-verb-second" contaria como dominio de can-do.
    const rows = toProgressRows([
      { topicId: 'cando:negar', languageCode: 'de', mastery: 30, lastStudiedAt: new Date() },
      { topicId: 'structure:negar', languageCode: 'de', mastery: 90, lastStudiedAt: new Date() },
      { topicId: 'alphabet:ru', languageCode: 'ru', mastery: 90, lastStudiedAt: new Date() },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].canDoId).toBe('negar');
  });
});
