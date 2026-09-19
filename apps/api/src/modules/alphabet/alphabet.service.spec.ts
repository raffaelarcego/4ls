import { describe, expect, it } from 'vitest';
import { selectAlphabetLesson } from './alphabet.service';
import { CYRILLIC_LESSONS } from './cyrillic.catalog';

const lessons = CYRILLIC_LESSONS;
const id = (index: number) => lessons[index].id;

/** Dominio de todas as licoes ate um indice, exclusive. */
function masteredUpTo(count: number, value = 100): Record<string, number> {
  return Object.fromEntries(lessons.slice(0, count).map((l) => [l.id, value]));
}

describe('escolha da licao de alfabeto', () => {
  it('comeca na primeira quando nao ha nenhum progresso', () => {
    const escolha = selectAlphabetLesson(lessons, {});

    expect(escolha.lesson.id).toBe(id(0));
    expect(escolha.index).toBe(1);
    expect(escolha.complete).toBe(false);
  });

  it('avanca para a primeira licao ainda nao vencida', () => {
    const escolha = selectAlphabetLesson(lessons, masteredUpTo(3));

    expect(escolha.lesson.id).toBe(id(3));
    expect(escolha.index).toBe(4);
  });

  /**
   * A trilha e uma escada: a licao 4 le palavras com as letras da 1 a 3. Pular
   * um degrau porque o de tras "esta mais atrasado" entregaria uma aula com
   * letras que o aluno nunca viu -- exatamente o problema que a trilha existe
   * para resolver.
   */
  it('nao pula um degrau fraco por causa de um degrau forte a frente', () => {
    const escolha = selectAlphabetLesson(lessons, {
      ...masteredUpTo(5),
      [id(1)]: 40,
    });

    expect(escolha.lesson.id).toBe(id(1));
  });

  it('exige 80 para dar a licao por vencida', () => {
    expect(selectAlphabetLesson(lessons, { [id(0)]: 79 }).lesson.id).toBe(id(0));
    expect(selectAlphabetLesson(lessons, { [id(0)]: 80 }).lesson.id).toBe(id(1));
  });

  it('para na ultima licao, marcada como concluida, quando tudo esta vencido', () => {
    const escolha = selectAlphabetLesson(lessons, masteredUpTo(lessons.length));

    expect(escolha.lesson.id).toBe(id(lessons.length - 1));
    expect(escolha.index).toBe(lessons.length);
    expect(escolha.complete).toBe(true);
  });
});
