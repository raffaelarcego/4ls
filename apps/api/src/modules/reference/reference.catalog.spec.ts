import { describe, expect, it } from 'vitest';
import { CYRILLIC_LESSONS } from '../alphabet/cyrillic.catalog';
import { flatEntries, REFERENCES, referenceFor } from './reference.catalog';

const all = Object.keys(REFERENCES).map((code) => [code, referenceFor(code)!] as const);

describe('material de consulta', () => {
  it('existe para russo e alemao', () => {
    expect(Object.keys(REFERENCES).sort()).toEqual(['de', 'ru']);
  });

  it('nao existe para quem le igual ao portugues', () => {
    // Ingles e espanhol nao entram: a leitura deles nao e o obstaculo, e uma
    // tabela ali seria pagina morta na navegacao.
    expect(referenceFor('en')).toBeUndefined();
    expect(referenceFor('es')).toBeUndefined();
  });

  it.each(all)('a referencia de %s esta completa', (_code, reference) => {
    expect(reference.title.trim()).not.toBe('');
    expect(reference.intro.trim()).not.toBe('');
    expect(reference.sections.length).toBeGreaterThan(0);

    for (const section of reference.sections) {
      expect(section.id.trim()).not.toBe('');
      expect(section.title.trim()).not.toBe('');
      expect(section.entries.length).toBeGreaterThan(0);

      for (const entry of section.entries) {
        expect(entry.symbol.trim()).not.toBe('');
        // O som ancorado em portugues e o unico campo que a consulta nao pode
        // deixar de ter: e literalmente a resposta que o aluno veio buscar.
        expect(entry.sound.trim()).not.toBe('');
      }
    }
  });

  it.each(all)('em %s nao ha secao com id repetido', (_code, reference) => {
    const ids = reference.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * Derivado, e nao copiado. Duas tabelas do alfabeto russo divergiriam no dia
   * em que alguem corrigisse uma ancora de som numa delas, e a letra Ж
   * passaria a ter dois sons conforme a tela.
   */
  it('o cirilico sai da MESMA fonte da trilha', () => {
    const reference = referenceFor('ru')!;
    const naTrilha = CYRILLIC_LESSONS.flatMap((l) => l.letters);

    expect(flatEntries(reference)).toHaveLength(naTrilha.length);
    expect(reference.sections.map((s) => s.id)).toEqual(CYRILLIC_LESSONS.map((l) => l.id));

    for (const letter of naTrilha) {
      const entry = flatEntries(reference).find((e) => e.symbol.startsWith(letter.upper));
      expect(entry?.sound, `${letter.upper} sem o mesmo som da trilha`).toBe(letter.sound);
    }
  });

  it('as armadilhas da trilha chegam inteiras na consulta', () => {
    const reference = referenceFor('ru')!;
    const comArmadilha = CYRILLIC_LESSONS.flatMap((l) => l.letters).filter((l) => l.trap);

    expect(comArmadilha.length).toBeGreaterThan(0);
    for (const letter of comArmadilha) {
      const entry = flatEntries(reference).find((e) => e.symbol.startsWith(letter.upper));
      expect(entry?.trap).toBe(letter.trap);
    }
  });

  /**
   * A ordem alfabetica so e oferecida onde procurar por simbolo faz sentido.
   * "Ordem alfabetica de ditongos" nao ajuda ninguem a achar nada.
   */
  it('so o alfabeto se ordena', () => {
    expect(referenceFor('ru')!.sortable).toBe(true);
    expect(referenceFor('de')!.sortable).toBe(false);
  });

  it('o alemao cobre os enganos que os Fundamentos marcam', () => {
    // Estas sao exatamente as armadilhas escritas nas licoes de fundamentos.
    // Se uma sair daqui, o aluno fica sem onde consultar o que a aula avisou.
    const simbolos = flatEntries(referenceFor('de')!).map((e) => e.symbol);

    for (const esperado of ['ei', 'ie', 'eu / äu', 'w', 'v', 'z', 'j', 'ü']) {
      expect(simbolos, `falta ${esperado}`).toContain(esperado);
    }
  });
});
