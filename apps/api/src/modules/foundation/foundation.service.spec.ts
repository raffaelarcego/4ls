import { describe, expect, it } from 'vitest';
import { FOUNDATION_TRACKS } from './foundation.catalog';
import { selectFoundationLesson } from './foundation.service';

const lessons = FOUNDATION_TRACKS.de;
const id = (index: number) => lessons[index].id;

/** Dominio de todas as licoes ate um indice, exclusive. */
function masteredUpTo(count: number, value = 100): Record<string, number> {
  return Object.fromEntries(lessons.slice(0, count).map((l) => [l.id, value]));
}

describe('escolha da licao de fundamentos', () => {
  it('comeca na primeira quando nao ha nenhum progresso', () => {
    const escolha = selectFoundationLesson(lessons, {});

    expect(escolha.lesson.id).toBe(id(0));
    expect(escolha.index).toBe(1);
    expect(escolha.complete).toBe(false);
  });

  it('avanca para a primeira licao ainda nao vencida', () => {
    const escolha = selectFoundationLesson(lessons, masteredUpTo(3));

    expect(escolha.lesson.id).toBe(id(3));
    expect(escolha.index).toBe(4);
  });

  /**
   * Mesma razao da escada do alfabeto: a licao do verbo no presente monta
   * frases com a negacao da licao 3 e o "hier" da 4. Pular um degrau fraco
   * porque o da frente esta mais atrasado entregaria uma aula com pecas que o
   * aluno nunca viu.
   */
  it('nao pula um degrau fraco por causa de um degrau forte a frente', () => {
    const escolha = selectFoundationLesson(lessons, {
      ...masteredUpTo(5),
      [id(1)]: 40,
    });

    expect(escolha.lesson.id).toBe(id(1));
  });

  /**
   * 75, e nao os 80 do alfabeto: aqui o que se mede e montagem de frase, e a
   * frase reaparece nos blocos seguintes. Segurar o aluno num degrau por causa
   * de uma terminacao custa mais do que deixar a exposicao consertar.
   */
  it('exige 75 para dar a licao por vencida', () => {
    expect(selectFoundationLesson(lessons, { [id(0)]: 74 }).lesson.id).toBe(id(0));
    expect(selectFoundationLesson(lessons, { [id(0)]: 75 }).lesson.id).toBe(id(1));
  });

  it('para na ultima licao, marcada como concluida, quando tudo esta vencido', () => {
    const escolha = selectFoundationLesson(lessons, masteredUpTo(lessons.length));

    expect(escolha.lesson.id).toBe(id(lessons.length - 1));
    expect(escolha.index).toBe(lessons.length);
    expect(escolha.complete).toBe(true);
  });
});
