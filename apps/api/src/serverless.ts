import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express, Request, Response } from 'express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

/**
 * Ponto de entrada serverless (Vercel).
 *
 * Duas diferencas em relacao ao `main.ts`, e as duas importam:
 *
 * 1. Usa `app.init()` em vez de `app.listen()`. Numa funcao serverless quem
 *    escuta a porta e a plataforma; abrir um servidor aqui trava a invocacao.
 *
 * 2. A aplicacao fica em cache no escopo do modulo. Cada invocacao reaproveita
 *    a instancia enquanto o container estiver quente -- sem isso, todo request
 *    reconstruiria o container do Nest e abriria uma conexao nova no banco, o
 *    que estoura o pool do Neon em poucos acessos simultaneos.
 */
let cached: Promise<Express> | null = null;

async function createServer(): Promise<Express> {
  const expressApp = express();

  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    // Em serverless o log vai para o console da plataforma; manter apenas o
    // que importa evita ruido em cada cold start.
    logger: ['error', 'warn'],
  });

  configureApp(app);
  await app.init();

  return expressApp;
}

function server(): Promise<Express> {
  if (!cached) {
    // Um cold start que falha nao pode envenenar o cache: a proxima invocacao
    // precisa poder tentar de novo.
    cached = createServer().catch((err) => {
      cached = null;
      throw err;
    });
  }
  return cached;
}

export default async function handler(req: Request, res: Response) {
  const app = await server();
  return app(req, res);
}
