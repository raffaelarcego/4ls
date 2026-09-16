import { Pillar } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { LanguageState, pillarForType, planSession } from './mission.engine';

function language(overrides: Partial<LanguageState> = {}): LanguageState {
  return {
    code: 'en',
    name: 'English',
    level: 'B1',
    minutesPerDay: 30,
    dueReviews: 0,
    skills: {
      listening: 60,
      reading: 60,
      writing: 60,
      speaking: 60,
      vocabScore: 60,
      grammar: 60,
    },
    errorCounts: {},
    recentTypes: [],
    ...overrides,
  };
}

/** Tipos planejados para um idioma, na ordem. */
function types(state: LanguageState, minutes = 30): string[] {
  return planSession([state], minutes).activities.map((a) => a.type);
}

/**
 * So os blocos que o ranqueamento escolheu.
 *
 * Estrutura e vocabulario entram todo dia por regra do produto, nao por
 * pontuacao -- e os testes de ranking falam do que sobra depois deles.
 */
function ranked(state: LanguageState, minutes = 30): string[] {
  return types(state, minutes).filter(
    (type) => type !== 'review' && type !== 'structure' && type !== 'vocabulary',
  );
}

describe('revisao vencida', () => {
  it('vem sempre primeiro -- e o que trava a progressao', () => {
    const plan = planSession([language({ dueReviews: 12 })], 30);
    expect(plan.activities[0].type).toBe('review');
  });

  it('nao aparece quando nao ha item vencido', () => {
    expect(types(language({ dueReviews: 0 }))).not.toContain('review');
  });

  it('cresce com a quantidade de itens, mas nao engole a sessao', () => {
    const poucos = planSession([language({ dueReviews: 4 })], 30).activities[0];
    const muitos = planSession([language({ dueReviews: 200 })], 30).activities[0];

    expect(muitos.plannedMinutes).toBeGreaterThan(poucos.plannedMinutes);

    // A alocacao inicial tem teto de 40% do tempo do idioma (12 de 30), mas o
    // fechamento devolve a sobra ao primeiro bloco para o total bater exato --
    // entao a revisao pode passar um pouco do teto. O que nao pode e dominar.
    expect(muitos.plannedMinutes).toBeLessThan(15);
  });
});

describe('orcamento de tempo', () => {
  it('entrega exatamente os minutos pedidos', () => {
    const plan = planSession([language({ dueReviews: 5 })], 30);
    const total = plan.activities.reduce((sum, a) => sum + a.plannedMinutes, 0);

    expect(total).toBe(30);
    expect(plan.totalMinutes).toBe(30);
  });

  it('divide entre os idiomas na proporcao declarada', () => {
    const plan = planSession(
      [
        language({ code: 'en', minutesPerDay: 30 }),
        language({ code: 'es', name: 'Español', minutesPerDay: 15 }),
        language({ code: 'de', name: 'Deutsch', minutesPerDay: 15 }),
      ],
      60,
    );

    const perLanguage = (code: string) =>
      plan.activities
        .filter((a) => a.languageCode === code)
        .reduce((sum, a) => sum + a.plannedMinutes, 0);

    expect(perLanguage('en')).toBe(30);
    expect(perLanguage('es')).toBe(15);
    expect(perLanguage('de')).toBe(15);
  });

  it('ignora idioma cujo tempo nao cabe num bloco minimo', () => {
    const plan = planSession(
      [
        language({ code: 'en', minutesPerDay: 60 }),
        language({ code: 'de', name: 'Deutsch', minutesPerDay: 1 }),
      ],
      20,
    );

    expect(plan.activities.some((a) => a.languageCode === 'de')).toBe(false);
  });

  it('respeita o bloco maximo de 10 minutos', () => {
    const plan = planSession([language({ minutesPerDay: 60 })], 60);
    // A sobra volta para o primeiro bloco, entao so os demais tem o teto.
    for (const activity of plan.activities.slice(1)) {
      expect(activity.plannedMinutes).toBeLessThanOrEqual(10);
    }
  });
});

describe('blocos obrigatorios do dia', () => {
  it('da estrutura e vocabulario a todo idioma, todo dia', () => {
    const plan = planSession(
      [
        language({ code: 'en', minutesPerDay: 15 }),
        language({ code: 'es', name: 'Español', minutesPerDay: 15 }),
        language({ code: 'de', name: 'Deutsch', minutesPerDay: 15 }),
        language({ code: 'ru', name: 'Русский', minutesPerDay: 15 }),
      ],
      60,
    );

    for (const code of ['en', 'es', 'de', 'ru']) {
      const daily = plan.activities.filter((a) => a.languageCode === code).map((a) => a.type);
      expect(daily, `${code} sem estrutura`).toContain('structure');
      expect(daily, `${code} sem vocabulario`).toContain('vocabulary');
    }
  });

  it('nao deixa a revisao engolir os blocos obrigatorios', () => {
    // 200 itens vencidos pediriam uma revisao enorme. Ela cede o espaco
    // reservado: o conceito do dia nos quatro idiomas nao pode ficar de fora
    // porque o aluno acumulou cards.
    const types200 = types(language({ dueReviews: 200 }), 12);

    expect(types200).toContain('structure');
    expect(types200).toContain('vocabulary');
  });

  it('poe estrutura antes de vocabulario', () => {
    // O aluno recebe as palavras novas ja sabendo onde encaixa-las.
    const ordem = types(language());

    expect(ordem.indexOf('structure')).toBeLessThan(ordem.indexOf('vocabulary'));
  });

  it('nao duplica os obrigatorios no ranqueamento', () => {
    const ordem = types(language({ skills: { ...language().skills, grammar: 1, vocabScore: 1 } }));

    expect(ordem.filter((t) => t === 'structure')).toHaveLength(1);
    expect(ordem.filter((t) => t === 'vocabulary')).toHaveLength(1);
  });

  it('explica por que cada obrigatorio esta ali', () => {
    const plan = planSession([language()], 30);

    expect(plan.activities.find((a) => a.type === 'structure')?.reason).toContain('monta a frase');
    expect(plan.activities.find((a) => a.type === 'vocabulary')?.reason).toContain(
      'outros idiomas',
    );
  });
});

describe('producao quadrupla', () => {
  const quatro = () => [
    language({ code: 'en', minutesPerDay: 15 }),
    language({ code: 'es', minutesPerDay: 15 }),
    language({ code: 'de', minutesPerDay: 15 }),
    language({ code: 'ru', minutesPerDay: 15 }),
  ];

  it('nao entra sem ser pedida -- ela e semanal, nao diaria', () => {
    const plan = planSession(quatro(), 60);

    expect(plan.activities.some((a) => a.type === 'production')).toBe(false);
  });

  it('entra uma vez so, no fim da sessao', () => {
    const plan = planSession(quatro(), 60, { includeProduction: true });
    const producao = plan.activities.filter((a) => a.type === 'production');

    expect(producao).toHaveLength(1);
    // No fim porque producao livre precisa do aquecimento dos blocos anteriores.
    expect(plan.activities[plan.activities.length - 1].type).toBe('production');
    expect(pillarForType('production')).toBe(Pillar.LIVE);
  });

  it('sai do total, sem estourar o tempo do dia', () => {
    const plan = planSession(quatro(), 60, { includeProduction: true });
    const total = plan.activities.reduce((sum, a) => sum + a.plannedMinutes, 0);

    expect(total).toBe(60);
  });

  it('nao rouba os blocos obrigatorios de nenhum idioma', () => {
    const plan = planSession(quatro(), 60, { includeProduction: true });

    for (const code of ['en', 'es', 'de', 'ru']) {
      const tipos = plan.activities.filter((a) => a.languageCode === code).map((a) => a.type);
      expect(tipos, `${code} sem estrutura`).toContain('structure');
      expect(tipos, `${code} sem vocabulario`).toContain('vocabulary');
    }
  });

  it('nao aparece num dia curto demais para comportar os dois lados', () => {
    // Com 10 minutos, o bloco de producao consumiria quase a sessao inteira e
    // sobraria um resto que nao ensina nada. Melhor ficar de fora.
    const plan = planSession(quatro(), 10, { includeProduction: true });

    expect(plan.activities.some((a) => a.type === 'production')).toBe(false);
  });

  it('nao aparece com um idioma so -- nao ha o que comparar', () => {
    const plan = planSession([language({ minutesPerDay: 60 })], 60, { includeProduction: true });

    expect(plan.activities.some((a) => a.type === 'production')).toBe(false);
  });

  it('avisa no motivo da sessao', () => {
    const plan = planSession(quatro(), 60, { includeProduction: true });

    expect(plan.rationale).toContain('producao quadrupla');
  });
});

describe('ranking por necessidade', () => {
  it('poe a competencia mais fraca na frente', () => {
    const state = language({
      skills: {
        listening: 10,
        reading: 90,
        writing: 90,
        speaking: 90,
        vocabScore: 90,
        grammar: 90,
      },
    });

    expect(ranked(state)[0]).toBe('listening');
  });

  it('erros abertos empurram o tipo correspondente para cima', () => {
    // Gramatica comeca atras de escuta na pontuacao; so os erros abertos a
    // trazem para a frente. Comparar as duas ordens isola o efeito dos erros.
    const skills = { ...language().skills, grammar: 70, listening: 40 };
    const semErros = language({ skills });
    const comErros = language({ skills, errorCounts: { WORD_ORDER: 6 } });

    expect(ranked(semErros)[0]).not.toBe('grammar');
    expect(ranked(comErros)[0]).toBe('grammar');
  });

  it('explica o motivo com o dado que gerou a decisao', () => {
    const plan = planSession([language({ errorCounts: { WORD_ORDER: 6 } })], 30);
    const grammar = plan.activities.find((a) => a.type === 'grammar');

    expect(grammar?.reason).toContain('6 erros abertos');
  });

  it('penaliza o que o aluno acabou de fazer, para a sessao variar', () => {
    const state = language({
      skills: {
        listening: 10,
        reading: 90,
        writing: 90,
        speaking: 90,
        vocabScore: 90,
        grammar: 12,
      },
    });

    expect(ranked(state)[0]).toBe('listening');

    const repetido = { ...state, recentTypes: ['listening', 'listening', 'listening'] };
    expect(ranked(repetido)[0]).not.toBe('listening');
  });

  it('ao penalizar escuta, promove o ditado antes de trocar de competencia', () => {
    // Ditado e ranqueado pela mesma competencia que escuta. Entao repetir
    // escuta nao empurra o aluno para outra area: mantem a competencia fraca
    // em foco e so troca o formato do exercicio. E o comportamento desejado.
    const state = language({
      skills: {
        listening: 10,
        reading: 90,
        writing: 90,
        speaking: 90,
        vocabScore: 90,
        grammar: 12,
      },
      recentTypes: ['listening', 'listening', 'listening'],
    });

    expect(ranked(state)[0]).toBe('dictation');
  });
});

describe('ditado', () => {
  it('e um tipo planejavel, sob o pilar de input', () => {
    const state = language({
      skills: {
        listening: 5,
        reading: 90,
        writing: 90,
        speaking: 90,
        vocabScore: 90,
        grammar: 90,
      },
      recentTypes: ['listening'],
    });

    expect(ranked(state, 30)).toContain('dictation');
    expect(pillarForType('dictation')).toBe(Pillar.LISTEN);
  });

  it('e puxado por erros de ortografia, nao escrita livre', () => {
    // Ouvir e escrever expoe a grafia exata; num texto proprio o aluno
    // desvia da palavra que nao sabe escrever.
    const plan = planSession([language({ errorCounts: { SPELLING: 8 } })], 30);
    const dictation = plan.activities.find((a) => a.type === 'dictation');

    expect(dictation).toBeDefined();
    expect(dictation?.reason).toContain('8 erros abertos');
  });
});

describe('pillarForType', () => {
  it('mapeia os tipos conhecidos', () => {
    expect(pillarForType('review')).toBe(Pillar.LEARN);
    expect(pillarForType('listening')).toBe(Pillar.LISTEN);
    expect(pillarForType('speaking')).toBe(Pillar.LIVE);
    expect(pillarForType('assessment')).toBe(Pillar.LEVEL_UP);
  });

  it('cai em LEARN diante de um tipo desconhecido', () => {
    expect(pillarForType('nao-existe')).toBe(Pillar.LEARN);
  });
});
