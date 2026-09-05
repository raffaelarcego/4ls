/**
 * Funcao serverless da Vercel (projeto unico: site + API no mesmo dominio).
 *
 * JavaScript puro de proposito: o builder da Vercel compila a pasta `api/`
 * com esbuild, que nao emite `emitDecoratorMetadata` -- e sem esses metadados
 * a injecao de dependencia do Nest quebra. O TypeScript e compilado antes pelo
 * `nest build` (tsc, que emite), e aqui so carregamos o resultado.
 */
module.exports = require('../apps/api/dist/src/serverless').default;
