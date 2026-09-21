import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AttemptScore, scoreAttempt, usableSentence } from './shadowing.scoring';

/** Frases por rodada. */
const ROUND_SIZE = 6;

export interface ShadowingSentence {
  text: string;
  /** A mesma frase em portugues -- ele repete sabendo o que esta dizendo. */
  translation: string;
  romanization?: string | null;
  /** De onde a frase veio, para a tela dizer. */
  source: 'cando' | 'reading' | 'structure';
}

interface StoredRealization {
  languageCode: string;
  sentence: string;
  romanization?: string | null;
}

interface StoredCanDoSentence {
  gloss: string;
  realizations?: StoredRealization[];
}

interface StoredReadingVersion {
  languageCode: string;
  sentences?: Array<{ text: string; romanization?: string | null; translation: string }>;
}

interface StoredPatternExample {
  sentence: string;
  translation: string;
}

/**
 * Shadowing: ouvir e repetir em voz alta, na hora.
 *
 * O Speaking Lab ja existia e mede outra coisa: ele da uma missao, o aluno fala
 * o que quiser e a IA avalia gramatica, vocabulario e cumprimento da missao.
 * Isso mede PRODUCAO. O que nao havia era treino de ritmo e de encadeamento --
 * pegar uma frase pronta, dita por uma voz nativa, e devolve-la inteira sem
 * montar nada. E o exercicio mais antigo que existe para soltar a lingua, e o
 * unico que ataca a distancia entre "eu sei a frase" e "eu consigo dizer a
 * frase".
 *
 * Duas coisas fazem este bloco ser barato de um jeito que nenhum outro e:
 *
 * - AS FRASES JA EXISTEM. Saem das can-dos, dos textos e das aulas de estrutura
 *   que ele ja estudou. Nao ha geracao, nao ha IA, e o audio quase sempre ja
 *   esta no cache de voz -- porque sao as mesmas frases que ele ja ouviu.
 * - A CORRECAO E DETERMINISTICA. Comparar o que ele falou com uma frase
 *   CONHECIDA e alinhamento de texto, nao julgamento. O Speaking Lab precisa de
 *   IA porque a frase e livre; aqui o gabarito e a propria frase.
 */
@Injectable()
export class ShadowingService {
  private readonly logger = new Logger(ShadowingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * As frases de hoje num idioma.
   *
   * Saem do conteudo que ele JA viu, e isso nao e economia: shadowing de frase
   * nova vira decifracao -- ele gasta a atencao entendendo, e sobra nada para o
   * ritmo, que e o que o bloco treina. Frase conhecida libera a cabeca para
   * imitar.
   */
  async lesson(userId: string, languageCode: string) {
    const userLanguage = await this.prisma.userLanguage.findFirst({
      where: { userId, language: { code: languageCode } },
      include: { language: true },
    });
    if (!userLanguage) {
      throw new NotFoundException(`Voce nao esta estudando o idioma "${languageCode}".`);
    }

    const sentences = await this.collect(languageCode);

    if (sentences.length === 0) {
      throw new ServiceUnavailableException(
        `Ainda nao ha frase estudada em ${userLanguage.language.name} para repetir. ` +
          'Rode "npm run content:warm -w @4l/api" ou faça uma sessão neste idioma primeiro.',
      );
    }

    return {
      languageCode,
      languageName: userLanguage.language.name,
      level: userLanguage.currentLevel as string,
      sentences: sentences.slice(0, ROUND_SIZE),
    };
  }

  /**
   * Corrige uma repeticao.
   *
   * Nao grava nada: a nota do bloco e o que move a competencia de fala, e quem
   * a grava e o `StudyService` ao concluir a atividade, como em todos os outros
   * blocos. Esta rota existe para a regra de alinhamento morar num lugar so --
   * e um lugar onde ela tem teste.
   */
  attempt(target: string, transcript: string): AttemptScore {
    if (!target?.trim()) throw new NotFoundException('Frase vazia.');
    return scoreAttempt(target, transcript ?? '');
  }

  /**
   * Junta frases de todo conteudo ja preparado, sem repetir.
   *
   * A ordem das fontes e a ordem em que elas servem ao shadowing: a can-do e a
   * frase mais curta e mais falada do produto, a leitura da variedade e a
   * estrutura traz a frase-modelo da regra do dia.
   */
  private async collect(languageCode: string): Promise<ShadowingSentence[]> {
    const out: ShadowingSentence[] = [];
    const seen = new Set<string>();

    const add = (sentence: ShadowingSentence) => {
      if (!usableSentence(sentence.text)) return;
      const key = sentence.text.trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(sentence);
    };

    const [canDos, passages, patterns] = await Promise.all([
      this.prisma.canDoLesson.findMany({ orderBy: { lastUsedAt: 'desc' }, take: 12 }),
      this.prisma.readingPassage.findMany({ orderBy: { lastUsedAt: 'desc' }, take: 6 }),
      this.prisma.sentencePattern.findMany({
        where: { languageCode },
        orderBy: { lastUsedAt: 'desc' },
        take: 6,
      }),
    ]);

    for (const lesson of canDos) {
      for (const sentence of (lesson.sentences ?? []) as unknown as StoredCanDoSentence[]) {
        const realization = (sentence.realizations ?? []).find(
          (r) => r.languageCode === languageCode,
        );
        if (!realization) continue;
        add({
          text: realization.sentence,
          translation: sentence.gloss,
          romanization: realization.romanization ?? null,
          source: 'cando',
        });
      }
    }

    for (const passage of passages) {
      const version = ((passage.versions ?? []) as unknown as StoredReadingVersion[]).find(
        (v) => v.languageCode === languageCode,
      );
      for (const sentence of version?.sentences ?? []) {
        add({
          text: sentence.text,
          translation: sentence.translation,
          romanization: sentence.romanization ?? null,
          source: 'reading',
        });
      }
    }

    for (const pattern of patterns) {
      for (const example of (pattern.examples ?? []) as unknown as StoredPatternExample[]) {
        add({
          text: example.sentence,
          translation: example.translation,
          source: 'structure',
        });
      }
    }

    return shuffle(out);
  }
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
