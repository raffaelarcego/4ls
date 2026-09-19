import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AnswerOption } from '../../components/AnswerOption';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter, SkipButton } from '../../components/LessonFooter';
import { ProgressBar } from '../../components/ProgressBar';
import { api, errorMessage } from '../../services/api';
import { AlphabetLesson, AlphabetLetter, AlphabetWord, SessionActivity } from '../../types';

/**
 * Bloco de alfabeto.
 *
 * Todo o resto do app assume que ele CONSEGUE LER o que aparece na tela. Em
 * russo isso era falso: ele via a palavra, ouvia o audio e decorava o desenho
 * dela -- entao acertava o exercicio sem ter lido nada, e nada transferia para
 * a palavra seguinte. Este bloco existe para desfazer exatamente isso.
 *
 * Tres fases, nesta ordem e sem atalho entre elas:
 *
 * 1. AS LETRAS, uma por tela. O glifo precisa ser grande de verdade -- o que
 *    se aprende aqui e a forma, e forma pequena vira mancha.
 * 2. LER DE VERDADE: palavras que so usam letras ja ensinadas. E a primeira
 *    vez que ele decodifica em vez de reconhecer.
 * 3. TREINO, gerado aqui mesmo a partir da aula (sem IA, sem outra chamada).
 *
 * As armadilhas (letras que parecem latinas e soam diferente) atravessam as
 * tres fases: destaque proprio na fase 1 e drill obrigatorio na fase 3. Elas
 * sao o erro que ele comete com confianca, e erro confiante nao se corrige
 * sozinho com exposicao.
 */
export function AlphabetRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const [phase, setPhase] = useState<'letters' | 'words' | 'drills'>('letters');

  const lesson = useQuery<AlphabetLesson>({
    queryKey: ['alphabet', 'lesson', activity.languageCode],
    queryFn: async () => {
      const { data } = await api.get('/alphabet/lesson', {
        params: { language: activity.languageCode },
      });
      return data;
    },
    retry: false,
  });

  if (lesson.isPending) {
    return (
      <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
        <p className="font-serif text-lg font-semibold text-eel">Separando as letras de hoje...</p>
        <p className="max-w-sm text-sm text-wolf">
          Poucas por vez, e só palavras que dá para ler com elas.
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

  if (phase === 'drills') {
    return <Practice lesson={lesson.data} onFinish={onFinish} onSkip={onSkip} />;
  }

  if (phase === 'words') {
    return (
      <Reading
        lesson={lesson.data}
        onContinue={() => setPhase('drills')}
        onBack={() => setPhase('letters')}
      />
    );
  }

  return <Letters lesson={lesson.data} onContinue={() => setPhase('words')} onSkip={onSkip} />;
}

/** Cabecalho comum as tres fases: onde ele esta dentro do alfabeto inteiro. */
function LessonHeader({ lesson, step }: { lesson: AlphabetLesson; step: string }) {
  return (
    <div>
      <p className="font-mono text-xs text-hare">
        Alfabeto, lição {lesson.index} de {lesson.total},{' '}
        {step}
      </p>
      <h2 className="font-serif text-xl font-semibold leading-tight text-eel">{lesson.title}</h2>
    </div>
  );
}

/**
 * O aviso de armadilha. Fica com a moldura e a cor de erro de propósito: ele
 * precisa competir com o glifo grande e ganhar, porque e a unica coisa da tela
 * que contradiz o que os olhos dele ja concluiram sozinhos.
 */
function TrapNote({ trap }: { trap: string }) {
  return (
    <div className="rounded-md border border-cardinal bg-cardinal-soft px-4 py-3">
      <p className="section-title mb-1 text-cardinal-dark">Cuidado: não é a letra que parece</p>
      <p className="text-sm leading-relaxed text-cardinal-dark">{trap}</p>
    </div>
  );
}

/** Fase 1 -- uma letra por tela, glifo grande. */
function Letters({
  lesson,
  onContinue,
  onSkip,
}: {
  lesson: AlphabetLesson;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const [index, setIndex] = useState(0);
  const letter = lesson.letters[index];
  const last = index >= lesson.letters.length - 1;

  // Uma palavra da aula que contenha a letra. E o unico audio honesto possivel
  // aqui: TTS lendo um caractere solto fala o NOME da letra, ou nada.
  const example = useMemo(
    () => (letter ? lesson.words.find((w) => w.word.toLowerCase().includes(letter.lower)) : undefined),
    [letter, lesson.words],
  );

  if (!letter) {
    return (
      <>
        <div className="card flex min-h-[12rem] flex-col items-center justify-center gap-2 text-center">
          <p className="font-serif text-lg font-semibold text-eel">Esta lição veio sem letras</p>
          <p className="max-w-sm text-sm text-wolf">{lesson.goal}</p>
        </div>
        <LessonFooter>
          <SkipButton onSkip={onSkip} />
          <button className="btn-primary px-8" onClick={onContinue}>
            Ver as palavras
          </button>
        </LessonFooter>
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <LessonHeader lesson={lesson} step="as letras" />
        <p className="text-sm leading-relaxed text-wolf">{lesson.goal}</p>

        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={lesson.letters.length} size="sm" tone="bg-macaw" />
          <span className="shrink-0 font-mono text-xs text-hare">
            {index + 1}/{lesson.letters.length}
          </span>
        </div>

        <div className="card space-y-4">
          <p
            lang={lesson.languageCode}
            className="text-center font-serif text-7xl leading-none text-eel"
          >
            {letter.upper} {letter.lower}
          </p>

          <div className="space-y-1 text-center">
            <p className="font-serif text-lg font-semibold text-eel">{letter.name}</p>
            <p className="text-base text-wolf">{letter.sound}</p>
          </div>

          {letter.trap && <TrapNote trap={letter.trap} />}

          {example && (
            <div className="flex items-center gap-3 border-t border-swan pt-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-hare">Onde ela aparece</p>
                <p lang={lesson.languageCode} className="font-serif text-2xl text-eel">
                  {example.word}
                </p>
                <p className="text-sm text-wolf">{example.reading}</p>
              </div>
              <AudioButton text={example.word} languageCode={lesson.languageCode} size="sm" />
            </div>
          )}
        </div>
      </div>

      <LessonFooter detail={last ? 'Agora leia palavras com elas.' : undefined}>
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
          {last ? 'Ler palavras' : 'Próxima letra'}
        </button>
      </LessonFooter>
    </>
  );
}

/**
 * Fase 2 -- as palavras.
 *
 * O significado comeca escondido e volta com UM toque: se ele aparecesse junto,
 * o olho leria o portugues primeiro e a palavra em cirilico viraria enfeite.
 * Esconder forca a tentativa de decodificar antes da confirmacao.
 */
function Reading({
  lesson,
  onContinue,
  onBack,
}: {
  lesson: AlphabetLesson;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [revealed, setRevealed] = useState<string[]>([]);

  return (
    <>
      <div className="space-y-4">
        <LessonHeader lesson={lesson} step="ler de verdade" />
        <p className="text-sm leading-relaxed text-wolf">
          Tente ler em voz alta antes de abrir. Todas usam só letras que você já viu.
        </p>

        {lesson.words.length === 0 && (
          <div className="card text-center text-sm text-wolf">
            Esta lição não trouxe palavras para ler.
          </div>
        )}

        {lesson.words.map((word) => (
          <WordCard
            key={word.word}
            word={word}
            languageCode={lesson.languageCode}
            open={revealed.includes(word.word)}
            onReveal={() => setRevealed((r) => [...r, word.word])}
          />
        ))}
      </div>

      <LessonFooter detail="Depois vem o treino, com as letras misturadas.">
        {/* Tres acoes nao cabem lado a lado em 360px: "voltar as letras" e o
            que ele mais vai querer aqui, entao o pular cede o lugar. */}
        <button className="btn-plain" onClick={onBack}>
          Ver letras
        </button>
        <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={onContinue}>
          Treinar
        </button>
      </LessonFooter>
    </>
  );
}

function WordCard({
  word,
  languageCode,
  open,
  onReveal,
}: {
  word: AlphabetWord;
  languageCode: string;
  open: boolean;
  onReveal: () => void;
}) {
  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-3">
        <p
          lang={languageCode}
          className="min-w-0 flex-1 break-words font-serif text-4xl leading-tight text-eel"
        >
          {word.word}
        </p>
        <AudioButton text={word.word} languageCode={languageCode} />
      </div>

      {open ? (
        <div className="space-y-1 border-t border-swan pt-3">
          <p className="font-mono text-sm text-macaw-dark">{word.reading}</p>
          <p className="font-serif text-lg font-semibold text-eel">{word.meaning}</p>
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

interface Drill {
  id: string;
  /** Enunciado em portugues. */
  question: string;
  /** Cirilico do enunciado, quando o que se pergunta e uma letra ou palavra. */
  subject?: string;
  /** Palavra falavel do enunciado -- so palavras ganham audio, letras nao. */
  speak?: string;
  options: string[];
  answer: string;
  /** Alternativas em cirilico precisam de lang proprio. */
  optionsAreCyrillic: boolean;
  explanation: string;
}

/**
 * Gera o treino a partir da propria aula.
 *
 * Duas decisoes que nao sao obvias:
 *
 * - Os distratores saem de `review` e das outras letras da licao, nunca de um
 *   alfabeto aleatorio. Alternativa implausivel se elimina sozinha e o acerto
 *   deixa de significar alguma coisa -- e justamente entre as letras parecidas
 *   que ele se perde.
 * - Toda letra com armadilha entra obrigatoriamente, antes de qualquer outro
 *   drill, e so depois o resto preenche ate o teto. Se a armadilha dependesse
 *   do sorteio, a licao poderia terminar sem cobrar a unica coisa que ela
 *   veio consertar.
 *
 * O sorteio e semeado pelo `lessonId`: o treino precisa ser o mesmo entre
 * renders (senao as alternativas dancam sob o dedo), e repetir a licao amanha
 * traz o mesmo conjunto, que e o que se quer para consolidar.
 */
function buildDrills(lesson: AlphabetLesson): Drill[] {
  const rand = seededRandom(lesson.lessonId);
  const pool = [...lesson.letters, ...lesson.review];

  const pick = <T,>(items: T[], count: number): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, count);
  };

  const shuffle = <T,>(items: T[]): T[] => pick(items, items.length);

  /** "Que som faz Р?" -- do glifo para o som. */
  const soundDrill = (letter: AlphabetLetter): Drill | null => {
    const others = pool.filter((l) => l.upper !== letter.upper && l.sound !== letter.sound);
    const distractors = dedupe(pick(others, 3).map((l) => l.sound), letter.sound);
    if (distractors.length === 0) return null;
    return {
      id: `sound-${letter.upper}`,
      question: 'Que som faz esta letra?',
      subject: `${letter.upper} ${letter.lower}`,
      options: shuffle([letter.sound, ...distractors]),
      answer: letter.sound,
      optionsAreCyrillic: false,
      explanation: letter.trap ?? `${letter.name}: ${letter.sound}.`,
    };
  };

  /** O caminho inverso: do som para o glifo. */
  const glyphDrill = (letter: AlphabetLetter): Drill | null => {
    const label = (l: AlphabetLetter) => `${l.upper} ${l.lower}`;
    const others = pool.filter((l) => l.upper !== letter.upper);
    const distractors = dedupe(pick(others, 3).map(label), label(letter));
    if (distractors.length === 0) return null;
    return {
      id: `glyph-${letter.upper}`,
      question: `Qual letra faz o som ${letter.sound}?`,
      options: shuffle([label(letter), ...distractors]),
      answer: label(letter),
      optionsAreCyrillic: true,
      explanation: letter.trap ?? `${label(letter)} é ${letter.name}.`,
    };
  };

  /** Leitura de verdade: decodificar a palavra inteira. */
  const readDrill = (word: AlphabetWord): Drill | null => {
    const others = lesson.words.filter((w) => w.word !== word.word);
    const distractors = dedupe(pick(others, 3).map((w) => w.meaning), word.meaning);
    if (distractors.length === 0) return null;
    return {
      id: `read-${word.word}`,
      question: 'Leia:',
      subject: word.word,
      speak: word.word,
      options: shuffle([word.meaning, ...distractors]),
      answer: word.meaning,
      optionsAreCyrillic: false,
      explanation: `${word.word} = ${word.reading} = ${word.meaning}.`,
    };
  };

  const traps = lesson.letters.filter((l) => l.trap);
  const plain = lesson.letters.filter((l) => !l.trap);

  const required = traps.map(soundDrill).filter(isDrill).slice(0, 4);
  // Alterna leitura e reconhecimento de glifo para o preenchimento: duas
  // perguntas seguidas do mesmo formato viram padrao de resposta, nao leitura.
  const filler = interleave(
    shuffle(lesson.words).map(readDrill).filter(isDrill),
    [...plain.map(glyphDrill), ...traps.map(glyphDrill)].filter(isDrill),
  );

  const chosen = [...required];
  for (const drill of filler) {
    if (chosen.length >= 6) break;
    if (!chosen.some((d) => d.id === drill.id)) chosen.push(drill);
  }
  // Com poucas letras novas o preenchimento acaba antes do minimo; ai as letras
  // ja vistas voltam como revisao, que e o efeito desejado de qualquer forma.
  for (const letter of shuffle(lesson.review)) {
    if (chosen.length >= 4) break;
    const drill = soundDrill(letter);
    if (drill && !chosen.some((d) => d.id === drill.id)) chosen.push(drill);
  }

  return shuffle(chosen);
}

function isDrill(drill: Drill | null): drill is Drill {
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
}: {
  lesson: AlphabetLesson;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const drills = useMemo(() => buildDrills(lesson), [lesson]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);

  const record = useMutation({
    mutationFn: async (result: { correct: number; total: number }) => {
      const { data } = await api.post('/alphabet/record', {
        lessonId: lesson.lessonId,
        languageCode: lesson.languageCode,
        correct: result.correct,
        total: result.total,
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
          <p className="font-serif text-lg font-semibold text-eel">letras lidas certo</p>
          <p className="max-w-sm text-sm text-wolf">
            {score >= 70
              ? 'Estas já podem aparecer em palavras novas.'
              : 'Estas letras voltam amanhã, antes de qualquer palavra nova.'}
          </p>
        </div>
        <LessonFooter tone={score >= 70 ? 'correct' : 'neutral'} title={`${score}% de acerto`}>
          <button
            className="btn-primary px-8"
            onClick={() => {
              // Quem escolhe a proxima licao do alfabeto e o progresso gravado;
              // se a gravacao falhar, o bloco ainda fecha e credita o XP.
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

  const isCorrect = answer === drill.answer;

  function next() {
    if (answer !== null && isCorrect) setCorrect((c) => c + 1);
    setAnswer(null);
    setIndex((i) => i + 1);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={drills.length} size="sm" tone="bg-macaw" />
          <span className="shrink-0 font-mono text-xs text-hare">
            {index + 1}/{drills.length}
          </span>
        </div>

        <div className="space-y-2">
          <p className="font-serif text-lg font-semibold leading-snug text-eel">{drill.question}</p>
          {drill.subject && (
            <div className="flex items-center gap-3">
              <p
                lang={lesson.languageCode}
                className="min-w-0 flex-1 break-words font-serif text-5xl leading-tight text-eel"
              >
                {drill.subject}
              </p>
              {/* So palavras sao faladas: TTS lendo um caractere solto e loteria. */}
              {drill.speak && <AudioButton text={drill.speak} languageCode={lesson.languageCode} />}
            </div>
          )}
        </div>

        <div className="grid gap-2">
          {drill.options.map((option) => {
            const state =
              answer === null
                ? 'idle'
                : option === drill.answer
                  ? 'correct'
                  : option === answer
                    ? 'wrong'
                    : 'idle';

            return (
              <AnswerOption
                key={option}
                state={state}
                disabled={answer !== null}
                lang={drill.optionsAreCyrillic ? lesson.languageCode : 'pt-BR'}
                // Escolher ja corrige: o toque em "Verificar" nunca decidiu nada.
                onClick={() => answer === null && setAnswer(option)}
              >
                <span className={drill.optionsAreCyrillic ? 'font-serif text-3xl' : ''}>
                  {option}
                </span>
              </AnswerOption>
            );
          })}
        </div>
      </div>

      {answer !== null ? (
        <LessonFooter
          tone={isCorrect ? 'correct' : 'wrong'}
          title={isCorrect ? 'Isso mesmo' : `É ${drill.answer}`}
          detail={drill.explanation}
        >
          <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={next}>
            Continuar
          </button>
        </LessonFooter>
      ) : (
        <LessonFooter>
          <SkipButton onSkip={onSkip} />
        </LessonFooter>
      )}
    </>
  );
}
