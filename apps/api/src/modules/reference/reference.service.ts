import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { alphabetTopicId } from '../alphabet/cyrillic.catalog';
import { flatEntries, REFERENCES, referenceFor } from './reference.catalog';

/**
 * O material de consulta.
 *
 * Nao grava nada e nao pontua: e a tabela na parede, nao um bloco de estudo.
 * A unica coisa que ele le do banco e o progresso JA existente da trilha, e so
 * para a tela poder marcar o que o aluno ja passou -- sem isso a pagina de 33
 * letras chega igual para quem esta na licao 1 e para quem fechou o alfabeto.
 */
@Injectable()
export class ReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Os idiomas do aluno que tem material de consulta. */
  async available(userId: string) {
    const enrolled = await this.prisma.userLanguage.findMany({
      where: { userId },
      include: { language: true },
      orderBy: { priority: 'asc' },
    });

    return enrolled
      .filter((ul) => REFERENCES[ul.language.code])
      .map((ul) => ({
        code: ul.language.code,
        name: ul.language.name,
        title: referenceFor(ul.language.code)!.title,
      }));
  }

  async get(userId: string, languageCode: string) {
    const reference = referenceFor(languageCode);
    if (!reference) {
      throw new NotFoundException(`O idioma "${languageCode}" não tem material de consulta.`);
    }

    /*
     * O dominio por secao so existe onde a secao corresponde a uma licao da
     * trilha -- hoje, so no cirilico. No alemao as secoes sao agrupamentos de
     * regra de leitura, que ninguem "vence": elas se consultam.
     */
    const rows = await this.prisma.grammarProgress.findMany({
      where: {
        userId,
        languageCode,
        topicId: { in: reference.sections.map((s) => alphabetTopicId(s.id)) },
      },
      select: { topicId: true, mastery: true },
    });

    const mastery = Object.fromEntries(
      rows.map((r) => [r.topicId.replace(/^alphabet:/, ''), Math.round(r.mastery)]),
    );

    return {
      ...reference,
      sections: reference.sections.map((section) => ({
        ...section,
        /** 0-100, ou null quando a secao nao e uma lição da trilha. */
        mastery: mastery[section.id] ?? null,
      })),
      /** Tudo numa lista só, para a tela poder ordenar. */
      all: flatEntries(reference),
    };
  }
}
