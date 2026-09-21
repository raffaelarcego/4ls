import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  readingPassagePrompt,
  ReadingPassageContext,
  ReadingPassageTarget,
} from '../../infrastructure/ai/prompts';
import { AiRouterService } from '../../infrastructure/ai/ai-router.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  findReadingTopic,
  ReadingLevel,
  ReadingTopic,
  readingTopicId,
  sentenceCountFor,
} from './reading.catalog';
import {
  lowestReadingLevel,
  pickReadingTopic,
  readInLanguages,
  readingCandidates,
  readingTopicIdsFor,
  toReadingRows,
} from './reading.selection';

/** Perguntas de compreensao por versao. */
const QUESTIONS_PER_VERSION = 3;

/** Peso do resultado novo na media movel de dominio. Igual ao dos outros blocos. */
const MASTERY_WEIGHT = 0.3;

/**
 * Quanto do numero de frases pedido o texto precisa entregar para servir.
 *
 * O que nao se negocia e o ALINHAMENTO -- as quatro versoes com o mesmo numero
 * de frases --, nao o numero exato. Um texto que saiu com 7 frases em vez de 8
 * nas quatro versoes ensina igual; recusa-lo jogaria fora a geracao mais cara do
 * modulo por um detalhe que o aluno nunca perceberia.
 */
const MIN_SENTENCE_RATIO = 0.6;

export interface ReadingSentence {
  text: string;
  /** So em russo. */
  romanization?: string | null;
  /** A mesma frase em portugues, para quando ele travar. */
  translation: string;
}

export interface ReadingQuestion {
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface ReadingGlossaryEntry {
  term: string;
  meaning: string;
}

export interface ReadingVersion {
  languageCode: string;
  title: string;
  sentences: ReadingSentence[];
  glossary?: ReadingGlossaryEntry[];
  questions: ReadingQuestion[];
}

interface GeneratedPassage {
  versions: ReadingVersion[];
  contrast: string;
}

/**
 * Leitura paralela: a mesma historia nos quatro idiomas.
 *
 * Este modulo fecha o ultimo buraco grande da especificacao. O bloco de leitura
 * existia no planejador desde o inicio, mas nao tinha texto nenhum -- ele caia
 * nos exercicios gerados, e "compreensao de texto" sem texto e um quiz com
 * outro nome.
 *
 * O que ele entrega nao e "um texto por idioma": e O MESMO texto, alinhado
 * frase a frase, lido uma vez em cada idioma ao longo dos dias. Isso da duas
 * coisas de uma vez -- o andaime do conteudo ja conhecido, que permite ler
 * acima do proprio nivel, e a comparacao frase a frase no ponto exato em que a
 * duvida aparece.
 */
@Injectable()
export class ReadingService {
  private readonly logger = new Logger(ReadingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiRouterService,
  ) {}

  /**
   * O texto de hoje neste idioma.
   *
   * Este caminho NUNCA gera conteudo: so le o que ja esta pronto. Sao quatro
   * versoes de uma historia numa resposta so, com cirilico dentro -- a geracao
   * mais cara do produto junto com a da can-do --, e a funcao na Vercel morre
   * aos 60s. Quem gera e `warm()`, fora do horario de estudo.
   */
  async lesson(userId: string, languageCode: string) {
    const { languages, level } = await this.learner(userId);

    const mine = languages.find((l) => l.code === languageCode);
    if (!mine) {
      throw new NotFoundException(`Voce nao esta estudando o idioma "${languageCode}".`);
    }

    const candidates = readingCandidates(languages.map((l) => l.level));
    if (candidates.length === 0) {
      throw new NotFoundException(`Ainda nao ha texto de leitura para o nivel ${level}.`);
    }

    const rows = await this.progressRows(userId, candidates);
    const topic = pickReadingTopic(candidates, rows, languageCode)!;
    const { versions, contrast } = await this.fromPool(topic, level);

    const version = versions.find((v) => v.languageCode === languageCode);
    if (!version) {
      throw new ServiceUnavailableException(
        `O texto "${topic.title}" foi preparado sem a versao em ${languageCode}.`,
      );
    }

    /*
     * As outras versoes vao junto, e so as frases.
     *
     * Elas sao o bloco inteiro: a tela deixa abrir qualquer frase e ver a mesma
     * frase nos outros tres idiomas, e mandar isso so quando ele tocar custaria
     * uma ida ao servidor no meio da leitura. Sao poucas linhas de texto -- as
     * perguntas e o glossario dos outros idiomas e que ficam de fora, porque
     * ali nao servem a nada.
     */
    const others = versions
      .filter((v) => v.languageCode !== languageCode)
      .map((v) => ({
        languageCode: v.languageCode,
        title: v.title,
        sentences: v.sentences.map((s) => ({
          text: s.text,
          romanization: s.romanization ?? null,
        })),
      }));

    return {
      passageId: topic.id,
      /** O titulo em portugues, do catalogo -- o do idioma vem em `version`. */
      title: topic.title,
      premise: topic.premise,
      focus: topic.focus,
      genre: topic.genre,
      level,
      languageCode,
      languageName: mine.name,
      version,
      others,
      /**
       * Em que idiomas ele ja leu esta historia. E o que a tela usa para dizer
       * "voce ja leu isto em ingles" -- saber que o conteudo e conhecido muda
       * como se entra num texto que parecia impossivel.
       */
      alsoRead: readInLanguages(topic.id, rows).filter((code) => code !== languageCode),
      contrast,
    };
  }

  /**
   * Prepara os textos de que este aluno vai precisar em seguida.
   *
   * Roda fora do horario de estudo (script/cron), onde alguns minutos por texto
   * nao incomodam ninguem. Gera so o que falta: idempotente e de graca quando
   * tudo ja esta preparado.
   *
   * Nao ha "pool de variacoes" aqui, e essa e a diferenca em relacao aos outros
   * blocos: gerar tres versoes do mesmo texto seria trabalhar contra o modulo,
   * que existe justamente para o MESMO texto voltar em outro idioma. A variedade
   * vem do catalogo, nao da repeticao da geracao.
   */
  async warm(userId: string): Promise<number> {
    const { languages, level } = await this.learner(userId).catch(() => ({
      languages: [],
      level: 'A1' as ReadingLevel,
    }));
    if (languages.length === 0) return 0;

    const candidates = readingCandidates(languages.map((l) => l.level));
    if (candidates.length === 0) return 0;

    const rows = await this.progressRows(userId, candidates);

    /*
     * O proximo texto de CADA idioma, sem repetir.
     *
     * A escolha e por idioma -- ele pode estar prestes a ler "A mudanca" em
     * espanhol e "A manha atrasada" em russo --, mas o texto e compartilhado.
     * Deduplicar antes de gerar e o que impede pagar duas vezes pela mesma
     * historia no mesmo dia.
     */
    const wanted = new Map<string, ReadingTopic>();
    for (const language of languages) {
      const topic = pickReadingTopic(candidates, rows, language.code);
      if (topic) wanted.set(topic.id, topic);
    }

    let created = 0;

    for (const topic of wanted.values()) {
      const where = { topicId: topic.id, level };
      const existing = await this.prisma.readingPassage.count({ where });
      if (existing > 0) continue;

      const generated = await this.generate(userId, topic, languages);
      await this.prisma.readingPassage.create({
        data: {
          ...where,
          title: topic.title,
          versions: generated.versions as unknown as object,
          contrast: generated.contrast,
        },
      });
      created += 1;
      this.logger.log(`Texto preparado: ${topic.id}/${level} nos ${languages.length} idiomas.`);
    }

    return created;
  }

  /**
   * Registra a leitura de um texto num idioma.
   *
   * O progresso e por (texto, idioma) porque e exatamente isso que a escolha do
   * dia consulta: ter lido "A mudanca" em ingles nao pode impedir que ela venha
   * em alemao -- e a segunda leitura que da o contraste.
   *
   * A nota vale para a competencia de leitura mesmo na segunda passada, e vale
   * com uma ressalva conhecida: ele chega ja sabendo a historia, e isso ajuda.
   * E deliberado -- e o andaime do modulo --, e por isso as perguntas sao de
   * detalhe e no idioma do texto: sem passar o olho naquela versao, o detalhe
   * nao aparece.
   */
  async record(
    userId: string,
    passageId: string,
    languageCode: string,
    correct: number,
    total: number,
  ) {
    const topic = findReadingTopic(passageId);
    if (!topic) throw new NotFoundException(`Texto "${passageId}" nao existe.`);
    if (total <= 0) throw new NotFoundException('Leitura sem perguntas.');

    const score = Math.round((correct / total) * 100);
    const key = {
      userId_topicId_languageCode: {
        userId,
        topicId: readingTopicId(passageId),
        languageCode,
      },
    };

    const current = await this.prisma.grammarProgress.findUnique({ where: key });
    const mastery = current
      ? current.mastery * (1 - MASTERY_WEIGHT) + score * MASTERY_WEIGHT
      : score;

    const saved = await this.prisma.grammarProgress.upsert({
      where: key,
      create: {
        userId,
        topicId: readingTopicId(passageId),
        languageCode,
        mastery,
        attempts: total,
        correct,
      },
      update: {
        mastery,
        attempts: { increment: total },
        correct: { increment: correct },
        lastStudiedAt: new Date(),
      },
    });

    return { score, mastery: Math.round(saved.mastery) };
  }

  /** Os idiomas matriculados e o nivel-teto que eles impoem ao texto do dia. */
  private async learner(userId: string) {
    const userLanguages = await this.prisma.userLanguage.findMany({
      where: { userId },
      include: { language: true },
      orderBy: { priority: 'asc' },
    });

    if (userLanguages.length === 0) {
      throw new NotFoundException('Voce ainda nao esta estudando nenhum idioma.');
    }

    const languages = userLanguages.map((ul) => ({
      code: ul.language.code,
      name: ul.language.name,
      level: ul.currentLevel as string,
    }));

    return { languages, level: lowestReadingLevel(languages.map((l) => l.level)) };
  }

  private async progressRows(userId: string, candidates: ReadingTopic[]) {
    const rows = await this.prisma.grammarProgress.findMany({
      where: { userId, topicId: { in: readingTopicIdsFor(candidates) } },
    });
    return toReadingRows(rows);
  }

  private async fromPool(topic: ReadingTopic, level: string) {
    const reused = await this.prisma.readingPassage.findFirst({
      where: { topicId: topic.id, level },
      orderBy: [{ timesUsed: 'asc' }, { lastUsedAt: 'asc' }],
    });

    if (!reused) {
      throw new ServiceUnavailableException(
        `O texto "${topic.title}" nos quatro idiomas ainda não foi preparado. ` +
          'Rode "npm run content:warm -w @4l/api" para gerá-lo.',
      );
    }

    await this.prisma.readingPassage
      .update({
        where: { id: reused.id },
        data: { timesUsed: { increment: 1 }, lastUsedAt: new Date() },
      })
      .catch(() => undefined);

    return {
      versions: (reused.versions ?? []) as unknown as ReadingVersion[],
      contrast: reused.contrast,
    };
  }

  private async generate(
    userId: string,
    topic: ReadingTopic,
    languages: Array<{ code: string; name: string; level: string }>,
  ): Promise<GeneratedPassage> {
    const targets: ReadingPassageTarget[] = languages.map((l) => ({
      code: l.code,
      name: l.name,
      level: l.level,
    }));

    const ctx: ReadingPassageContext = {
      title: topic.title,
      premise: topic.premise,
      focus: topic.focus,
      genre: topic.genre,
      targets,
    };

    const expected = sentenceCountFor(topic.level);

    const result = await this.ai.chatJson<GeneratedPassage>({
      task: 'reading.generate',
      json: true,
      userId,
      /*
       * O teto mais alto do produto, e com folga. A aula de can-do pede tres
       * frases em quatro idiomas; aqui sao ate dez frases em quatro idiomas,
       * cada uma com traducao, mais glossario e tres perguntas por versao. O
       * russo custa perto do dobro por caractere, porque o cirilico rende menos
       * caractere por token. Com teto curto o JSON chega truncado e o erro fala
       * de sintaxe, escondendo que o problema era tamanho.
       */
      maxTokens: 20000,
      messages: [
        { role: 'user', content: readingPassagePrompt(ctx, expected, QUESTIONS_PER_VERSION) },
      ],
    });

    const codes = languages.map((l) => l.code);
    const versions = (result.versions ?? []).filter((v) => usableVersion(v, expected));

    if (!alignedPassage(versions, codes, expected)) {
      throw new Error(
        `O texto "${topic.id}" nao voltou alinhado nos ${codes.length} idiomas -- descartado.`,
      );
    }

    return {
      versions,
      contrast: result.contrast?.trim() || topic.focus,
    };
  }
}

/**
 * Uma versao so serve se ela for um texto inteiro, com o que a tela precisa.
 *
 * A validacao e severa pela mesma razao da can-do: o texto entra num pool e e
 * lido quatro vezes, uma por idioma. Um defeito que passe aqui nao aparece uma
 * vez -- aparece em todas as leituras daquela historia, por meses.
 */
export function usableVersion(version: ReadingVersion | undefined, expected: number): boolean {
  if (!version?.languageCode?.trim()) return false;
  if (!version.title?.trim()) return false;

  if (!Array.isArray(version.sentences)) return false;
  if (version.sentences.length < Math.ceil(expected * MIN_SENTENCE_RATIO)) return false;
  if (version.sentences.some((s) => !s?.text?.trim() || !s?.translation?.trim())) return false;

  // Sem pergunta nao ha nota, e o bloco voltaria a ser autoavaliado -- que e
  // exatamente o que ele deixou de ser.
  if (!Array.isArray(version.questions) || version.questions.length === 0) return false;

  return version.questions.every(
    (q) =>
      q?.prompt?.trim() &&
      Array.isArray(q.options) &&
      q.options.length >= 2 &&
      q.options.every((o) => typeof o === 'string' && o.trim()) &&
      typeof q.answer === 'string' &&
      q.options.includes(q.answer),
  );
}

/**
 * O conjunto so ensina se as versoes estiverem ALINHADAS.
 *
 * Esta e a validacao que define o modulo. A tela deixa abrir qualquer frase e
 * ver a mesma frase nos outros tres idiomas, e ela faz isso pelo INDICE -- e o
 * unico jeito, porque nao ha como casar frases de linguas diferentes de outra
 * forma. Se uma versao juntou duas frases numa, todas as frases dali para a
 * frente passam a exibir a correspondencia errada, com a mesma aparencia de
 * certo. Um texto desalinhado nao e "quase bom": ele ensina que a frase alema
 * diz o que ela nao diz.
 */
export function alignedPassage(
  versions: ReadingVersion[],
  codes: string[],
  expected: number,
): boolean {
  if (versions.length === 0) return false;

  const byCode = new Map(versions.map((v) => [v.languageCode, v]));
  if (!codes.every((code) => byCode.has(code))) return false;

  const counts = codes.map((code) => byCode.get(code)!.sentences.length);
  if (counts.some((count) => count !== counts[0])) return false;

  return counts[0] >= Math.ceil(expected * MIN_SENTENCE_RATIO);
}
