import { ErrorCategory } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { dedupeFilter } from './errors.service';

describe('deduplicacao de erros', () => {
  it('casa por categoria quando o erro e estrutural', () => {
    // A descricao nao entra no filtro: o modelo reformula o texto a cada
    // chamada, e casar por string criaria uma linha nova toda vez -- a
    // contagem de ocorrencias nunca acumularia.
    const filtro = dedupeFilter({
      category: ErrorCategory.WORD_ORDER,
      description: 'Colocou o verbo antes do sujeito na subordinada.',
    });

    expect(filtro).toEqual({});
  });

  it('trata duas formulacoes do mesmo erro estrutural como iguais', () => {
    const primeira = dedupeFilter({
      category: ErrorCategory.GRAMMAR,
      description: 'Erro de concordancia verbal.',
    });
    const segunda = dedupeFilter({
      category: ErrorCategory.GRAMMAR,
      description: 'O verbo nao concorda com o sujeito.',
    });

    expect(primeira).toEqual(segunda);
  });

  it('casa pelo termo entre aspas quando o erro e de vocabulario', () => {
    const filtro = dedupeFilter({
      category: ErrorCategory.VOCABULARY,
      description: 'Usou "actually" com o sentido de "atualmente".',
    });

    expect(filtro).toEqual({
      description: { contains: 'actually', mode: 'insensitive' },
    });
  });

  it('aplica a mesma regra a falso cognato', () => {
    const filtro = dedupeFilter({
      category: ErrorCategory.FALSE_COGNATE,
      description: "Confundiu 'pretend' com 'pretender'.",
    });

    expect(filtro).toEqual({
      description: { contains: 'pretend', mode: 'insensitive' },
    });
  });

  it('cai na descricao inteira quando o vocabulario nao traz termo entre aspas', () => {
    const filtro = dedupeFilter({
      category: ErrorCategory.VOCABULARY,
      description: 'Vocabulario pobre para o nivel.',
    });

    expect(filtro).toEqual({ description: 'Vocabulario pobre para o nivel.' });
  });

  it('separa palavras diferentes da mesma categoria', () => {
    const actually = dedupeFilter({
      category: ErrorCategory.VOCABULARY,
      description: 'Usou "actually" errado.',
    });
    const eventually = dedupeFilter({
      category: ErrorCategory.VOCABULARY,
      description: 'Usou "eventually" errado.',
    });

    expect(actually).not.toEqual(eventually);
  });
});
