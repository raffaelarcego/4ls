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

/**
 * Resposta truncada merece diagnostico proprio.
 *
 * Quando o modelo bate no teto de tokens, o JSON para no meio de uma string e
 * o erro nativo fala de virgula faltando -- quem le vai procurar defeito no
 * prompt, que esta correto. Custou uma investigacao inteira descobrir que o que
 * faltava era `maxTokens`, e a mensagem existe para ninguem repetir o caminho.
 */
describe('parseJsonResponse: resposta truncada', () => {
  it('acusa o teto de tokens quando a string nao fecha', () => {
    const raw = '{"title":"Aula","examples":[{"sentence":"Я студент","translation":"Sou est';

    expect(() => parseJsonResponse(raw)).toThrow(/truncada/i);
    expect(() => parseJsonResponse(raw)).toThrow(/maxTokens/);
  });

  it('acusa quando o objeto abriu e nao fechou', () => {
    expect(() => parseJsonResponse('{"drills":[{"gloss":"oi"}')).toThrow(/truncada/i);
  });

  it('nao confunde chave dentro de string com abertura de objeto', () => {
    // A contagem de profundidade tem de ignorar o que esta entre aspas, senao
    // uma explicacao que cite "{" seria lida como JSON incompleto.
    expect(parseJsonResponse('{"nota":"use { e } com cuidado"}')).toEqual({
      nota: 'use { e } com cuidado',
    });
  });

  it('nao confunde aspas escapadas com fim de string', () => {
    expect(parseJsonResponse('{"frase":"ele disse \\"oi\\" para mim"}')).toEqual({
      frase: 'ele disse "oi" para mim',
    });
  });

  it('segue reclamando de lixo que nao e JSON nem truncamento', () => {
    expect(() => parseJsonResponse('desculpe, nao posso ajudar')).toThrow(/nao e JSON valido/);
  });
});
