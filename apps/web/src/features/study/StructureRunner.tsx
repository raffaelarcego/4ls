import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter, SkipButton } from '../../components/LessonFooter';
import { ProgressBar } from '../../components/ProgressBar';
import { api, errorMessage } from '../../services/api';
import { SessionActivity, StructureLesson } from '../../types';

/**
 * Bloco de formacao de frase.
 *
 * O bloco de vocabulario ensina o que as palavras significam; este ensina como
 * monta-las numa frase que um nativo diria. Sao coisas diferentes, e faltava a
 * segunda: dava para saber "Arbeit", "morgen" e "fahren" e ainda assim montar
 * a frase alema com a ordem do portugues.
 *
 * A aula tem tres partes, nesta ordem por um motivo:
 *
 * 1. A REGRA, com a formula e os passos de montagem.
 * 2. Os EXEMPLOS fatiados em pecas rotuladas. Ver "Heute | gehe | ich | ins
 *    Kino" com o nome de cada peca ensina a posicao muito melhor do que ler a
 *    regra enunciada -- por isso a fatia e o centro da tela, nao um detalhe.
 * 3. A MONTAGEM: o aluno ordena as pecas sozinho. So aqui se sabe se pegou.
 */
export function StructureRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const [phase, setPhase] = useState<'lesson' | 'drills'>('lesson');

  const lesson = useQuery<StructureLesson>({
    queryKey: ['structure', 'lesson', activity.languageCode],
    queryFn: async () => {
      const { data } = await api.get('/structure/lesson', {
        params: { language: activity.languageCode },
      });
      return data;
    },
    retry: false,
  });

  if (lesson.isPending) {
    return (
      <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
        <p className="font-serif text-lg font-semibold text-eel">Montando a aula de estrutura...</p>
        <p className="max-w-sm text-sm text-wolf">
          Como o {activity.languageName} monta a frase, e onde o português te trai.
        </p>
      </div>
    );
  }

  if (lesson.isError || !lesson.data) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <p className="font-serif text-lg font-semibold text-eel">Não consegui montar a aula</p>
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
    return <AssemblyDrills lesson={lesson.data} onFinish={onFinish} onSkip={onSkip} />;
  }

  return <Explanation lesson={lesson.data} onContinue={() => setPhase('drills')} onSkip={onSkip} />;
}

function Explanation({
  lesson,
  onContinue,
  onSkip,
}: {
  lesson: StructureLesson;
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <div className="space-y-4">
        <div className="card space-y-3">
          <div>
            <p className="font-mono text-xs text-hare">
              formação de frase, {lesson.languageName}, nível {lesson.level}
            </p>
            <h2 className="font-serif text-xl font-semibold leading-tight text-eel">{lesson.title}</h2>
            <p className="font-serif text-sm italic text-wolf">{lesson.question}</p>
          </div>

          <p className="rounded-md border border-macaw bg-macaw-soft px-4 py-3 font-mono text-base text-macaw-dark">
            {lesson.formula}
          </p>

          <p className="text-sm leading-relaxed text-eel">{lesson.behavior}</p>
          {lesson.explanation !== lesson.behavior && (
            <p className="text-sm leading-relaxed text-wolf">{lesson.explanation}</p>
          )}
        </div>

        {lesson.steps.length > 0 && (
          <div className="card space-y-2">
            <p className="section-title">Como montar</p>
            <ol className="space-y-2">
              {lesson.steps.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm leading-snug text-eel">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-macaw font-mono text-xs text-macaw">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="space-y-3">
          <p className="section-title">A frase, peça por peça</p>
          {lesson.examples.map((example) => (
            <div key={example.sentence} className="card space-y-2.5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg font-semibold leading-snug text-eel">
                    {example.sentence}
                  </p>
                  <p className="text-xs italic text-hare">{example.translation}</p>
                </div>
                <AudioButton
                  text={example.sentence}
                  languageCode={lesson.languageCode}
                  size="sm"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {example.parts.map((part, i) => (
                  <span
                    key={`${part.text}-${i}`}
                    className="rounded-md border border-swan bg-snow px-2.5 py-1.5"
                  >
                    <span className="block text-sm font-medium leading-tight text-eel">
                      {part.text}
                    </span>
                    <span className="block text-[11px] leading-tight text-hare">{part.role}</span>
                  </span>
                ))}
              </div>

              {example.note && (
                <p className="text-xs text-wolf">{example.note}</p>
              )}
            </div>
          ))}
        </div>

        {/* O contraste e o que combate a interferencia: quem estuda quatro
            idiomas nao erra a ordem por ignorancia, erra por importar a regra
            do idioma vizinho. */}
        <div className="card border-humpback bg-humpback-soft">
          <p className="section-title mb-1.5">Nos outros idiomas</p>
          <p className="text-sm leading-relaxed text-humpback-dark">{lesson.contrast}</p>
        </div>

        {lesson.pitfalls.length > 0 && (
          <div className="card space-y-3 border-cardinal">
            <p className="section-title">Onde o português te trai</p>
            {lesson.pitfalls.map((pitfall) => (
              <div key={pitfall.wrong} className="space-y-1">
                <p className="text-sm text-cardinal-dark line-through">{pitfall.wrong}</p>
                <p className="text-sm font-medium text-grass-dark">{pitfall.right}</p>
                <p className="text-xs text-wolf">{pitfall.why}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <LessonFooter detail="Agora monte as frases você mesmo.">
        <SkipButton onSkip={onSkip} />
        <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={onContinue}>
          Praticar
        </button>
      </LessonFooter>
    </>
  );
}

/**
 * Montagem da frase: o aluno toca nas pecas, na ordem.
 *
 * Tocar em vez de digitar e deliberado -- o que esta sendo testado e a ORDEM,
 * nao a ortografia. Um teclado transformaria um erro de acento numa frase
 * errada e ensinaria a licao errada.
 */
function AssemblyDrills({
  lesson,
  onFinish,
  onSkip,
}: {
  lesson: StructureLesson;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(0);

  const record = useMutation({
    mutationFn: async (score: { correct: number; total: number }) => {
      const { data } = await api.post('/structure/record', {
        patternId: lesson.patternId,
        languageCode: lesson.languageCode,
        correct: score.correct,
        total: score.total,
      });
      return data;
    },
  });

  const drill = lesson.drills[index];

  const assembled = useMemo(
    () => picked.map((i) => drill?.scrambled[i] ?? '').join(' '),
    [picked, drill],
  );

  if (lesson.drills.length === 0) {
    return (
      <>
        <div className="card flex min-h-[12rem] flex-col items-center justify-center gap-2 text-center">
          <span className="text-6xl">🧱</span>
          <p className="text-lg font-black">Aula vista</p>
          <p className="max-w-sm text-sm font-semibold text-wolf">
            Esta aula não veio com exercícios de montagem.
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
    const score = Math.round((correct / lesson.drills.length) * 100);
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <span className="animate-pop text-6xl">{score >= 70 ? '🎉' : '💪'}</span>
          <p className="text-xl font-black">
            {correct} de {lesson.drills.length} frases montadas
          </p>
          <p className="text-sm font-semibold text-wolf">
            {score >= 70
              ? 'Esse padrão está firmando.'
              : 'Este padrão volta, porque ele destrava todas as outras frases.'}
          </p>
        </div>
        <LessonFooter tone={score >= 70 ? 'correct' : 'neutral'} title={`${score}% de acerto`}>
          <button
            className="btn-primary px-8"
            onClick={() => {
              // O progresso do padrao e o que escolhe a aula de amanha; se a
              // gravacao falhar, o bloco ainda conclui e credita o XP.
              record.mutate({ correct, total: lesson.drills.length });
              onFinish(score);
            }}
          >
            Continuar
          </button>
        </LessonFooter>
      </>
    );
  }

  const isCorrect = normalize(assembled) === normalize(drill.answer);
  const complete = picked.length === drill.scrambled.length;

  function next() {
    if (checked && isCorrect) setCorrect((c) => c + 1);
    setChecked(false);
    setPicked([]);
    setIndex((i) => i + 1);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={lesson.drills.length} size="sm" tone="bg-macaw" />
          <span className="shrink-0 font-mono text-xs text-hare">
            {index + 1}/{lesson.drills.length}
          </span>
        </div>

        <div>
          <p className="text-xs text-hare">Monte a frase</p>
          <p className="font-serif text-xl font-semibold leading-snug text-eel">{drill.gloss}</p>
        </div>

        {/* Linha de montagem: o que ja foi escolhido, na ordem. */}
        <div className="min-h-[5.5rem] rounded-lg border border-dashed border-swan bg-snow p-2.5">
          {picked.length === 0 ? (
            <p className="p-1 text-sm text-hare">Toque nas peças na ordem certa.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {picked.map((pieceIndex, position) => (
                <button
                  key={`${pieceIndex}-${position}`}
                  disabled={checked}
                  onClick={() => setPicked((p) => p.filter((_, i) => i !== position))}
                  lang={lesson.languageCode}
                  aria-label={`Remover ${drill.scrambled[pieceIndex]}`}
                  className="min-h-11 rounded-md border border-macaw bg-white px-3 py-2 text-base text-macaw-dark transition-colors"
                >
                  {drill.scrambled[pieceIndex]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/*
          Banco de pecas. A peca ja usada continua no lugar, apagada: tirar da
          lista reflui as outras e a frase que ele estava montando mentalmente
          muda de posicao no meio da montagem.
        */}
        <div className="flex flex-wrap gap-2">
          {drill.scrambled.map((piece, pieceIndex) => {
            const used = picked.includes(pieceIndex);
            return (
              <button
                key={`${piece}-${pieceIndex}`}
                disabled={used || checked}
                onClick={() => setPicked((p) => [...p, pieceIndex])}
                lang={lesson.languageCode}
                className={`min-h-11 rounded-md border px-3 py-2 text-base transition-colors ${
                  used ? 'border-dashed border-swan bg-snow text-hare/40' : 'border-swan bg-white text-eel'
                }`}
              >
                {piece}
              </button>
            );
          })}
        </div>
      </div>

      {checked ? (
        <LessonFooter
          tone={isCorrect ? 'correct' : 'wrong'}
          title={isCorrect ? 'Isso mesmo' : `Ordem certa: ${drill.answer}`}
          detail={drill.explanation}
        >
          <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={next}>
            Continuar
          </button>
        </LessonFooter>
      ) : (
        <LessonFooter>
          {picked.length > 0 ? (
            <button className="btn-plain" onClick={() => setPicked([])}>
              Limpar
            </button>
          ) : (
            <SkipButton onSkip={onSkip} />
          )}
          <button
            className="btn-primary flex-1 px-10 sm:flex-none"
            onClick={() => setChecked(true)}
            disabled={!complete}
          >
            Verificar
          </button>
        </LessonFooter>
      )}
    </>
  );
}

/**
 * O que conta e a ordem das pecas, nao a pontuacao nem a maiuscula: as pecas
 * chegam sem o ponto final e sem a maiuscula da frase montada.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
