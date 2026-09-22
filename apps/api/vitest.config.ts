import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Os testes cobrem os motores puros -- planejador, SRS, deduplicacao de
    // erros e o parser de resposta da IA. Nada aqui toca banco nem rede: sao
    // as regras de negocio que precisam continuar valendo, nao a fiacao.
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    /*
     * O fuso da aplicacao entra antes de qualquer teste.
     *
     * Sem isto os testes rodariam no fuso da maquina de quem chamou `npm test`
     * -- verde no notebook em Brasilia, vermelho no CI em UTC, pela unica razao
     * que nao aparece em lugar nenhum no diff.
     */
    setupFiles: ['./src/common/timezone.ts'],
  },
});
