import { describe, expect, it } from 'vitest';
import { parseJsonResponse } from './ai-router.service';

/**
 * Todo recurso que depende de IA passa por aqui. Modelos diferentes embrulham
 * o JSON de formas diferentes, e cada formato que escapa vira um 500 na cara
 * do aluno -- por isso a tolerancia e testada explicitamente.
 */
describe('parseJsonResponse', () => {
  it('le JSON limpo', () => {
    expect(parseJsonResponse('{"ok":true}')).toEqual({ ok: true });
  });

  it('le JSON com espaco em volta', () => {
    expect(parseJsonResponse('\n  {"ok":true}  \n')).toEqual({ ok: true });
  });

  it('desembrulha bloco markdown com a linguagem declarada', () => {
    const raw = '```json\n{"exercises":[]}\n```';
    expect(parseJsonResponse(raw)).toEqual({ exercises: [] });
  });

  it('desembrulha bloco markdown sem linguagem', () => {
    expect(parseJsonResponse('```\n{"ok":1}\n```')).toEqual({ ok: 1 });
  });

  it('recorta o objeto quando o modelo tagarela antes e depois', () => {
    const raw = 'Claro! Segue o resultado:\n{"scores":{"grammar":80}}\nEspero ter ajudado.';
    expect(parseJsonResponse(raw)).toEqual({ scores: { grammar: 80 } });
  });

  it('aceita array no topo', () => {
    expect(parseJsonResponse('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('recorta array embrulhado em prosa', () => {
    expect(parseJsonResponse('Aqui estao: [{"a":1}] pronto')).toEqual([{ a: 1 }]);
  });

  it('lanca com um trecho da resposta quando nao ha JSON nenhum', () => {
    // A mensagem precisa carregar o texto recebido: sem isso, depurar um
    // provider que respondeu prosa vira adivinhacao.
    expect(() => parseJsonResponse('desculpe, nao posso ajudar')).toThrowError(
      /nao e JSON valido: desculpe/,
    );
  });
});
