import { describe, expect, it } from 'vitest';
import { conceptSlug } from './concepts.service';

/**
 * O slug e o que decide se dois termos sao o MESMO conceito -- e e disso que
 * depende a regra central do produto. Se "o trabalho" e "trabalho" gerarem
 * slugs diferentes, "work" e "Arbeit" viram dois conceitos paralelos e o aluno
 * volta a aprender palavra solta em cada idioma.
 */
describe('conceptSlug', () => {
  it('normaliza acento, caixa e espaco', () => {
    expect(conceptSlug('Com Frequência')).toBe('com-frequencia');
  });

  it('junta a mesma palavra com e sem artigo', () => {
    expect(conceptSlug('o trabalho')).toBe(conceptSlug('trabalho'));
    expect(conceptSlug('a casa')).toBe('casa');
    expect(conceptSlug('uma semana')).toBe('semana');
  });

  it('descarta o parentese explicativo', () => {
    // O parentese carrega aviso de construcao ("pede dativo", "falso
    // cognato"), nao o significado -- e ele varia de idioma para idioma.
    // Mante-lo separaria em dois conceitos o que e um so.
    expect(conceptSlug('o copo (falso cognato: nao e vaso de flores)')).toBe('copo');
    expect(conceptSlug('sentir falta de (pede dativo)')).toBe(conceptSlug('sentir falta de'));
  });

  it('nao deixa hifen sobrando nas pontas', () => {
    expect(conceptSlug('  ja!  ')).toBe('ja');
    expect(conceptSlug('(so o aviso) valer a pena')).toBe('valer-a-pena');
  });

  it('nao funde significados diferentes', () => {
    expect(conceptSlug('o trabalho')).not.toBe(conceptSlug('o trabalhador'));
  });

  it('corta significados longos sem quebrar a chave', () => {
    const slug = conceptSlug('a'.repeat(200));

    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });
});
