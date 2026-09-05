import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

/** Servidor local (`npm run dev`). Na Vercel o ponto de entrada e serverless.ts. */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);

  Logger.log(`Raffael 4L API rodando em http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
