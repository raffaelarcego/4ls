import { Injectable } from '@nestjs/common';
import { ErrorCategory } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface ExtractedError {
  category: ErrorCategory;
  description: string;
  explanation?: string;
  severity?: number;
}

/**
 * Categorias em que a palavra especifica importa mais que a categoria.
 * "Confundiu 'actually' com 'atualmente'" e um erro daquele termo, nao um
 * balde generico de vocabulario.
 */
const TERM_SPECIFIC = new Set<ErrorCategory>([
  ErrorCategory.VOCABULARY,
  ErrorCategory.FALSE_COGNATE,
]);

/**
 * Como procurar o erro aberto que representa o mesmo problema.
 *
 * Extraido do service para poder ser testado sem banco: e a regra que decide
 * se duas ocorrencias sao "o mesmo erro", e ela e o coracao do Error
 * Intelligence -- se errar, ou a contagem nunca acumula, ou erros diferentes
 * viram um so.
 */
export function dedupeFilter(error: ExtractedError): Record<string, unknown> {
  if (!TERM_SPECIFIC.has(error.category)) {
    // Categoria basta: o modelo reformula a descricao a cada chamada, entao
    // casar por texto criaria uma linha nova toda vez.
    return {};
  }

  // Casa pelo termo entre aspas na descricao, quando houver.
  const term = error.description.match(/["'](.+?)["']/)?.[1];
  return term
    ? { description: { contains: term, mode: 'insensitive' as const } }
    : { description: error.description };
}

/**
 * Error Intelligence: todo erro relevante vira um dado do perfil do usuario.
 * Erros iguais nao criam linhas novas -- incrementam occurrenceCount, que e o
 * que revela padroes ("ordem das palavras: 8 ocorrencias").
 */
@Injectable()
export class ErrorsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    userId: string,
    languageId: string,
    error: ExtractedError,
    context: { source: string; userText?: string; correctedText?: string },
  ) {
    const existing = await this.findOpenMatch(userId, languageId, error);

    if (existing) {
      return this.prisma.errorRecord.update({
        where: { id: existing.id },
        data: {
          occurrenceCount: { increment: 1 },
          lastOccurrence: new Date(),
          // Guarda a formulacao mais recente e o exemplo mais recente.
          description: error.description,
          explanation: error.explanation ?? existing.explanation,
          severity: Math.max(existing.severity, error.severity ?? 2),
          userText: context.userText ?? existing.userText,
          correctedText: context.correctedText ?? existing.correctedText,
        },
      });
    }

    return this.prisma.errorRecord.create({
      data: {
        userId,
        languageId,
        category: error.category,
        description: error.description,
        explanation: error.explanation,
        severity: error.severity ?? 2,
        source: context.source,
        userText: context.userText,
        correctedText: context.correctedText,
      },
    });
  }

  /** Encontra o erro aberto que representa o mesmo problema. */
  private async findOpenMatch(userId: string, languageId: string, error: ExtractedError) {
    return this.prisma.errorRecord.findFirst({
      where: {
        userId,
        languageId,
        category: error.category,
        resolved: false,
        ...dedupeFilter(error),
      },
      orderBy: { lastOccurrence: 'desc' },
    });
  }

  async recordMany(
    userId: string,
    languageId: string,
    errors: ExtractedError[],
    context: { source: string; userText?: string; correctedText?: string },
  ) {
    for (const error of errors) {
      await this.record(userId, languageId, error, context);
    }
  }

  /** Erros abertos de um idioma, do mais recorrente ao menos. */
  async top(userId: string, languageCode: string, limit = 5) {
    return this.prisma.errorRecord.findMany({
      where: { userId, resolved: false, language: { code: languageCode } },
      orderBy: [{ occurrenceCount: 'desc' }, { severity: 'desc' }],
      take: limit,
    });
  }

  /** Resumo textual dos erros, para injetar nos prompts. */
  async summaryForPrompt(userId: string, languageCode: string): Promise<string[]> {
    const errors = await this.top(userId, languageCode, 5);
    return errors.map((e) => `${e.category}: ${e.description} (${e.occurrenceCount}x)`);
  }

  /** Agrupamento por categoria, usado no dashboard de analytics. */
  async byCategory(userId: string, languageCode?: string) {
    const rows = await this.prisma.errorRecord.groupBy({
      by: ['category'],
      where: {
        userId,
        resolved: false,
        ...(languageCode ? { language: { code: languageCode } } : {}),
      },
      _sum: { occurrenceCount: true },
      orderBy: { _sum: { occurrenceCount: 'desc' } },
    });
    return rows.map((r) => ({
      category: r.category,
      occurrences: r._sum.occurrenceCount ?? 0,
    }));
  }

  async resolve(userId: string, errorId: string) {
    return this.prisma.errorRecord.updateMany({
      where: { id: errorId, userId },
      data: { resolved: true },
    });
  }
}
