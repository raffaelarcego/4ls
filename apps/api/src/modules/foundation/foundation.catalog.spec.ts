import { describe, expect, it } from 'vitest';
import { FOUNDATION_TRACKS, foundationTopicId, piecesUpTo } from './foundation.catalog';

const tracks = Object.entries(FOUNDATION_TRACKS);

/** O texto sem pontuacao, para comparar com as pecas remontadas. */
function bare(text: string): string {
  return text
    .replace(/[.,!?;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('catalogo de fundamentos', () => {
  it('existe para alemao e russo, e so para eles', () => {
    // Ingles e espanhol nao entram de proposito: o aluno ja monta frase nos
    // dois, e uma aula de "eu sou / voce e" ali seria tempo de estudo gasto num
    // degrau ja subido. Quem decide e o estado do aluno, nao a fama do idioma.
    expect(Object.keys(FOUNDATION_TRACKS).sort()).toEqual(['de', 'ru']);
  });

  it('nao repete id de licao em lugar nenhum', () => {
    const ids = tracks.flatMap(([, lessons]) => lessons.map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(tracks)('a trilha de %s tem licoes completas', (code, lessons) => {
    expect(lessons.length).toBeGreaterThanOrEqual(6);

    for (const lesson of lessons) {
      expect(lesson.id.startsWith(`${code}-fund-`)).toBe(true);
      expect(lesson.title.trim()).not.toBe('');
      expect(lesson.goal.trim()).not.toBe('');
      // A regra e o texto que o aluno nao tem como deduzir olhando as pecas.
      // Uma licao sem ela vira lista de palavras, que e o que esta trilha veio
      // justamente substituir.
      expect(lesson.rule.trim()).not.toBe('');
      expect(lesson.pieces.length).toBeGreaterThan(0);
      expect(lesson.sentences.length).toBeGreaterThan(0);
    }
  });

  /**
   * O treino de montagem embaralha `parts` e pede a ordem certa. Se as pecas
   * nao remontarem a frase, o exercicio corrigiria contra um gabarito que nao e
   * a frase que o aluno acabou de ler.
   */
  it.each(tracks)('em %s, as pecas da frase remontam a frase', (_code, lessons) => {
    for (const lesson of lessons) {
      for (const sentence of lesson.sentences) {
        const remontada = sentence.parts.map((p) => p.chunk).join(' ');
        expect(bare(remontada)).toBe(bare(sentence.text));
      }
    }
  });

  it.each(tracks)('em %s, toda peca de frase tem um papel nomeado', (_code, lessons) => {
    for (const lesson of lessons) {
      for (const sentence of lesson.sentences) {
        expect(sentence.parts.length).toBeGreaterThan(0);
        expect(sentence.reading.trim()).not.toBe('');
        expect(sentence.meaning.trim()).not.toBe('');

        for (const part of sentence.parts) {
          expect(part.chunk.trim()).not.toBe('');
          // Rotulo em portugues e em caixa alta -- e a mesma coluna das can-dos,
          // e e ele que faz o aluno ver o PAPEL da peca em vez da palavra.
          expect(part.label).toBe(part.label.toUpperCase());
          expect(part.label.trim()).not.toBe('');
        }
      }
    }
  });

  it.each(tracks)('em %s, toda peca tem significado e leitura', (_code, lessons) => {
    for (const lesson of lessons) {
      for (const piece of lesson.pieces) {
        expect(piece.term.trim()).not.toBe('');
        expect(piece.meaning.trim()).not.toBe('');
        // A leitura soletrada em portugues e o que permite o aluno tentar em voz
        // alta no primeiro dia, antes de qualquer audio carregar.
        expect(piece.reading.trim()).not.toBe('');
      }
    }
  });

  describe('pecas anteriores', () => {
    it('a primeira licao nao tem nenhuma', () => {
      expect(piecesUpTo('de', FOUNDATION_TRACKS.de[0].id)).toEqual([]);
    });

    it('acumulam todas as licoes antes da atual, e nao a propria', () => {
      const [primeira, segunda, terceira] = FOUNDATION_TRACKS.de;
      const anteriores = piecesUpTo('de', terceira.id);

      expect(anteriores).toHaveLength(primeira.pieces.length + segunda.pieces.length);
      expect(anteriores.some((p) => terceira.pieces.includes(p))).toBe(false);
    });

    it('devolve vazio para um idioma sem trilha', () => {
      expect(piecesUpTo('en', 'de-fund-1')).toEqual([]);
    });
  });

  it('separa o progresso dos outros topicos pelo prefixo', () => {
    // A mesma tabela `grammar_progress` guarda alfabeto, estrutura e gramatica.
    expect(foundationTopicId('de-fund-1')).toBe('foundation:de-fund-1');
  });
});
