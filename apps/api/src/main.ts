import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // O Speaking Lab manda audio gravado em base64 no corpo da requisicao, e o
  // limite padrao do body parser (100 kb) corta qualquer gravacao real.
  app.use(json({ limit: '12mb' }));

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);

  Logger.log(`Raffael 4L API rodando em http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
