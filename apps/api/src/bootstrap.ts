import { INestApplication, ValidationPipe } from '@nestjs/common';
import { json } from 'express';

/**
 * Configuracao aplicada a aplicacao Nest, seja ela servida por um processo
 * proprio (local, `main.ts`) ou por uma funcao serverless (Vercel,
 * `serverless.ts`). Fica num lugar so para os dois ambientes nao divergirem --
 * um prefixo ou um CORS diferente entre eles vira um bug que so aparece em
 * producao.
 */
export function configureApp(app: INestApplication): void {
  // O Speaking Lab manda audio gravado em base64 no corpo da requisicao, e o
  // limite padrao do body parser (100 kb) corta qualquer gravacao real.
  //
  // O teto e 4 MB de proposito: a Vercel recusa corpos acima de 4.5 MB antes
  // mesmo de a funcao rodar, entao aceitar mais aqui so trocaria um erro
  // nosso, explicado, por um 413 opaco da plataforma.
  app.use(json({ limit: '4mb' }));

  app.setGlobalPrefix('api');
  app.enableCors({ origin: corsOrigin(), credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
}

/**
 * Quem pode chamar a API.
 *
 * Com `CORS_ORIGINS` definido, vale exatamente a lista -- e o que voce deve
 * usar em producao, apontando para o dominio do front. Sem ela, liberamos
 * localhost e qualquer `*.vercel.app`, para um deploy novo nao nascer quebrado
 * antes de a variavel ser preenchida.
 *
 * Vale lembrar o que isso protege e o que nao protege: a autenticacao aqui e
 * por Bearer token, nao por cookie, entao o CORS impede uma pagina de terceiros
 * de ler respostas no navegador -- nao substitui o JWT.
 */
export function corsOrigin() {
  const configured = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (configured.length > 0) return configured;

  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Requisicoes sem Origin (curl, health check, app nativo) passam.
    if (!origin) return callback(null, true);

    const allowed =
      /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
      /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);

    callback(null, allowed);
  };
}
