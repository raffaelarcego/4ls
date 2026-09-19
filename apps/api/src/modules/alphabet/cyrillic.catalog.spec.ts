import { describe, expect, it } from 'vitest';
import { CYRILLIC_LESSONS, lettersUpTo } from './cyrillic.catalog';

/** As 33 letras do alfabeto russo, na ordem oficial. */
const ALFABETO_RUSSO = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';

describe('catalogo do alfabeto cirilico', () => {
  /**
   * A promessa central da trilha, e a que quebra em silencio: o aluno so le
   * palavras formadas por letras que ele ja viu. Basta alguem trocar uma
   * palavra de exemplo por uma "melhor" para a licao 2 pedir uma letra da 6 --
   * e o aluno trava sem entender por que.
   */
  it('so usa letras ja ensinadas nas palavras de cada licao', () => {
    for (const lesson of CYRILLIC_LESSONS) {
      const conhecidas = new Set(lettersUpTo(lesson.id).map((l) => l.lower));

      for (const { word } of lesson.words) {
        const desconhecidas = [...word.toLowerCase()].filter(
          (char) => /\p{Script=Cyrillic}/u.test(char) && !conhecidas.has(char),
        );

        expect(
          desconhecidas,
          `"${word}" (${lesson.id}) usa letra ainda não ensinada: ${desconhecidas.join(', ')}`,
        ).toEqual([]);
      }
    }
  });

  it('cobre as 33 letras exatamente uma vez', () => {
    const ensinadas = CYRILLIC_LESSONS.flatMap((l) => l.letters).map((l) => l.lower);
    const duplicadas = ensinadas.filter((letra, i) => ensinadas.indexOf(letra) !== i);

    expect(duplicadas, `letras repetidas: ${duplicadas.join(', ')}`).toEqual([]);
    expect([...ensinadas].sort().join('')).toBe([...ALFABETO_RUSSO].sort().join(''));
  });

  it('marca como armadilha toda letra que engana quem lê alfabeto latino', () => {
    // Estas sao as que o aluno le errado com confianca -- se alguma perder o
    // aviso, o erro volta a passar despercebido.
    const precisamDeAviso = ['н', 'р', 'с', 'в', 'у', 'х', 'е'];
    const comAviso = CYRILLIC_LESSONS.flatMap((l) => l.letters)
      .filter((l) => l.trap)
      .map((l) => l.lower);

    for (const letra of precisamDeAviso) {
      expect(comAviso, `a letra "${letra}" precisa de um aviso de armadilha`).toContain(letra);
    }
  });

  /**
   * A tela monta um exercicio "qual letra faz o som X?" usando esta ancora como
   * enunciado. Se duas letras compartilharem a mesma frase de som, a pergunta
   * passa a ter duas respostas certas e uma delas e marcada como erro.
   */
  it('não repete a âncora de som entre letras', () => {
    const sons = CYRILLIC_LESSONS.flatMap((l) => l.letters).map((l) => l.sound);
    const repetidas = sons.filter((som, i) => sons.indexOf(som) !== i);

    expect(repetidas, `âncoras de som repetidas: ${repetidas.join(' | ')}`).toEqual([]);
  });

  it('dá a cada licao pelo menos uma palavra de verdade para ler', () => {
    for (const lesson of CYRILLIC_LESSONS) {
      expect(lesson.words.length, `${lesson.id} sem palavras`).toBeGreaterThan(0);
      for (const w of lesson.words) {
        expect(w.meaning.trim().length, `${w.word} sem significado`).toBeGreaterThan(0);
        expect(w.reading.trim().length, `${w.word} sem leitura`).toBeGreaterThan(0);
      }
    }
  });
});
