import { Injectable } from '@nestjs/common';
import { ErrorCategory } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { isLang, LANG_NAME, topicsFor } from '../grammar/contrast-catalog';

export interface ExtractedError {
  category: ErrorCategory;
  description: string;
  explanation?: string;
  severity?: number;
  /**
   * Codigo do idioma de onde veio a interferencia, quando houve.
   * "pt" para a lingua materna. Undefined ou null quando o erro nao foi de
   * interferencia -- que e a maioria dos casos.
   */
  sourceLanguage?: string | null;
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
    const sourceLanguageId = await this.resolveSource(error.sourceLanguage, languageId);

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
          // A origem so e gravada quando esta ocorrencia trouxe uma. Um erro que
          // ja foi identificado como interferencia do espanhol nao deixa de ser
          // por o modelo nao ter arriscado o palpite desta vez.
          ...(sourceLanguageId ? { sourceLanguageId } : {}),
        },
      });
    }

    return this.prisma.errorRecord.create({
      data: {
        userId,
        languageId,
        sourceLanguageId,
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

  /**
   * Traduz o codigo de origem devolvido pelo modelo em um id de idioma.
   *
   * Devolve null diante de qualquer coisa que nao seja um idioma real e
   * DIFERENTE do idioma do erro. Os dois descartes sao por casos observados: o
   * modelo as vezes devolve o proprio idioma da frase como origem (o que nao
   * significa nada -- interferencia de si mesmo nao existe) e as vezes devolve
   * um nome por extenso ou um codigo inventado. Guardar qualquer um dos dois
   * sujaria o unico dado que da valor a este campo.
   */
  private async resolveSource(
    code: string | null | undefined,
    languageId: string,
  ): Promise<string | null> {
    if (!code || !isLang(code)) return null;

    const language = await this.prisma.language.findUnique({ where: { code } });
    // O portugues nao esta na tabela de idiomas (e a lingua materna, nao um
    // curso), entao interferencia do portugues fica sem id -- e e o caso mais
    // comum de todos. Ela continua visivel na explicacao do erro.
    if (!language || language.id === languageId) return null;

    return language.id;
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

  /**
   * Os pares de idiomas que mais se atrapalham, com o que estudar para cada um.
   *
   * E o fecho do ciclo que o produto vinha prometendo pela metade: o erro
   * aponta o par, o catalogo de contrastes ja tem o topico daquele par, e o
   * aluno recebe o link direto para ele. Antes, "8 erros de ordem das palavras"
   * era um numero que nao dizia o que fazer a respeito.
   */
  async interference(userId: string, limit = 5) {
    const rows = await this.prisma.errorRecord.groupBy({
      by: ['languageId', 'sourceLanguageId', 'category'],
      where: { userId, resolved: false, sourceLanguageId: { not: null } },
      _sum: { occurrenceCount: true },
      orderBy: { _sum: { occurrenceCount: 'desc' } },
      take: 20,
    });

    if (rows.length === 0) return [];

    const languages = await this.prisma.language.findMany();
    const byId = new Map(languages.map((l) => [l.id, l]));

    /** Um par (alvo <- origem) agrega as categorias em que ele se manifesta. */
    const pairs = new Map<
      string,
      {
        languageCode: string;
        languageName: string;
        sourceCode: string;
        sourceName: string;
        occurrences: number;
        categories: string[];
      }
    >();

    for (const row of rows) {
      const target = byId.get(row.languageId);
      const source = row.sourceLanguageId ? byId.get(row.sourceLanguageId) : null;
      if (!target || !source) continue;

      const key = `${target.code}<${source.code}`;
      const entry = pairs.get(key) ?? {
        languageCode: target.code,
        languageName: target.name,
        sourceCode: source.code,
        sourceName: source.name,
        occurrences: 0,
        categories: [],
      };

      entry.occurrences += row._sum.occurrenceCount ?? 0;
      if (!entry.categories.includes(row.category)) entry.categories.push(row.category);
      pairs.set(key, entry);
    }

    return [...pairs.values()]
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit)
      .map((pair) => ({
        ...pair,
        /*
         * Os topicos sugeridos sao os do idioma ALVO em que a origem cai do
         * outro lado da particao -- ou seja, exatamente onde os dois idiomas
         * divergem. Sugerir um topico em que eles concordam seria mandar o
         * aluno estudar a semelhanca que nao o atrapalha.
         */
        topics: suggestedTopics(pair.languageCode, pair.sourceCode),
      }));
  }

  async resolve(userId: string, errorId: string) {
    return this.prisma.errorRecord.updateMany({
      where: { id: errorId, userId },
      data: { resolved: true },
    });
  }
}

/**
 * Topicos do catalogo em que `target` e `source` se comportam de forma
 * DIFERENTE -- os unicos que explicam uma interferencia entre os dois.
 */
export function suggestedTopics(
  target: string,
  source: string,
): Array<{ id: string; title: string; question: string }> {
  if (!isLang(target) || !isLang(source)) return [];

  return topicsFor(target)
    .filter((topic) => {
      const own = topic.groups.find((group) => group.includes(target));
      // Fora do grupo do alvo = resolve o ponto de outro jeito = e daqui que a
      // interferencia pode ter vindo.
      return Boolean(own) && !own!.includes(source);
    })
    .slice(0, 3)
    .map((topic) => ({ id: topic.id, title: topic.title, question: topic.question }));
}

/** Nome do idioma para as mensagens de interferencia. */
export function languageLabel(code: string): string {
  return isLang(code) ? LANG_NAME[code] : code;
}
