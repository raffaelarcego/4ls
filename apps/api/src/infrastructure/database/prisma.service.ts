import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Conecta na subida, mas **nao derruba a aplicacao se falhar**.
   *
   * O motivo e a combinacao serverless + Neon no plano free: o banco hiberna
   * quando ocioso, e um cold start pode pegar exatamente essa janela. Com o
   * `$connect()` propagando o erro, o Nest abortava o init inteiro e *todas*
   * as rotas passavam a responder 500 -- inclusive as que nem tocam no banco,
   * como o /api/health, que existe justamente para diagnosticar isso.
   *
   * O Prisma conecta sozinho na primeira query, entao adiar so custa alguns
   * milissegundos na primeira requisicao. O que se ganha e a aplicacao subir
   * e conseguir dizer o que esta errado.
   */
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      const [firstLine] = (err as Error).message.split('\n');
      this.logger.warn(
        `Banco indisponivel na subida (${firstLine}). A aplicacao segue no ar e o ` +
          'Prisma tentara conectar na primeira query.',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect().catch(() => undefined);
  }
}
