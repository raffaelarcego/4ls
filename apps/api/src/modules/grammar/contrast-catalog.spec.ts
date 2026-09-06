import { describe, expect, it } from 'vitest';
import {
  CONTRAST_TOPICS,
  Lang,
  STUDY_LANGUAGES,
  supportFor,
  topicsFor,
} from './contrast-catalog';

const ALL: Lang[] = ['pt', 'en', 'es', 'de'];

describe('catalogo de contrastes', () => {
  it('nao repete id', () => {
    const ids = CONTRAST_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('particiona os quatro idiomas em groups, sem sobra nem repeticao', () => {
    // `groups` e a fonte de verdade de quem ajuda e quem contrasta. Um idioma
    // faltando ali faria supportFor devolver a resposta errada em silencio.
    for (const topic of CONTRAST_TOPICS) {
      const flat = topic.groups.flat();
      expect(new Set(flat).size, `${topic.id}: idioma repetido entre grupos`).toBe(flat.length);
      expect([...flat].sort(), `${topic.id}: groups nao cobre os 4 idiomas`).toEqual([...ALL].sort());
    }
  });

  it('descreve o comportamento dos quatro idiomas', () => {
    for (const topic of CONTRAST_TOPICS) {
      for (const lang of ALL) {
        expect(topic.behavior[lang]?.length, `${topic.id}/${lang}`).toBeGreaterThan(0);
      }
    }
  });

  it('so tem idiomas de estudo como alvo', () => {
    for (const topic of CONTRAST_TOPICS) {
      expect(topic.targets.length, `${topic.id} sem alvo`).toBeGreaterThan(0);
      for (const target of topic.targets) {
        expect(STUDY_LANGUAGES, `${topic.id}: alvo ${target}`).toContain(target);
      }
    }
  });

  it('preenche os exemplos nos quatro idiomas', () => {
    for (const topic of CONTRAST_TOPICS) {
      expect(topic.examples.length, `${topic.id} sem exemplo`).toBeGreaterThan(0);
      for (const example of topic.examples) {
        for (const lang of ALL) {
          expect(example[lang]?.length, `${topic.id}: exemplo sem ${lang}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('supportFor', () => {
  it('prefere um idioma de estudo ao portugues como aliado', () => {
    // Verbos separaveis: alemao e ingles no mesmo grupo. Estudando alemao, o
    // ingles tem de ser o aliado -- e o ponto do modulo inteiro.
    const topic = CONTRAST_TOPICS.find((t) => t.id === 'separable-verbs')!;
    expect(supportFor(topic, 'de').ally).toBe('en');
  });

  it('cai no portugues quando nenhum idioma de estudo confirma a intuicao', () => {
    // Artigos: portugues, espanhol e alemao usam artigo; o ingles nao. Como o
    // espanhol vem antes na ordem, ele e o aliado; o portugues so entraria se
    // o espanhol nao servisse.
    const topic = CONTRAST_TOPICS.find((t) => t.id === 'articles-usage')!;
    expect(supportFor(topic, 'de').ally).toBe('es');
    expect(supportFor(topic, 'de').contrast).toBe('en');
  });

  it('devolve aliado nulo quando o alvo esta sozinho no grupo', () => {
    // Casos: o alemao nao tem companhia. Forcar um aliado aqui seria mentir --
    // o topico usa o campo `bridge` para explicar a analogia parcial.
    const topic = CONTRAST_TOPICS.find((t) => t.id === 'cases')!;
    const support = supportFor(topic, 'de');
    expect(support.ally).toBeNull();
    expect(support.contrast).toBe('en');
    expect(topic.bridge, 'topico sem aliado precisa de bridge').toBeTruthy();
  });

  it('nunca aponta o proprio alvo como apoio', () => {
    for (const topic of CONTRAST_TOPICS) {
      for (const target of topic.targets) {
        const { ally, contrast } = supportFor(topic, target);
        expect(ally, `${topic.id}/${target}`).not.toBe(target);
        expect(contrast, `${topic.id}/${target}`).not.toBe(target);
      }
    }
  });

  it('sempre encontra um contraste, que e o que da a licao', () => {
    for (const topic of CONTRAST_TOPICS) {
      for (const target of topic.targets) {
        expect(supportFor(topic, target).contrast, `${topic.id}/${target}`).not.toBeNull();
      }
    }
  });

  it('todo topico sem aliado explica a analogia por outro caminho', () => {
    for (const topic of CONTRAST_TOPICS) {
      for (const target of topic.targets) {
        if (supportFor(topic, target).ally === null) {
          expect(topic.bridge, `${topic.id}/${target} sem aliado e sem bridge`).toBeTruthy();
        }
      }
    }
  });
});

describe('topicsFor', () => {
  it('da conteudo para os tres idiomas de estudo', () => {
    for (const lang of STUDY_LANGUAGES) {
      expect(topicsFor(lang).length, `${lang} sem topicos`).toBeGreaterThan(0);
    }
  });

  it('nao devolve topico que nao declara o alvo', () => {
    expect(topicsFor('es').map((t) => t.id)).not.toContain('cases');
  });
});
