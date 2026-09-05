/**
 * Funcao serverless da Vercel.
 *
 * De proposito e JavaScript puro, e nao TypeScript: o builder da Vercel
 * compila arquivos em `api/` com esbuild, que nao emite `emitDecoratorMetadata`
 * -- e sem esses metadados a injecao de dependencia do Nest quebra. Entao o
 * TypeScript e compilado antes pelo `nest build` (que usa o tsc e emite os
 * metadados) e aqui so carregamos o resultado.
 */
module.exports = require('../dist/src/serverless').default;
