import { describe, expect, it } from 'vitest';
import { MorphologySlot } from './morphology.catalog';
import {
  buildDrills,
  completeParadigm,
  ParadigmExample,
  ParadigmForm,
  usableExample,
} from './morphology.service';

/**
 * A tabela fica guardada e o aluno volta a ela toda vez que duvidar. Uma
 * terminacao errada aqui nao erra uma frase: erra TODAS as frases daquela
 * funcao, por meses, e ele nao tem como desconfiar -- a tabela e justamente o
 * lugar onde ele iria conferir.
 */

const SLOT_IDS = ['ru-nom', 'ru-gen', 'ru-dat'];

const FORMS: ParadigmForm[] = [
  { slotId: 'ru-nom', form: 'работа', romanization: 'rabota', note: null },
  { slotId: 'ru-gen', form: 'работы', romanization: 'raboty', note: 'Termina em -ы.' },
  { slotId: 'ru-dat', form: 'работе', romanization: 'rabote', note: 'Termina em -е.' },
];

function example(overrides: Partial<ParadigmExample> = {}): ParadigmExample {
  return {
    slotId: 'ru-gen',
    sentence: 'У меня нет работы.',
    romanization: 'U menya net raboty.',
    translation: 'Não tenho trabalho.',
    gap: 'работы',
    ...overrides,
  };
}

function slot(id: string): MorphologySlot {
  return {
    id,
    languageCode: 'ru',
    name: id,
    question: 'de quê?',
    triggers: ['нет'],
    trap: 'x',
    level: 'A1',
  };
}

describe('tabela completa', () => {
  it('aceita a tabela com uma forma para cada caso', () => {
    expect(completeParadigm(FORMS, SLOT_IDS)).toBe(true);
  });

  it('recusa a tabela com um caso faltando', () => {
    expect(completeParadigm(FORMS.slice(0, 2), SLOT_IDS)).toBe(false);
  });

  /**
   * Todas as formas iguais e o sinal de que a palavra nao declina -- um verbo,
   * um adverbio, um nome proprio. A tabela existiria sem ensinar nada, e todos
   * os exercicios teriam a mesma resposta.
   */
  it('recusa a palavra que não declina', () => {
    const iguais = SLOT_IDS.map((slotId) => ({ slotId, form: 'сегодня' }));
    expect(completeParadigm(iguais, SLOT_IDS)).toBe(false);
  });

  it('recusa a tabela vazia', () => {
    expect(completeParadigm([], SLOT_IDS)).toBe(false);
  });
});

describe('exemplo utilizável', () => {
  it('aceita o exemplo cuja lacuna é a forma daquele caso', () => {
    expect(usableExample(example(), FORMS)).toBe(true);
  });

  /**
   * Sem esta checagem o enunciado sai SEM LACUNA: o `replace` nao encontra nada
   * e a frase aparece inteira, com a resposta à vista.
   */
  it('recusa a lacuna que não está na frase', () => {
    expect(usableExample(example({ gap: 'работе' }), FORMS)).toBe(false);
  });

  /**
   * O pior caso: a lacuna existe na frase mas nao bate com a tabela. A questao
   * fica sem resposta certa entre as alternativas, o aluno erra uma questao
   * impossivel e isso vai para o progresso do caso.
   */
  it('recusa a lacuna que não é a forma daquele caso', () => {
    const torto = example({
      slotId: 'ru-dat',
      sentence: 'У меня нет работы.',
      gap: 'работы',
    });

    expect(usableExample(torto, FORMS)).toBe(false);
  });

  it('recusa o exemplo sem tradução', () => {
    expect(usableExample(example({ translation: ' ' }), FORMS)).toBe(false);
  });
});

describe('exercícios da rodada', () => {
  const main = {
    term: 'работа',
    forms: FORMS,
    examples: [
      example({ slotId: 'ru-nom', sentence: 'Работа начинается в восемь.', gap: 'Работа' }),
      example(),
      example({ slotId: 'ru-dat', sentence: 'Я иду к работе.', gap: 'работе' }),
    ],
  };

  const candidates = SLOT_IDS.map(slot);

  it('cobra um exercício por caso do nível', () => {
    const drills = buildDrills(main, [], slot('ru-gen'), candidates);
    expect(drills.map((d) => d.slotId)).toEqual(SLOT_IDS);
  });

  it('esconde a forma dentro da frase', () => {
    const drills = buildDrills(main, [], slot('ru-gen'), candidates);
    const genitivo = drills.find((d) => d.slotId === 'ru-gen')!;

    expect(genitivo.sentence).toBe('У меня нет ____.');
    expect(genitivo.answer).toBe('работы');
    expect(genitivo.options).toContain('работы');
  });

  /**
   * Os distratores sao as OUTRAS formas da mesma palavra: os concorrentes reais,
   * de graca, sem gabarito escrito a mao.
   */
  it('usa as outras formas da palavra como distratores', () => {
    const drills = buildDrills(main, [], slot('ru-gen'), candidates);
    expect(drills[0].options.sort()).toEqual(['работа', 'работе', 'работы']);
  });

  /**
   * Quem so treina o dativo de "работа" aprende "работе", nao o dativo. As
   * palavras extras cobram o MESMO caso fora da tabela que esta na tela.
   */
  it('repete o caso do dia em outras palavras', () => {
    const extra = {
      term: 'книга',
      forms: [
        { slotId: 'ru-nom', form: 'книга' },
        { slotId: 'ru-gen', form: 'книги' },
        { slotId: 'ru-dat', form: 'книге' },
      ],
      examples: [example({ slotId: 'ru-gen', sentence: 'У меня нет книги.', gap: 'книги' })],
    };

    const drills = buildDrills(main, [extra], slot('ru-gen'), candidates);

    expect(drills).toHaveLength(SLOT_IDS.length + 1);
    expect(drills[drills.length - 1].term).toBe('книга');
    expect(drills[drills.length - 1].slotId).toBe('ru-gen');
  });

  it('pula o caso sem exemplo em vez de inventar um', () => {
    const semDativo = { ...main, examples: main.examples.filter((e) => e.slotId !== 'ru-dat') };
    const drills = buildDrills(semDativo, [], slot('ru-gen'), candidates);

    expect(drills.map((d) => d.slotId)).toEqual(['ru-nom', 'ru-gen']);
  });

  /**
   * Formas repetidas viram uma alternativa so: o acusativo que copia o
   * nominativo deixaria duas respostas certas na tela.
   */
  it('não oferece a mesma forma duas vezes', () => {
    const comRepeticao = {
      ...main,
      forms: [...FORMS, { slotId: 'ru-acc', form: 'работа' }],
    };
    const drills = buildDrills(comRepeticao, [], slot('ru-gen'), candidates);

    expect(new Set(drills[0].options).size).toBe(drills[0].options.length);
  });
});
