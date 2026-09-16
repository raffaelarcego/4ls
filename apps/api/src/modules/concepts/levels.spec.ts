import { CefrLevel } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { levelIndex, minLevel } from './concepts.service';

/**
 * O teto de nivel e o que impede um conceito C1 do ingles de virar uma frase
 * russa para quem esta no A1 -- conteudo correto e inutil, e o jeito mais
 * rapido de fazer o aluno largar o idioma mais dificil.
 */
describe('minLevel', () => {
  it('devolve o menor dos dois', () => {
    expect(minLevel('B2', 'A1')).toBe(CefrLevel.A1);
    expect(minLevel('A1', 'B2')).toBe(CefrLevel.A1);
  });

  it('e estavel quando os dois sao iguais', () => {
    expect(minLevel('B1', 'B1')).toBe(CefrLevel.B1);
  });

  it('reduz um perfil inteiro ao idioma mais fraco', () => {
    // O perfil real do produto: B2 em ingles, A2 em espanhol, A1 em alemao e
    // russo. O teto tem de ser A1 -- o conceito do dia serve aos quatro ou nao
    // serve a promessa.
    const perfil = ['B2', 'A2', 'A1', 'A1'];
    const teto = perfil.reduce<string>((lowest, level) => minLevel(lowest, level), 'C2');

    expect(teto).toBe(CefrLevel.A1);
  });

  it('nao deixa um nivel desconhecido escapar para cima', () => {
    // Nivel invalido cai no indice 0 (A1). Conservador de proposito: na duvida,
    // entregar conteudo simples demais e recuperavel; o contrario nao.
    expect(levelIndex('Z9')).toBe(0);
    expect(minLevel('Z9', 'C2')).toBe('Z9');
  });
});

describe('levelIndex', () => {
  it('ordena a escada CEFR', () => {
    expect(levelIndex('A1')).toBeLessThan(levelIndex('A2'));
    expect(levelIndex('A2')).toBeLessThan(levelIndex('B1'));
    expect(levelIndex('B1')).toBeLessThan(levelIndex('B2'));
    expect(levelIndex('B2')).toBeLessThan(levelIndex('C1'));
    expect(levelIndex('C1')).toBeLessThan(levelIndex('C2'));
  });
});
