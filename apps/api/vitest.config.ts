import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Os testes cobrem os motores puros -- planejador, SRS, deduplicacao de
    // erros e o parser de resposta da IA. Nada aqui toca banco nem rede: sao
    // as regras de negocio que precisam continuar valendo, nao a fiacao.
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
