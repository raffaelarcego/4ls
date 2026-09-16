import { describe, expect, it } from 'vitest';
import {
  findPattern,
  LEVEL_ORDER,
  patternsFor,
  progressTopicId,
  SENTENCE_PATTERNS,
} from './sentence-patterns.catalog';

const STUDY_CODES = ['en', 'es', 'de', 'ru'];

describe('catalogo de formacao de frase', () => {
  it('nao repete id', () => {
    const ids = SENTENCE_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('da conteudo para os quatro idiomas de estudo', () => {
    // Estrutura e bloco obrigatorio diario em todo idioma. Um idioma sem
    // padrao no catalogo derrubaria o bloco dele todo dia, em silencio.
    for (const code of STUDY_CODES) {
      expect(patternsFor(code, 'B2').length, `${code} sem padrao`).toBeGreaterThan(0);
    }
  });

  it('comeca todo idioma no A1', () => {
    // Sem padrao A1 o aluno iniciante nao teria aula nenhuma naquele idioma.
    for (const code of STUDY_CODES) {
      expect(patternsFor(code, 'A1').length, `${code} sem padrao A1`).toBeGreaterThan(0);
    }
  });

  it('explica a regra e o contraste em todo padrao', () => {
    // O `behavior` e a verdade que a IA nao pode contradizer, e o `contrast` e
    // o que combate a interferencia entre os idiomas. Faltando um dos dois, a
    // aula vira texto gerado sem ancora.
    for (const pattern of SENTENCE_PATTERNS) {
      expect(pattern.behavior.length, `${pattern.id} sem regra`).toBeGreaterThan(40);
      expect(pattern.contrast.length, `${pattern.id} sem contraste`).toBeGreaterThan(40);
      expect(pattern.question.length, `${pattern.id} sem pergunta`).toBeGreaterThan(10);
    }
  });

  it('usa apenas niveis conhecidos', () => {
    for (const pattern of SENTENCE_PATTERNS) {
      expect(LEVEL_ORDER, `${pattern.id}: nivel ${pattern.level}`).toContain(pattern.level);
    }
  });
});

describe('patternsFor', () => {
  it('nao entrega padrao acima do nivel do aluno', () => {
    for (const pattern of patternsFor('de', 'A1')) {
      expect(pattern.level, pattern.id).toBe('A1');
    }
  });

  it('acumula os niveis anteriores', () => {
    const a1 = patternsFor('de', 'A1').length;
    const b1 = patternsFor('de', 'B1').length;

    expect(b1).toBeGreaterThan(a1);
  });

  it('entrega o catalogo inteiro a quem ja passou do B2', () => {
    // C1 e C2 nao existem no catalogo; sem este tratamento o aluno avancado
    // ficaria sem aula nenhuma justamente por saber mais.
    expect(patternsFor('de', 'C1').length).toBe(patternsFor('de', 'B2').length);
    expect(patternsFor('de', 'C1').length).toBeGreaterThan(0);
  });

  it('nao mistura idiomas', () => {
    for (const pattern of patternsFor('ru', 'B2')) {
      expect(pattern.languageCode, pattern.id).toBe('ru');
    }
  });
});

describe('progressTopicId', () => {
  it('separa o progresso de estrutura do de gramatica contrastiva', () => {
    // Os dois gravam em grammar_progress. Sem o prefixo, um padrao e um topico
    // de mesmo id se misturariam no dominio do aluno.
    expect(progressTopicId('de-verb-second')).toBe('structure:de-verb-second');
  });
});

describe('findPattern', () => {
  it('acha pelo id e devolve undefined para o que nao existe', () => {
    expect(findPattern('de-verb-second')?.languageCode).toBe('de');
    expect(findPattern('nao-existe')).toBeUndefined();
  });
});
