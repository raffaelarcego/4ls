import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AnswerOption } from '../../components/AnswerOption';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter, SkipButton } from '../../components/LessonFooter';
import { ProgressBar } from '../../components/ProgressBar';
import { SentenceBuilder } from '../../components/SentenceBuilder';
import { api, errorMessage } from '../../services/api';
import {
  FoundationLesson,
  FoundationPiece,
  FoundationSentence,
  SessionActivity,
} from '../../types';

/**
 * Bloco de fundamentos.
 *
 * O alfabeto ensinou a LER; este ensina a MONTAR. Eram os dois degraus que
 * faltavam antes de qualquer aula de verdade, e o aluno descreveu a falta do
 * segundo com precisao: nao daria para aprender ingles sem antes saber o que e
 * o verbo to be. Em alemao e em russo ele nao tinha nem o pronome, nem o verbo,
 * nem a ordem -- e a aula de estrutura ja pressupoe os tres.
 *
 * Tres fases, a mesma escada do alfabeto:
 *
 * 1. AS PECAS, uma por tela, com o que cada uma exige e o portugues nao exige.
 * 2. A FRASE, montada e ROTULADA: cada pedaco aparece sob o seu papel em
 *    portugues (QUEM / SER / O QUE). E a tabela de montagem das can-dos, so que
 *    com as pecas que a licao acabou de dar.
 * 3. TREINO, gerado aqui mesmo a partir da aula -- sem IA, sem outra chamada.
 *
 * O exercicio que define o bloco e o de ORDENAR os pedacos. Reconhecer o
 * significado de "nicht" nao prova nada sobre saber onde ele entra, e "onde
 * entra" e a unica pergunta que o aluno realmente tem.
 */
export function FoundationRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const [phase, setPhase] = useState<'pieces' | 'sentences' | 'drills' | null>(null);

  const lesson = useQuery<FoundationLesson>({
    queryKey: ['foundation', 'lesson', activity.languageCode],
    queryFn: async () => {
      const { data } = await api.get('/foundation/lesson', {
        params: { language: activity.languageCode },
      });
      return data;
    },
    retry: false,
  });

  if (lesson.isPending) {
    return (
      <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
        <p className="font-serif text-lg font-semibold text-eel">Separando as peças de hoje...</p>
        <p className="max-w-sm text-sm text-wolf">
          Poucas por vez, e só frases que dá para montar com elas.
        </p>
      </div>
    );
  }

  if (lesson.isError || !lesson.data) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <p className="font-serif text-lg font-semibold text-eel">Não consegui abrir a aula</p>
          <p className="max-w-sm text-sm text-wolf">{errorMessage(lesson.error)}</p>
        </div>
        <LessonFooter tone="wrong">
          <SkipButton onSkip={onSkip} />
          <button className="btn-primary px-8" onClick={() => lesson.refetch()}>
            Tentar de novo
          </button>
        </LessonFooter>
      </>
    );
  }

  /*
   * A fase inicial depende do modo, e por isso ela so e decidida DEPOIS de a
   * licao chegar -- dai o `null` como estado inicial.
   *
   * Numa revisao a tela abre direto no treino: reapresentar as pecas e as
   * frases de uma licao que ja esta em 80% e pedir ao aluno que releia o que
   * ele sabe antes de provar que sabe, e esse e o caminho mais curto para ele
   * passar a pular o bloco. Ele ainda pode voltar as pecas pelo rodape se
   * travar em alguma.
   */
  const current = phase ?? (lesson.data.mode === 'review' ? 'drills' : 'pieces');

  if (current === 'drills') {
    return (
      <Practice
        lesson={lesson.data}
        onFinish={onFinish}
        onSkip={onSkip}
        onBack={() => setPhase('pieces')}
      />
    );
  }

  if (current === 'sentences') {
    return (
      <Sentences
        lesson={lesson.data}
        onContinue={() => setPhase('drills')}
        onBack={() => setPhase('pieces')}
      />
    );
  }

  return <Pieces lesson={lesson.data} onContinue={() => setPhase('sentences')} onSkip={onSkip} />;
}

/** Cabecalho comum as tres fases: onde ele esta dentro da trilha inteira. */
function LessonHeader({ lesson, step }: { lesson: FoundationLesson; step: string }) {
  return (
    <div>
      <p className="font-mono text-xs text-hare">
        Fundamentos, lição {lesson.index} de {lesson.total}, {step}
      </p>
      <h2 className="font-serif text-xl font-semibold leading-tight text-eel">{lesson.title}</h2>
    </div>
  );
}

/**
 * A regra de montagem.
 *
 * Com destaque proprio porque e o texto que o aluno NAO consegue deduzir olhando
 * as pecas -- e porque e o unico da tela que nomeia o erro que ele vai cometer.
 */
function RuleNote({ rule }: { rule: string }) {
  return (
    <div className="rounded-md border border-macaw bg-macaw-soft px-4 py-3">
      <p className="section-title mb-1 text-macaw-dark">A regra</p>
      <p className="text-sm leading-relaxed text-macaw-dark">{rule}</p>
    </div>
  );
}

/** Mesma moldura de erro do alfabeto: ela precisa contradizer o olho e ganhar. */
function TrapNote({ trap }: { trap: string }) {
  return (
    <div className="rounded-md border border-cardinal bg-cardinal-soft px-4 py-3">
      <p className="section-title mb-1 text-cardinal-dark">Cuidado: não é o que parece</p>
      <p className="text-sm leading-relaxed text-cardinal-dark">{trap}</p>
    </div>
  );
}

/** Fase 1 -- uma peca por tela. */
function Pieces({
  lesson,
  onContinue,
  onSkip,
}: {
  lesson: FoundationLesson;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const [index, setIndex] = useState(0);
  const piece = lesson.pieces[index];
  const last = index >= lesson.pieces.length - 1;

  if (!piece) {
    return (
      <>
        <div className="card flex min-h-[12rem] flex-col items-center justify-center gap-2 text-center">
          <p className="font-serif text-lg font-semibold text-eel">Esta lição veio sem peças</p>
          <p className="max-w-sm text-sm text-wolf">{lesson.goal}</p>
        </div>
        <LessonFooter>
          <SkipButton onSkip={onSkip} />
          <button className="btn-primary px-8" onClick={onContinue}>
            Ver as frases
          </button>
        </LessonFooter>
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <LessonHeader lesson={lesson} step="as peças" />
        <p className="text-sm leading-relaxed text-wolf">{lesson.goal}</p>

        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={lesson.pieces.length} size="sm" tone="bg-macaw" />
          <span className="shrink-0 font-mono text-xs text-hare">
            {index + 1}/{lesson.pieces.length}
          </span>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <p
              lang={lesson.languageCode}
              className="min-w-0 flex-1 break-words font-serif text-4xl leading-tight text-eel"
            >
              {piece.term}
            </p>
            <AudioButton text={piece.term} languageCode={lesson.languageCode} />
          </div>

          <div className="space-y-1 border-t border-swan pt-3">
            <p className="font-mono text-sm text-macaw-dark">{piece.reading}</p>
            <p className="font-serif text-lg font-semibold text-eel">{piece.meaning}</p>
          </div>

          {piece.note && <p className="text-sm leading-relaxed text-wolf">{piece.note}</p>}
          {piece.trap && <TrapNote trap={piece.trap} />}
        </div>
      </div>

      <LessonFooter detail={last ? 'Agora veja essas peças virarem frase.' : undefined}>
        {index > 0 ? (
          <button className="btn-plain" onClick={() => setIndex((i) => i - 1)}>
            Voltar
          </button>
        ) : (
          <SkipButton onSkip={onSkip} />
        )}
        <button
          className="btn-primary flex-1 px-10 sm:flex-none"
          onClick={() => (last ? onContinue() : setIndex((i) => i + 1))}
        >
          {last ? 'Montar frases' : 'Próxima peça'}
        </button>
      </LessonFooter>
    </>
  );
}

/**
 * Fase 2 -- as frases, quebradas nos seus papeis.
 *
 * O significado em portugues comeca escondido, pela mesma razao das palavras do
 * alfabeto: se aparecesse junto, o olho leria o portugues primeiro e a frase
 * estrangeira viraria enfeite. Os ROTULOS, ao contrario, ficam sempre a vista --
 * eles nao entregam a resposta, eles sao a aula.
 */
function Sentences({
  lesson,
  onContinue,
  onBack,
}: {
  lesson: FoundationLesson;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [revealed, setRevealed] = useState<string[]>([]);

  return (
    <>
      <div className="space-y-4">
        <LessonHeader lesson={lesson} step="a frase" />
        <RuleNote rule={lesson.rule} />

        {lesson.sentences.length === 0 && (
          <div className="card text-center text-sm text-wolf">
            Esta lição não trouxe frases para montar.
          </div>
        )}

        {lesson.sentences.map((sentence) => (
          <SentenceCard
            key={sentence.text}
            sentence={sentence}
            languageCode={lesson.languageCode}
            open={revealed.includes(sentence.text)}
            onReveal={() => setRevealed((r) => [...r, sentence.text])}
          />
        ))}
      </div>

      <LessonFooter detail="Depois vem o treino, com as peças fora de ordem.">
        <button className="btn-plain" onClick={onBack}>
          Ver peças
        </button>
        <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={onContinue}>
          Treinar
        </button>
      </LessonFooter>
    </>
  );
}

function SentenceCard({
  sentence,
  languageCode,
  open,
  onReveal,
}: {
  sentence: FoundationSentence;
  languageCode: string;
  open: boolean;
  onReveal: () => void;
}) {
  return (
    <div className="card space-y-3">
      <div className="flex items-start gap-3">
        {/* Os pedacos quebram em varias linhas no celular, e cada um carrega o
            proprio rotulo -- e isso que faz a ORDEM ficar visivel. */}
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-x-2 gap-y-2">
          {sentence.parts.map((part, i) => (
            <div key={`${part.chunk}-${i}`} className="min-w-0">
              <p className="font-mono text-[10px] uppercase leading-tight text-hare">
                {part.label}
              </p>
              <p
                lang={languageCode}
                className="break-words font-serif text-2xl leading-tight text-eel"
              >
                {part.chunk}
              </p>
            </div>
          ))}
        </div>
        <AudioButton text={sentence.text} languageCode={languageCode} />
      </div>

      {open ? (
        <div className="space-y-1 border-t border-swan pt-3">
          <p className="font-mono text-sm text-macaw-dark">{sentence.reading}</p>
          <p className="font-serif text-lg font-semibold text-eel">{sentence.meaning}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={onReveal}
          className="tap-target w-full rounded-md border border-swan bg-snow px-4 py-3 text-sm text-wolf transition-colors"
        >
          Mostrar leitura e significado
        </button>
      )}
    </div>
  );
}

/** Pergunta de alternativa: reconhecer a peca. */
interface ChoiceDrill {
  kind: 'choice';
  id: string;
  question: string;
  /** A peca em foco, quando o enunciado aponta uma. */
  subject?: string;
  options: string[];
  answer: string;
  /** Alternativas no idioma estudado precisam de `lang` proprio. */
  optionsAreForeign: boolean;
  explanation: string;
}

/** O exercicio que define o bloco: pôr os pedacos na ordem do idioma. */
interface BuildDrill {
  kind: 'build';
  id: string;
  /** O que ele tem que dizer, em portugues. */
  meaning: string;
  /** Os pedacos embaralhados, com o papel de cada um. */
  chunks: { chunk: string; label: string }[];
  /** A ordem certa, ja juntada. */
  answer: string;
  text: string;
  explanation: string;
}

type Drill = ChoiceDrill | BuildDrill;

/**
 * Gera o treino a partir da propria aula.
 *
 * Tres decisoes, as mesmas do alfabeto por tras de conteudo diferente:
 *
 * - TODA FRASE DA LICAO VIRA UM EXERCICIO DE MONTAGEM, e eles vem primeiro.
 *   Reconhecer o significado da peca e mais facil e nao prova nada sobre a
 *   ordem; se a montagem dependesse de sorteio, a licao poderia terminar sem
 *   cobrar a unica coisa que ela veio ensinar.
 * - Os distratores saem das pecas desta licao e das anteriores (`review`),
 *   nunca de um dicionario aleatorio: alternativa implausivel se elimina
 *   sozinha e o acerto deixa de significar alguma coisa.
 * - O sorteio e semeado pelo `lessonId`, entao o treino e o mesmo entre renders
 *   (senao as alternativas dancam sob o dedo) e repetir a licao amanha traz o
 *   mesmo conjunto, que e o que se quer para consolidar.
 */
function buildDrills(lesson: FoundationLesson): Drill[] {
  const rand = seededRandom(lesson.lessonId);
  const pool = [...lesson.pieces, ...lesson.review];

  const pick = <T,>(items: T[], count: number): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, count);
  };

  const shuffle = <T,>(items: T[]): T[] => pick(items, items.length);

  /** "O que quer dizer `nicht`?" -- da peca para o significado. */
  const meaningDrill = (piece: FoundationPiece): ChoiceDrill | null => {
    const others = pool.filter((p) => p.term !== piece.term && p.meaning !== piece.meaning);
    const distractors = dedupe(pick(others, 3).map((p) => p.meaning), piece.meaning);
    if (distractors.length === 0) return null;
    return {
      kind: 'choice',
      id: `meaning-${piece.term}`,
      question: 'O que isto quer dizer?',
      subject: piece.term,
      options: shuffle([piece.meaning, ...distractors]),
      answer: piece.meaning,
      optionsAreForeign: false,
      explanation: piece.trap ?? piece.note ?? `${piece.term} = ${piece.meaning}.`,
    };
  };

  /** O caminho inverso: do significado para a peca. */
  const termDrill = (piece: FoundationPiece): ChoiceDrill | null => {
    const others = pool.filter((p) => p.term !== piece.term);
    const distractors = dedupe(pick(others, 3).map((p) => p.term), piece.term);
    if (distractors.length === 0) return null;
    return {
      kind: 'choice',
      id: `term-${piece.term}`,
      question: `Como se diz "${piece.meaning}"?`,
      options: shuffle([piece.term, ...distractors]),
      answer: piece.term,
      optionsAreForeign: true,
      explanation: piece.trap ?? `${piece.meaning} = ${piece.term} (${piece.reading}).`,
    };
  };

  const buildDrill = (sentence: FoundationSentence): BuildDrill | null => {
    // Frase de um pedaco so nao tem ordem para testar.
    if (sentence.parts.length < 2) return null;
    return {
      kind: 'build',
      id: `build-${sentence.text}`,
      meaning: sentence.meaning,
      chunks: shuffle(sentence.parts),
      answer: sentence.parts.map((p) => p.chunk).join(' '),
      text: sentence.text,
      explanation: `${sentence.text} — ${sentence.reading}`,
    };
  };

  const montagens = lesson.sentences.map(buildDrill).filter(isDrill);
  const traps = lesson.pieces.filter((p) => p.trap);
  const plain = lesson.pieces.filter((p) => !p.trap);

  // Montagem primeiro, depois as armadilhas: as duas coisas que a licao nao
  // pode terminar sem cobrar.
  const required = [...montagens.slice(0, 4), ...traps.map(meaningDrill).filter(isDrill)];

  // Alterna os dois sentidos no preenchimento: duas perguntas seguidas do mesmo
  // formato viram padrao de resposta, nao conhecimento.
  const filler = interleave(
    shuffle(plain).map(termDrill).filter(isDrill),
    shuffle(lesson.pieces).map(meaningDrill).filter(isDrill),
  );

  const chosen = [...required];
  for (const drill of filler) {
    if (chosen.length >= 8) break;
    if (!chosen.some((d) => d.id === drill.id)) chosen.push(drill);
  }
  // Com poucas pecas novas o preenchimento acaba antes do minimo; ai as pecas ja
  // vistas voltam como revisao, que e o efeito desejado de qualquer forma.
  for (const piece of shuffle(lesson.review)) {
    if (chosen.length >= 5) break;
    const drill = meaningDrill(piece);
    if (drill && !chosen.some((d) => d.id === drill.id)) chosen.push(drill);
  }

  // As montagens ficam na frente mesmo depois do embaralhamento do resto: sao a
  // aula, e o aluno pode fechar o bloco antes do fim.
  const montagensEscolhidas = chosen.filter((d) => d.kind === 'build');
  const resto = shuffle(chosen.filter((d) => d.kind !== 'build'));
  return [...montagensEscolhidas, ...resto];
}

function isDrill<T>(drill: T | null): drill is T {
  return drill !== null;
}

/** Alternativas repetidas entregam a resposta por eliminacao. */
function dedupe(values: string[], answer: string): string[] {
  const seen = new Set([answer]);
  return values.filter((value) => (seen.has(value) ? false : (seen.add(value), true)));
}

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

/** Gerador determinístico (mulberry32) semeado por uma string. */
function seededRandom(seed: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash |= 0;
    hash = (hash + 0x6d2b79f5) | 0;
    let t = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fase 3 -- o treino. */
function Practice({
  lesson,
  onFinish,
  onSkip,
  onBack,
}: {
  lesson: FoundationLesson;
  onFinish: (score: number) => void;
  onSkip: () => void;
  /** Volta as pecas. Na revisao e a unica porta para reler a licao. */
  onBack: () => void;
}) {
  const isReview = lesson.mode === 'review';
  const drills = useMemo(() => buildDrills(lesson), [lesson]);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<boolean | null>(null);
  const [correct, setCorrect] = useState(0);

  const record = useMutation({
    mutationFn: async (r: { correct: number; total: number }) => {
      const { data } = await api.post('/foundation/record', {
        lessonId: lesson.lessonId,
        languageCode: lesson.languageCode,
        correct: r.correct,
        total: r.total,
      });
      return data;
    },
  });

  const drill = drills[index];

  if (drills.length === 0) {
    return (
      <>
        <div className="card flex min-h-[12rem] flex-col items-center justify-center gap-2 text-center">
          <p className="font-serif text-lg font-semibold text-eel">Lição vista</p>
          <p className="max-w-sm text-sm text-wolf">
            Não deu para montar o treino com o material desta lição.
          </p>
        </div>
        <LessonFooter>
          <button className="btn-primary px-8" onClick={() => onFinish(70)}>
            Concluir
          </button>
        </LessonFooter>
      </>
    );
  }

  if (!drill) {
    const score = Math.round((correct / drills.length) * 100);
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <p className="font-mono text-3xl text-eel">
            {correct}/{drills.length}
          </p>
          <p className="font-serif text-lg font-semibold text-eel">frases e peças certas</p>
          <p className="max-w-sm text-sm text-wolf">
            {score >= 75
              ? isReview
                ? 'Continua firme. Ela volta daqui a uns dez dias.'
                : 'Estas peças já podem aparecer em frases novas.'
              : isReview
                ? 'Esta lição escorregou — ela volta inteira amanhã, com as peças.'
                : 'Esta lição volta amanhã, antes de qualquer peça nova.'}
          </p>
        </div>
        <LessonFooter tone={score >= 75 ? 'correct' : 'neutral'} title={`${score}% de acerto`}>
          <button
            className="btn-primary px-8"
            onClick={() => {
              // Quem escolhe a proxima licao e o progresso gravado; se a
              // gravacao falhar, o bloco ainda fecha e credita o XP.
              record.mutate({ correct, total: drills.length });
              onFinish(score);
            }}
          >
            Continuar
          </button>
        </LessonFooter>
      </>
    );
  }

  function next() {
    if (result) setCorrect((c) => c + 1);
    setResult(null);
    setIndex((i) => i + 1);
  }

  return (
    <>
      <div className="space-y-4">
        {isReview && (
          <div>
            <p className="font-mono text-xs text-hare">
              Revisão · Fundamentos, lição {lesson.index} de {lesson.total}
            </p>
            <h2 className="font-serif text-xl font-semibold leading-tight text-eel">
              {lesson.title}
            </h2>
          </div>
        )}

        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={drills.length} size="sm" tone="bg-macaw" />
          <span className="shrink-0 font-mono text-xs text-hare">
            {index + 1}/{drills.length}
          </span>
        </div>

        {drill.kind === 'build' ? (
          <SentenceBuilder
            key={drill.id}
            prompt={drill.meaning}
            chunks={drill.chunks.map((c) => ({ text: c.chunk, label: c.label }))}
            answer={drill.answer}
            languageCode={lesson.languageCode}
            answered={result !== null}
            onAnswer={setResult}
            // Aqui os rotulos FICAM: nos Fundamentos o exercicio ensina qual
            // papel ocupa qual posicao. Na prova mensal eles somem, porque la
            // ele mede.
            showLabels
          />
        ) : (
          <ChoiceExercise
            key={drill.id}
            drill={drill}
            languageCode={lesson.languageCode}
            answered={result !== null}
            onAnswer={setResult}
          />
        )}
      </div>

      {result !== null ? (
        <LessonFooter
          tone={result ? 'correct' : 'wrong'}
          title={result ? 'Isso mesmo' : `É "${drill.kind === 'build' ? drill.text : drill.answer}"`}
          detail={drill.explanation}
        >
          <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={next}>
            Continuar
          </button>
        </LessonFooter>
      ) : (
        <LessonFooter>
          {/* Na revisao a tela abriu direto no treino, entao esta e a unica
              porta para rever as pecas de quem travou numa delas. */}
          {isReview ? (
            <button className="btn-plain" onClick={onBack}>
              Ver peças
            </button>
          ) : (
            <SkipButton onSkip={onSkip} />
          )}
        </LessonFooter>
      )}
    </>
  );
}

function ChoiceExercise({
  drill,
  languageCode,
  answered,
  onAnswer,
}: {
  drill: ChoiceDrill;
  languageCode: string;
  answered: boolean;
  onAnswer: (correct: boolean) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <>
      <div className="space-y-2">
        <p className="font-serif text-lg font-semibold leading-snug text-eel">{drill.question}</p>
        {drill.subject && (
          <div className="flex items-center gap-3">
            <p
              lang={languageCode}
              className="min-w-0 flex-1 break-words font-serif text-4xl leading-tight text-eel"
            >
              {drill.subject}
            </p>
            <AudioButton text={drill.subject} languageCode={languageCode} />
          </div>
        )}
      </div>

      <div className="grid gap-2">
        {drill.options.map((option) => {
          const state = !answered
            ? 'idle'
            : option === drill.answer
              ? 'correct'
              : option === chosen
                ? 'wrong'
                : 'idle';

          return (
            <AnswerOption
              key={option}
              state={state}
              disabled={answered}
              lang={drill.optionsAreForeign ? languageCode : 'pt-BR'}
              // Escolher ja corrige: o toque em "Verificar" nunca decidiu nada.
              onClick={() => {
                if (answered) return;
                setChosen(option);
                onAnswer(option === drill.answer);
              }}
            >
              <span className={drill.optionsAreForeign ? 'font-serif text-xl' : ''}>{option}</span>
            </AnswerOption>
          );
        })}
      </div>
    </>
  );
}
