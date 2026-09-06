import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AiRouterService } from '../../infrastructure/ai/ai-router.service';
import { contrastDrillPrompt, ContrastContext } from '../../infrastructure/ai/prompts';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  ContrastTopic,
  findTopic,
  Lang,
  LANG_NAME,
  supportFor,
  topicsFor,
} from './contrast-catalog';

/**
 * Quantos conjuntos de exercicios distintos manter por (topico, idioma, nivel)
 * antes de comecar a reaproveitar. Quatro ja evita que o aluno reconheca as
 * frases de cor, e custa quatro geracoes uma unica vez -- mesma logica do pool
 * de dialogos de listening.
 */
const DRILL_POOL_TARGET = 4;

/** Quantos exercicios a IA gera por conjunto. */
const DRILLS_PER_SET = 6;

/**
 * Peso do resultado novo na media movel de dominio.
 *
 * 0.3 e lento o bastante para uma rodada sortuda nao declarar o ponto vencido,
 * e rapido o bastante para que melhorar de verdade apareca em 3 ou 4 sessoes.
 */
const MASTERY_WEIGHT = 0.3;

export type DrillType = 'mirror' | 'trap' | 'align';

export interface Drill {
  type: DrillType;
  gloss: string;
  /** Versoes da frase em outros idiomas, ja visiveis para o aluno. */
  shown: Array<{ lang: Lang; text: string }>;
  sentence: string;
  answer: string;
  explanation: string;
  /** So em "align": as alternativas fechadas. */
  options?: string[];
}

interface GeneratedDrills {
  drills: Drill[];
}

@Injectable()
export class GrammarService {
  private readonly logger = new Logger(GrammarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiRouterService,
  ) {}

  /**
   * Lista os contrastes de um idioma, ja com o progresso do aluno e com quem
   * apoia e quem contrasta em cada um.
   */
  async list(userId: string, target: Lang) {
    const topics = topicsFor(target);
    const progress = await this.prisma.grammarProgress.findMany({
      where: { userId, languageCode: target, topicId: { in: topics.map((t) => t.id) } },
    });
    const byTopic = new Map(progress.map((p) => [p.topicId, p]));

    return {
      languageCode: target,
      topics: topics.map((topic) => {
        const support = supportFor(topic, target);
        const seen = byTopic.get(topic.id);
        return {
          id: topic.id,
          title: topic.title,
          question: topic.question,
          level: topic.level,
          ally: support.ally,
          allyName: support.ally ? LANG_NAME[support.ally] : null,
          contrast: support.contrast,
          contrastName: support.contrast ? LANG_NAME[support.contrast] : null,
          mastery: seen?.mastery ?? 0,
          attempts: seen?.attempts ?? 0,
          flagged: seen?.flagged ?? false,
        };
      }),
    };
  }

  /** A explicacao contrastiva de um topico: a tabela de comparacao. */
  async detail(userId: string, topicId: string, target: Lang) {
    const topic = this.requireTopic(topicId, target);
    const support = supportFor(topic, target);

    const progress = await this.prisma.grammarProgress.findUnique({
      where: { userId_topicId_languageCode: { userId, topicId, languageCode: target } },
    });

    /*
     * A ordem das colunas nao e alfabetica nem fixa: alvo primeiro, depois
     * quem confirma, depois quem contrasta, e o portugues por ultimo. E a
     * ordem em que a comparacao faz sentido ser lida.
     */
    const order: Lang[] = [target];
    if (support.ally) order.push(support.ally);
    if (support.contrast) order.push(support.contrast);
    for (const lang of ['pt', 'en', 'es', 'de'] as Lang[]) {
      if (!order.includes(lang)) order.push(lang);
    }

    return {
      id: topic.id,
      title: topic.title,
      question: topic.question,
      level: topic.level,
      languageCode: target,
      ally: support.ally,
      contrast: support.contrast,
      bridge: topic.bridge ?? null,
      trap: topic.trap ?? null,
      columns: order.map((lang) => ({
        lang,
        name: LANG_NAME[lang],
        isTarget: lang === target,
        role: lang === support.ally ? 'ally' : lang === support.contrast ? 'contrast' : null,
        behavior: topic.behavior[lang],
      })),
      examples: topic.examples.map((example) => ({
        gloss: example.gloss,
        note: example.note ?? null,
        cells: order.map((lang) => ({ lang, text: example[lang] })),
      })),
      mastery: progress?.mastery ?? 0,
      attempts: progress?.attempts ?? 0,
      flagged: progress?.flagged ?? false,
    };
  }

  /**
   * Exercicios do topico. Vem do pool quando ele ja esta cheio; so gera com IA
   * enquanto o pool nao encheu.
   */
  async drills(userId: string, topicId: string, target: Lang, fresh = false) {
    const topic = this.requireTopic(topicId, target);
    const where = { topicId, languageCode: target, level: topic.level };

    if (!fresh) {
      const pool = await this.prisma.grammarDrillSet.count({ where });
      if (pool >= DRILL_POOL_TARGET) {
        // O menos usado primeiro: mantem o rodizio parelho em vez de martelar
        // sempre o mesmo conjunto.
        const reused = await this.prisma.grammarDrillSet.findFirst({
          where,
          orderBy: [{ timesUsed: 'asc' }, { lastUsedAt: 'asc' }],
        });
        if (reused) {
          await this.prisma.grammarDrillSet
            .update({
              where: { id: reused.id },
              data: { timesUsed: { increment: 1 }, lastUsedAt: new Date() },
            })
            .catch(() => undefined);
          return this.withAlignment(topic, target, reused.drills as unknown as Drill[]);
        }
      }
    }

    const generated = await this.generate(userId, topic, target);
    const stored = await this.prisma.grammarDrillSet.create({
      data: { ...where, drills: generated as unknown as object },
    });
    this.logger.log(`Novo conjunto de exercicios para ${topicId}/${target} (${stored.id}).`);
    return this.withAlignment(topic, target, generated);
  }

  private async generate(userId: string, topic: ContrastTopic, target: Lang): Promise<Drill[]> {
    const support = supportFor(topic, target);
    const involved: Lang[] = [target];
    if (support.ally) involved.push(support.ally);
    if (support.contrast) involved.push(support.contrast);
    if (!involved.includes('pt')) involved.push('pt');

    const ctx: ContrastContext = {
      title: topic.title,
      question: topic.question,
      level: topic.level,
      targetName: LANG_NAME[target],
      allyName: support.ally ? LANG_NAME[support.ally] : null,
      contrastName: LANG_NAME[support.contrast ?? 'pt'],
      behavior: involved.map((lang) => `- ${LANG_NAME[lang]}: ${topic.behavior[lang]}`).join('\n'),
      examples: topic.examples
        .map((e) => involved.map((lang) => `${lang}: ${e[lang]}`).join(' | '))
        .join('\n'),
    };

    const result = await this.ai.chatJson<GeneratedDrills>({
      task: 'grammar.drill',
      json: true,
      userId,
      language: target,
      messages: [{ role: 'user', content: contrastDrillPrompt(ctx, DRILLS_PER_SET) }],
    });

    const drills = (result.drills ?? [])
      .filter((d): d is Drill => usable(d))
      .map((d) => ({ ...d, shown: Array.isArray(d.shown) ? d.shown : [] }));

    if (drills.length === 0) {
      throw new Error('A IA nao devolveu nenhum exercicio utilizavel.');
    }

    const discarded = (result.drills ?? []).length - drills.length;
    if (discarded > 0) {
      this.logger.warn(
        `${discarded} de ${result.drills.length} exercicios descartados em ${topic.id}/${target}.`,
      );
    }

    return drills;
  }

  /**
   * Prefixa o conjunto com um exercicio de alinhamento montado a partir do
   * proprio catalogo.
   *
   * Ele nao passa pela IA de proposito: a resposta e o `groups` do catalogo,
   * entao e impossivel sair errada. E e o exercicio que ensina o mapa em si --
   * "quem se parece com quem" --, que e o que o aluno precisa carregar para
   * fora deste topico.
   */
  private withAlignment(topic: ContrastTopic, target: Lang, drills: Drill[]): Drill[] {
    const support = supportFor(topic, target);
    if (!support.contrast) return drills;

    const targetName = LANG_NAME[target];
    const options = (['pt', 'en', 'es', 'de'] as Lang[])
      .filter((l) => l !== target)
      .map((l) => LANG_NAME[l]);

    const alignment: Drill = support.ally
      ? {
          type: 'align',
          gloss: topic.title,
          shown: [],
          sentence: `Neste ponto, qual idioma funciona como o ${targetName}?`,
          answer: LANG_NAME[support.ally],
          options,
          explanation: `${LANG_NAME[support.ally]} e ${targetName} resolvem isto do mesmo jeito. Ja o ${LANG_NAME[support.contrast]} faz diferente — e daí que vem a confusão.`,
        }
      : {
          type: 'align',
          gloss: topic.title,
          shown: [],
          sentence: `Neste ponto, qual idioma funciona como o ${targetName}?`,
          answer: 'Nenhum deles',
          options: [...options, 'Nenhum deles'],
          explanation: `O ${targetName} está sozinho neste tópico: nenhum dos outros três resolve assim. ${topic.bridge ?? ''}`.trim(),
        };

    return [alignment, ...drills];
  }

  /**
   * Registra o resultado de uma rodada e devolve o dominio atualizado.
   *
   * A media movel mede tendencia, nao a ultima rodada: o que interessa saber e
   * se o ponto firmou, e nao se o aluno teve um dia bom.
   */
  async record(userId: string, topicId: string, target: Lang, correct: number, total: number) {
    this.requireTopic(topicId, target);
    if (total <= 0) throw new NotFoundException('Rodada sem exercicios.');

    const score = Math.round((correct / total) * 100);
    const key = { userId_topicId_languageCode: { userId, topicId, languageCode: target } };
    const current = await this.prisma.grammarProgress.findUnique({ where: key });

    const mastery = current
      ? current.mastery * (1 - MASTERY_WEIGHT) + score * MASTERY_WEIGHT
      : score;

    const saved = await this.prisma.grammarProgress.upsert({
      where: key,
      create: {
        userId,
        topicId,
        languageCode: target,
        mastery,
        attempts: total,
        correct,
      },
      update: {
        mastery,
        attempts: { increment: total },
        correct: { increment: correct },
        lastStudiedAt: new Date(),
        // Acertar quase tudo resolve a duvida que motivou a marcacao.
        ...(mastery >= 80 ? { flagged: false } : {}),
      },
    });

    return { score, mastery: Math.round(saved.mastery), flagged: saved.flagged };
  }

  /** Marca ou desmarca um topico como "isso ainda me confunde". */
  async flag(userId: string, topicId: string, target: Lang, flagged: boolean) {
    this.requireTopic(topicId, target);
    const saved = await this.prisma.grammarProgress.upsert({
      where: { userId_topicId_languageCode: { userId, topicId, languageCode: target } },
      create: { userId, topicId, languageCode: target, flagged },
      update: { flagged },
    });
    return { flagged: saved.flagged };
  }

  private requireTopic(topicId: string, target: Lang): ContrastTopic {
    const topic = findTopic(topicId);
    if (!topic) throw new NotFoundException(`Topico "${topicId}" nao existe.`);
    if (!topic.targets.includes(target)) {
      throw new NotFoundException(`O topico "${topicId}" nao se aplica ao ${LANG_NAME[target]}.`);
    }
    return topic;
  }
}

/**
 * Descarta exercicios defeituosos antes de eles entrarem no pool.
 *
 * Isto nao e paranoia: nos testes o modelo entregou um "trap" cuja frase ja
 * estava correta (pergunta e resposta identicas, impossivel errar) e um
 * "mirror" sem lacuna nenhuma. Como o pool e guardado e reaproveitado por
 * meses, um exercicio torto que passe aqui e repetido muitas vezes -- vale
 * mais gerar de novo do que ensinar errado.
 *
 * A checagem e estrutural de proposito. Se a frase do trap esta de fato errada
 * em alemao, so outro modelo saberia dizer; mas que ela precisa ser DIFERENTE
 * da resposta, isso da para garantir aqui.
 */
function usable(drill: Drill | undefined): boolean {
  if (!drill?.sentence?.trim() || !drill.answer?.trim() || !drill.explanation?.trim()) {
    return false;
  }
  if (drill.type !== 'mirror' && drill.type !== 'trap') return false;

  const sentence = drill.sentence.trim().toLowerCase();
  const answer = drill.answer.trim().toLowerCase();

  if (drill.type === 'mirror') {
    // Sem lacuna nao ha o que completar, e a resposta nao pode ser a frase
    // inteira: em "mirror" ela e so o trecho que preenche o vazio.
    return drill.sentence.includes('___') && answer !== sentence;
  }

  // Em "trap" a frase apresentada tem de ser diferente da corrigida -- senao o
  // aluno "acerta" copiando o enunciado.
  return answer !== sentence && !drill.sentence.includes('___');
}
