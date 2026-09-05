import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/**
 * Unica rota sem autenticacao.
 *
 * Existe para responder, de fora, a pergunta que aparece em todo deploy novo:
 * "subiu, e o banco esta respondendo?". Sem ela so daria para testar a API
 * fazendo login, o que mistura dois problemas quando algo esta errado.
 *
 * Nao expoe nada sensivel: nem URL de banco, nem chave, nem contagem de dados.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const startedAt = Date.now();
    let database: 'ok' | 'erro' = 'ok';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'erro';
    }

    return {
      status: database === 'ok' ? 'ok' : 'degradado',
      database,
      // O plano free do Neon suspende o banco quando ocioso: a primeira
      // resposta depois de uma pausa vem lenta, e este numero mostra isso em
      // vez de deixar parecer travamento.
      databaseLatencyMs: Date.now() - startedAt,
      environment: process.env.VERCEL_ENV ?? 'local',
      timestamp: new Date().toISOString(),
    };
  }
}
