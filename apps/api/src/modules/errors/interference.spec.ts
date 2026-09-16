import { describe, expect, it } from 'vitest';
import { CONTRAST_TOPICS } from '../grammar/contrast-catalog';
import { suggestedTopics } from './errors.service';

/**
 * A sugestao de topico so vale se ela apontar onde os dois idiomas DIVERGEM.
 * Mandar o aluno estudar um ponto em que eles concordam seria o pior dos dois
 * mundos: ele gastaria a sessao confirmando a semelhanca que nunca o atrapalhou
 * e sairia achando que o modulo nao entende o problema dele.
 */
describe('suggestedTopics', () => {
  it('sugere apenas topicos em que os dois idiomas se comportam diferente', () => {
    for (const topic of suggestedTopics('de', 'ru')) {
      const full = CONTRAST_TOPICS.find((t) => t.id === topic.id)!;
      const group = full.groups.find((g) => g.includes('de'))!;

      expect(group, `${topic.id}: alemao e russo no mesmo grupo`).not.toContain('ru');
    }
  });

  it('nao sugere nada para um par que se comporta igual no unico topico comum', () => {
    // Alemao e russo concordam nos casos: quem estuda os dois nao erra ali por
    // interferencia de um no outro, entao o topico nao pode aparecer.
    const ids = suggestedTopics('de', 'ru').map((t) => t.id);

    expect(ids).not.toContain('cases');
  });

  it('acha o ponto certo quando o portugues e a origem', () => {
    // "I have thirty years" vem direto do portugues, e have-age e exatamente o
    // topico em que ingles e portugues divergem.
    const ids = suggestedTopics('en', 'pt').map((t) => t.id);

    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const topic = CONTRAST_TOPICS.find((t) => t.id === id)!;
      const group = topic.groups.find((g) => g.includes('en'))!;
      expect(group, `${id}`).not.toContain('pt');
    }
  });

  it('devolve no maximo tres, para a tela nao virar um catalogo', () => {
    expect(suggestedTopics('de', 'pt').length).toBeLessThanOrEqual(3);
  });

  it('ignora codigo que nao e idioma conhecido', () => {
    expect(suggestedTopics('de', 'xx')).toEqual([]);
    expect(suggestedTopics('xx', 'de')).toEqual([]);
  });

  it('nunca sugere topico que nao tem o alvo como alvo de estudo', () => {
    // O topico dos casos nao se aplica ao espanhol; sugeri-lo abriria uma tela
    // que o proprio GrammarService recusa a servir.
    for (const topic of suggestedTopics('es', 'pt')) {
      const full = CONTRAST_TOPICS.find((t) => t.id === topic.id)!;
      expect(full.targets, topic.id).toContain('es');
    }
  });
});
