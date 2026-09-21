import { Pillar } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  LanguageState,
  pillarForType,
  planSession,
  PRACTICABLE_TYPES,
} from './mission.engine';

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
    needsAlphabet: false,
    needsFoundation: false,
    hasMorphology: false,
    interferenceErrors: 0,
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

    // A moldura cross-language sai do total antes da divisao, entao o que se
    // reparte sao os 51 minutos restantes -- na mesma proporcao 2:1:1.
    const perLanguage = (code: string) =>
      plan.activities
        .filter((a) => a.languageCode === code && a.type !== 'contrast' && a.type !== 'compare')
        .reduce((sum, a) => sum + a.plannedMinutes, 0);

    expect(perLanguage('en') + perLanguage('es') + perLanguage('de')).toBe(51);
    expect(perLanguage('en')).toBe(26);
    expect(perLanguage('es')).toBe(12);
    expect(perLanguage('de')).toBe(13);
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

describe('modo alfabeto', () => {
  const russo = () => language({ code: 'ru', name: 'Русский', needsAlphabet: true });

  it('troca estrutura por alfabeto enquanto o aluno nao le as letras', () => {
    const ordem = types(russo());

    expect(ordem).toContain('alphabet');
    expect(ordem).not.toContain('structure');
    // O vocabulario continua: e o conceito do dia, o mesmo dos outros idiomas.
    expect(ordem).toContain('vocabulary');
  });

  it('ocupa a vaga de estrutura, sem virar um terceiro obrigatorio', () => {
    const plan = planSession([russo()], 30);
    const obrigatorios = plan.activities.filter((a) => a.type !== 'review');

    expect(obrigatorios.map((a) => a.type)).toEqual(['alphabet', 'vocabulary']);
    expect(plan.totalMinutes).toBe(30);
  });

  it('nao devolve estrutura pelo ranqueamento', () => {
    // Gramatica no chao puxaria estrutura para o topo da fila de sobra. Em modo
    // alfabeto ela nao pode voltar: e a aula que ele ainda nao consegue ler.
    const state = russo();
    state.skills.grammar = 1;

    expect(types(state, 40)).not.toContain('structure');
  });

  it('nao duplica o bloco de alfabeto no tempo que sobra', () => {
    const state = russo();
    state.skills.reading = 1;

    expect(types(state, 40).filter((t) => t === 'alphabet')).toHaveLength(1);
  });

  it('so afeta o idioma que precisa', () => {
    const plan = planSession(
      [
        language({ code: 'en', minutesPerDay: 15 }),
        language({ code: 'ru', name: 'Русский', minutesPerDay: 15, needsAlphabet: true }),
      ],
      30,
    );
    const tipos = (code: string) =>
      plan.activities.filter((a) => a.languageCode === code).map((a) => a.type);

    expect(tipos('en')).toContain('structure');
    expect(tipos('ru')).toContain('alphabet');
  });

  it('explica por que o bloco esta ali e o coloca sob LEARN', () => {
    const plan = planSession([russo()], 30);

    expect(plan.activities.find((a) => a.type === 'alphabet')?.reason).toContain('Ler as letras');
    expect(pillarForType('alphabet')).toBe(Pillar.LEARN);
  });
});

/**
 * O degrau entre o alfabeto e a estrutura.
 *
 * O aluno nao conseguia acompanhar alemao nem russo porque nao sabia NADA dos
 * dois -- nem pronome, nem verbo, nem ordem. Ler os caracteres resolveu so
 * metade disso no russo; no alemao nao havia degrau nenhum, e a aula de
 * estrutura ja pressupoe uma frase para reorganizar.
 */
describe('modo fundamentos', () => {
  const alemao = () => language({ code: 'de', name: 'Deutsch', needsFoundation: true });

  it('troca estrutura por fundamentos enquanto o aluno nao monta frase', () => {
    const ordem = types(alemao());

    expect(ordem).toContain('foundation');
    expect(ordem).not.toContain('structure');
    // O vocabulario continua: e o conceito do dia, o mesmo dos outros idiomas.
    expect(ordem).toContain('vocabulary');
  });

  it('ocupa a vaga de estrutura, sem virar um terceiro obrigatorio', () => {
    const plan = planSession([alemao()], 30);
    const obrigatorios = plan.activities.filter((a) => a.type !== 'review');

    expect(obrigatorios.map((a) => a.type)).toEqual(['foundation', 'vocabulary']);
    expect(plan.totalMinutes).toBe(30);
  });

  it('nao devolve estrutura pelo ranqueamento', () => {
    const state = alemao();
    state.skills.grammar = 1;

    expect(types(state, 40)).not.toContain('structure');
  });

  it('nao duplica o bloco no tempo que sobra', () => {
    // A trilha serve uma licao por vez: um segundo bloco no mesmo dia repetiria
    // exatamente a mesma aula.
    const state = alemao();
    state.skills.grammar = 1;

    expect(types(state, 40).filter((t) => t === 'foundation')).toHaveLength(1);
  });

  /**
   * A ordem entre os dois degraus nao e negociavel: quem ainda nao decodifica o
   * cirilico nao tem o que fazer numa aula que monta frases em cirilico.
   */
  it('cede a vez ao alfabeto quando os dois estao pendentes', () => {
    const ordem = types(
      language({ code: 'ru', name: 'Русский', needsAlphabet: true, needsFoundation: true }),
    );

    expect(ordem).toContain('alphabet');
    expect(ordem).not.toContain('foundation');
  });

  it('assume a vaga assim que o alfabeto fecha', () => {
    const ordem = types(
      language({ code: 'ru', name: 'Русский', needsAlphabet: false, needsFoundation: true }),
    );

    expect(ordem).toContain('foundation');
    expect(ordem).not.toContain('alphabet');
  });

  it('so afeta o idioma que precisa', () => {
    const plan = planSession(
      [
        language({ code: 'en', minutesPerDay: 15 }),
        language({ code: 'de', name: 'Deutsch', minutesPerDay: 15, needsFoundation: true }),
      ],
      30,
    );
    const tipos = (code: string) =>
      plan.activities.filter((a) => a.languageCode === code).map((a) => a.type);

    expect(tipos('en')).toContain('structure');
    expect(tipos('de')).toContain('foundation');
  });

  it('explica por que o bloco esta ali e o coloca sob LEARN', () => {
    const plan = planSession([alemao()], 30);

    expect(plan.activities.find((a) => a.type === 'foundation')?.reason).toContain(
      'primeiras peças',
    );
    expect(pillarForType('foundation')).toBe(Pillar.LEARN);
  });
});

/**
 * O ranqueamento pontua `100 - competencia`, entao um idioma que o aluno nao
 * fala ganha escuta e gramatica no TOPO da fila -- justamente por ele nao saber
 * nada. Com 15 minutos por idioma, isso enchia metade do tempo de alemao e de
 * russo com dialogo falado e exercicio gerado por IA para quem estava na
 * primeira licao do alfabeto, e era o que sobrava do "nao entendo nada do que
 * aparece" depois de o bloco de fundamentos existir.
 */
describe('ranqueamento antes da estrutura', () => {
  const zerado = (overrides: Partial<LanguageState>) =>
    language({
      minutesPerDay: 15,
      skills: {
        listening: 2,
        reading: 2,
        writing: 2,
        speaking: 2,
        vocabScore: 2,
        grammar: 2,
      },
      ...overrides,
    });

  it.each([
    ['alfabeto', { code: 'ru', name: 'Русский', needsAlphabet: true }, 'alphabet'],
    ['fundamentos', { code: 'de', name: 'Deutsch', needsFoundation: true }, 'foundation'],
  ])('em modo %s, so entram os obrigatorios', (_modo, overrides, esperado) => {
    const tipos = types(zerado(overrides), 15);

    expect(tipos).toEqual([esperado, 'vocabulary']);
  });

  it('nao serve escuta nem gramatica a quem ainda nao le o idioma', () => {
    // Competencia no chao e o que MAIS puxava esses dois para cima.
    const tipos = types(zerado({ code: 'ru', name: 'Русский', needsAlphabet: true }), 15);

    expect(tipos).not.toContain('listening');
    expect(tipos).not.toContain('grammar');
    expect(tipos).not.toContain('dictation');
    expect(tipos).not.toContain('speaking');
  });

  it('devolve o tempo aos obrigatorios em vez de encurtar o dia', () => {
    const plan = planSession([zerado({ code: 'de', needsFoundation: true })], 15);

    expect(plan.totalMinutes).toBe(15);
    // Antes eram quatro blocos de 3 a 4 minutos; agora os dois que ele consegue
    // acompanhar dividem o tempo inteiro entre si.
    for (const activity of plan.activities) {
      expect(activity.plannedMinutes).toBeGreaterThanOrEqual(7);
    }
  });

  it('a revisao vencida continua passando na frente', () => {
    // O que trava a progressao trava do mesmo jeito aqui: pular a revisao
    // deixaria os cards vencendo enquanto o aluno sobe a escada.
    const tipos = types(zerado({ code: 'de', needsFoundation: true, dueReviews: 20 }), 15);

    expect(tipos[0]).toBe('review');
    expect(tipos).toContain('foundation');
  });

  it('nao toca no idioma que ja passou dos dois degraus', () => {
    const tipos = types(zerado({ code: 'en' }), 15);

    expect(tipos).toContain('structure');
    // O ranqueamento continua preenchendo o tempo que sobra, como sempre fez.
    expect(tipos.length).toBeGreaterThan(2);
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
    // No fim porque producao livre precisa do aquecimento dos blocos
    // anteriores. So o fechamento cross-language (`compare`) vem depois dela:
    // ele e a moldura do dia, nao um bloco de idioma.
    const tipos = plan.activities.map((a) => a.type);
    expect(tipos[tipos.length - 1]).toBe('compare');
    expect(tipos[tipos.length - 2]).toBe('production');
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

describe('moldura cross-language', () => {
  const quatro = () => [
    language({ code: 'en', minutesPerDay: 15 }),
    language({ code: 'es', minutesPerDay: 15 }),
    language({ code: 'de', minutesPerDay: 15 }),
    language({ code: 'ru', minutesPerDay: 15 }),
  ];

  it('abre o dia com o contraste e fecha com a comparacao', () => {
    // A ordem e a regra da pesquisa: bloquear dentro do idioma, intercalar
    // entre eles e so tornar o contraste explicito no fim.
    const tipos = planSession(quatro(), 60).activities.map((a) => a.type);

    expect(tipos[0]).toBe('contrast');
    expect(tipos[tipos.length - 1]).toBe('compare');
  });

  it('aparece uma vez cada, e nao uma por idioma', () => {
    const tipos = planSession(quatro(), 60).activities.map((a) => a.type);

    expect(tipos.filter((t) => t === 'contrast')).toHaveLength(1);
    expect(tipos.filter((t) => t === 'compare')).toHaveLength(1);
  });

  it('sai do total, sem estourar o tempo do dia', () => {
    const plan = planSession(quatro(), 60);

    expect(plan.activities.reduce((sum, a) => sum + a.plannedMinutes, 0)).toBe(60);
  });

  it('nao rouba os blocos obrigatorios de nenhum idioma', () => {
    const plan = planSession(quatro(), 60);

    for (const code of ['en', 'es', 'de', 'ru']) {
      const tipos = plan.activities.filter((a) => a.languageCode === code).map((a) => a.type);
      expect(tipos, `${code} sem estrutura`).toContain('structure');
      expect(tipos, `${code} sem vocabulario`).toContain('vocabulary');
    }
  });

  it('nao entra com um idioma so -- nao ha o que contrastar', () => {
    const tipos = types(language({ minutesPerDay: 30 }));

    expect(tipos).not.toContain('contrast');
    expect(tipos).not.toContain('compare');
  });

  it('nao entra num dia curto demais, onde comeria a sessao', () => {
    const tipos = planSession(quatro(), 20).activities.map((a) => a.type);

    expect(tipos).not.toContain('contrast');
    expect(tipos).not.toContain('compare');
  });

  it('pertence nominalmente ao idioma prioritario, com o conteudo dos quatro', () => {
    const plan = planSession(quatro(), 60);

    expect(plan.activities.find((a) => a.type === 'contrast')?.languageCode).toBe('en');
    expect(plan.activities.find((a) => a.type === 'compare')?.languageCode).toBe('en');
  });

  it('explica por que cada um esta ali e fica no pilar certo', () => {
    const plan = planSession(quatro(), 60);

    expect(plan.activities.find((a) => a.type === 'contrast')?.reason).toContain('lado a lado');
    expect(plan.activities.find((a) => a.type === 'compare')?.reason).toContain('de memória');
    expect(pillarForType('contrast')).toBe(Pillar.LEARN);
    expect(pillarForType('compare')).toBe(Pillar.LIVE);
  });

  it('nao volta como preenchimento no tempo que sobra de um idioma', () => {
    // Gramatica e escrita no chao puxariam os dois para o topo da fila se eles
    // fossem ranqueaveis -- e o aluno receberia quatro telas de comparacao,
    // cada uma dizendo pertencer a um idioma so.
    const fracos = quatro().map((l) => ({
      ...l,
      skills: { ...l.skills, grammar: 1, writing: 1 },
    }));
    const tipos = planSession(fracos, 120).activities.map((a) => a.type);

    expect(tipos.filter((t) => t === 'contrast')).toHaveLength(1);
    expect(tipos.filter((t) => t === 'compare')).toHaveLength(1);
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

/**
 * A prova mensal.
 *
 * Ela e o contrapeso da autoavaliacao: todo o resto do app mede por opiniao do
 * aluno ou cobra na mesma sessao que ensinou, e as notas disso sao exatamente
 * o que o ranqueamento usa para decidir o dia seguinte.
 */
describe('avaliacao periodica', () => {
  const quatro = () => [
    language({ code: 'en', minutesPerDay: 15 }),
    language({ code: 'es', minutesPerDay: 15 }),
    language({ code: 'de', minutesPerDay: 15 }),
    language({ code: 'ru', minutesPerDay: 15 }),
  ];

  it('nao entra sem ser pedida -- ela e mensal, nao diaria', () => {
    const plan = planSession(quatro(), 60);

    expect(plan.activities.some((a) => a.type === 'assessment')).toBe(false);
  });

  /**
   * ABRE o dia, antes ate do contraste. Servi-la depois da aula de hoje
   * deixaria o conteudo recem-visto vazar para a medida.
   */
  it('vem primeiro, antes de qualquer bloco que ensina', () => {
    const plan = planSession(quatro(), 60, { includeAssessment: true });

    expect(plan.activities[0].type).toBe('assessment');
  });

  it('entra uma vez so e nao estoura o tempo do dia', () => {
    const plan = planSession(quatro(), 60, { includeAssessment: true });

    expect(plan.activities.filter((a) => a.type === 'assessment')).toHaveLength(1);
    expect(plan.totalMinutes).toBe(60);
  });

  it('sai do total, sem roubar os blocos obrigatorios de nenhum idioma', () => {
    const plan = planSession(quatro(), 60, { includeAssessment: true });

    for (const code of ['en', 'es', 'de', 'ru']) {
      const tipos = plan.activities.filter((a) => a.languageCode === code).map((a) => a.type);
      expect(tipos).toContain('structure');
      expect(tipos).toContain('vocabulary');
    }
  });

  it('cabe junto com a producao quadrupla sem estourar', () => {
    const plan = planSession(quatro(), 60, {
      includeAssessment: true,
      includeProduction: true,
    });

    expect(plan.totalMinutes).toBe(60);
    expect(plan.activities.filter((a) => a.type === 'assessment')).toHaveLength(1);
    expect(plan.activities.filter((a) => a.type === 'production')).toHaveLength(1);
  });

  it('nao aparece num dia curto demais para comporta-la', () => {
    const plan = planSession(quatro(), 12, { includeAssessment: true });

    expect(plan.activities.some((a) => a.type === 'assessment')).toBe(false);
  });

  it('esta sob LEVEL_UP e diz que nao depende de opiniao', () => {
    const plan = planSession(quatro(), 60, { includeAssessment: true });
    const bloco = plan.activities.find((a) => a.type === 'assessment');

    expect(pillarForType('assessment')).toBe(Pillar.LEVEL_UP);
    expect(bloco?.reason).toContain('autoavaliação');
  });

  it('nunca entra no ranqueamento de um idioma', () => {
    // Ela atravessa os quatro. Deixa-la concorrer por vaga daria uma prova por
    // idioma, cada uma dizendo pertencer a uma lingua so.
    const state = language({ minutesPerDay: 40 });
    state.skills.grammar = 1;
    const plan = planSession([state], 40);

    expect(plan.activities.some((a) => a.type === 'assessment')).toBe(false);
  });
});

describe('morfologia (casos)', () => {
  /** Um idioma com tudo fraco: o ranqueamento tem vaga para quase todo mundo. */
  function fraco(overrides: Partial<LanguageState> = {}): LanguageState {
    const state = language({ minutesPerDay: 60, ...overrides });
    state.skills = {
      listening: 10,
      reading: 10,
      writing: 10,
      speaking: 10,
      vocabScore: 10,
      grammar: 10,
    };
    return state;
  }

  it('nao existe num idioma que nao marca caso', () => {
    // Servir "casos do ingles" seria inventar assunto -- e ainda gastaria com
    // ele a vaga de um bloco que ensinaria alguma coisa.
    const plan = planSession([fraco({ hasMorphology: false })], 60);

    expect(plan.activities.some((a) => a.type === 'morphology')).toBe(false);
  });

  it('concorre no idioma que marca caso', () => {
    const plan = planSession([fraco({ code: 'de', name: 'Deutsch', hasMorphology: true })], 60);

    expect(plan.activities.some((a) => a.type === 'morphology')).toBe(true);
  });

  /**
   * Artigo e preposicao continuam apontando para gramatica -- em ingles e
   * espanhol e ali que o erro se resolve. Mas em alemao e russo os dois sao
   * quase sempre o mesmo erro: o caso errado.
   */
  it('erro de artigo puxa os casos para cima onde eles existem', () => {
    const comErro = planSession(
      [fraco({ code: 'de', hasMorphology: true, errorCounts: { ARTICLE: 9 } })],
      60,
    ).activities;
    const semErro = planSession([fraco({ code: 'de', hasMorphology: true })], 60).activities;

    const posicao = (blocos: typeof comErro) =>
      blocos.findIndex((a) => a.type === 'morphology');

    expect(posicao(comErro)).toBeGreaterThanOrEqual(0);
    expect(posicao(comErro)).toBeLessThanOrEqual(posicao(semErro));
  });

  it('erro de artigo continua puxando gramatica onde nao ha caso', () => {
    // Sem esta garantia, mover o reforco para morfologia deixaria os erros de
    // artigo do ingles e do espanhol sem destino nenhum.
    const plan = planSession(
      [fraco({ hasMorphology: false, errorCounts: { ARTICLE: 9 } })],
      60,
    );

    expect(plan.activities.some((a) => a.type === 'grammar')).toBe(true);
  });

  it('esta sob LEARN: produzir a forma certa e treino', () => {
    expect(pillarForType('morphology')).toBe(Pillar.LEARN);
  });
});

describe('armadilhas cruzadas', () => {
  function fraco(overrides: Partial<LanguageState> = {}): LanguageState {
    const state = language({ minutesPerDay: 60, ...overrides });
    state.skills = {
      listening: 10,
      reading: 10,
      writing: 10,
      speaking: 10,
      vocabScore: 10,
      grammar: 10,
    };
    return state;
  }

  /**
   * O bloco e movido pela EVIDENCIA, nao pela competencia: sem par confuso para
   * desambiguar, ele treinaria uma confusao que este aluno nao tem -- e ainda
   * tomaria a vaga de um bloco escolhido pela fraqueza real.
   */
  it('nao entra sem interferencia diagnosticada', () => {
    const plan = planSession([fraco({ interferenceErrors: 0 })], 60);

    expect(plan.activities.some((a) => a.type === 'traps')).toBe(false);
  });

  it('entra quando outro idioma esta vazando', () => {
    const plan = planSession([fraco({ interferenceErrors: 6 })], 60);

    expect(plan.activities.some((a) => a.type === 'traps')).toBe(true);
  });

  it('sobe na fila conforme a interferencia se acumula', () => {
    const posicao = (errors: number) =>
      planSession([fraco({ interferenceErrors: errors })], 60).activities.findIndex(
        (a) => a.type === 'traps',
      );

    expect(posicao(12)).toBeLessThanOrEqual(posicao(1));
  });

  it('explica-se pelo numero de erros vindos de outro idioma', () => {
    const plan = planSession([fraco({ interferenceErrors: 6 })], 60);
    const bloco = plan.activities.find((a) => a.type === 'traps');

    expect(bloco?.reason).toContain('outro idioma');
  });

  it('continua alcancavel pela pratica livre', () => {
    // A bandeira governa a entrada AUTOMATICA. Pedir o bloco explicitamente
    // continua valendo -- ali o catalogo curado preenche a rodada sozinho.
    expect(PRACTICABLE_TYPES).toContain('traps');
  });
});
