import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnswerInput } from '../../components/AnswerField';
import { AnswerOption } from '../../components/AnswerOption';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter, SkipButton } from '../../components/LessonFooter';
import { ProgressBar } from '../../components/ProgressBar';
import { api, errorMessage } from '../../services/api';
import { SessionActivity } from '../../types';
import { AlphabetRunner } from './AlphabetRunner';
import { AssessmentRunner } from './AssessmentRunner';
import { CanDoCompareRunner } from './CanDoCompareRunner';
import { CanDoContrastRunner } from './CanDoContrastRunner';
import { DictationRunner } from './DictationRunner';
import { FoundationRunner } from './FoundationRunner';
import { ListeningRunner } from './ListeningRunner';
import { MorphologyRunner } from './MorphologyRunner';
import { ProductionRunner } from './ProductionRunner';
import { PromotionRunner } from './PromotionRunner';
import { ReadingRunner } from './ReadingRunner';
import { SpeakingRunner } from './SpeakingRunner';
import { StructureRunner } from './StructureRunner';
import { VocabularyRunner } from './VocabularyRunner';

interface Exercise {
  prompt: string;
  type: 'multiple_choice' | 'fill_blank' | 'translate';
  options: string[];
  answer: string;
  explanation: string;
}

/**
 * Tipos para os quais a IA consegue gerar exercicios objetivos e corrigiveis.
 *
 * `reading` saiu daqui: exercicio gerado era o que o bloco de leitura tinha no
 * lugar de um texto, e cinco perguntas de multipla escolha sobre nada nao sao
 * compreensao de leitura. Agora ele tem o `ReadingRunner`, com a mesma historia
 * nos quatro idiomas.
 */
const EXERCISE_TYPES = new Set(['grammar']);

export function GenericRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  // Cada tipo com correcao propria tem seu runner. O bloco autoavaliado deixou
  // de ser o destino de tudo que nao e exercicio: hoje so sobra o que ainda nao
  // tem como ser medido automaticamente.
  if (EXERCISE_TYPES.has(activity.type)) {
    return <ExerciseRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  // Vocabulario deixou de ser exercicio avulso: agora e o bloco de conceitos,
  // que mostra o mesmo significado nos quatro idiomas de uma vez.
  if (activity.type === 'vocabulary') {
    return <VocabularyRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  // Producao quadrupla atravessa os idiomas: o bloco pertence nominalmente a
  // um, mas cobra a mesma frase em todos.
  if (activity.type === 'production') {
    return <ProductionRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  // Os dois blocos da can-do sao as pontas do dia e leem a mesma funcao: o
  // contraste ABRE mostrando as quatro respostas juntas, a comparacao FECHA
  // cobrando as quatro de memoria. A ordem e pedagogica -- intercalar idiomas
  // antes do contraste explicito e o que sobrecarrega um iniciante --, e quem
  // a define e o motor da sessao; aqui so se escolhe a tela.
  if (activity.type === 'contrast') {
    return <CanDoContrastRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  if (activity.type === 'compare') {
    return <CanDoCompareRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  // O alfabeto vem antes de tudo num idioma que ele nao consegue ler: sem ele,
  // os outros blocos em russo ensinam a reconhecer o desenho da palavra.
  if (activity.type === 'alphabet') {
    return <AlphabetRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  // Depois de ler as letras vem montar a frase com elas. Sem este degrau, a
  // aula de estrutura fala de uma regra de ordem para quem ainda nao tem
  // pronome nem verbo -- que era o caso em alemao e em russo.
  if (activity.type === 'foundation') {
    return <FoundationRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  // O chefe de fase: o unico bloco com consequencia -- ele muda o nivel do
  // idioma, que e o teto de todo o conteudo que o app serve. Nunca e planejado;
  // chega aqui porque o aluno tocou no chefe no painel.
  if (activity.type === 'promotion') {
    return <PromotionRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  // A prova do mes: o unico bloco que mede em vez de ensinar.
  if (activity.type === 'assessment') {
    return <AssessmentRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  // Os casos: so existem em alemao e russo, e sao o que a estrutura nao ensina
  // -- a ordem certa com a forma errada soa pior que a ordem trocada.
  if (activity.type === 'morphology') {
    return <MorphologyRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  if (activity.type === 'structure') {
    return <StructureRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  // A mesma historia nos quatro idiomas, uma leitura por idioma. Quando o
  // texto chega no idioma mais fraco, ele ja sabe o que esta escrito ali -- e e
  // isso que o deixa ler acima do proprio nivel.
  if (activity.type === 'reading') {
    return <ReadingRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  if (activity.type === 'listening') {
    return <ListeningRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  if (activity.type === 'dictation') {
    return <DictationRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  if (activity.type === 'speaking') {
    return <SpeakingRunner activity={activity} onFinish={onFinish} onSkip={onSkip} />;
  }
  return <SelfAssessedBlock activity={activity} onFinish={onFinish} onSkip={onSkip} />;
}

function ExerciseRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(0);

  const generate = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/tutor/exercises', {
        languageCode: activity.languageCode,
        type: activity.type,
        count: 5,
      });
      return data.exercises as Exercise[];
    },
    onSuccess: (data) => setExercises(data),
  });

  /*
   * Gera assim que o bloco abre, em vez de esperar um toque em "Gerar
   * exercicios". O bloco JA e o exercicio -- pedir permissao para comecar o que
   * ele escolheu comecar era um toque a mais, todo dia, sem decisao nenhuma no
   * meio. A trava de execucao unica e necessaria porque o StrictMode monta o
   * componente duas vezes em desenvolvimento, e cada montagem custaria uma
   * chamada de IA.
   */
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    generate.mutate();
  }, [generate]);

  if (!exercises) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <p className="font-serif text-lg font-semibold text-eel">
            {generate.isError ? 'Não deu para gerar os exercícios' : 'Escrevendo seus exercícios...'}
          </p>
          <p className="max-w-sm text-sm text-wolf">
            {generate.isError
              ? errorMessage(generate.error)
              : 'Eles saem dos seus erros recorrentes neste idioma.'}
          </p>
        </div>

        <LessonFooter tone={generate.isError ? 'wrong' : 'neutral'}>
          {generate.isError ? (
            <>
              <button className="btn-plain" onClick={() => onFinish(0)}>
                Seguir sem exercícios
              </button>
              <button className="btn-primary px-8" onClick={() => generate.mutate()}>
                Tentar de novo
              </button>
            </>
          ) : (
            <SkipButton onSkip={onSkip} />
          )}
        </LessonFooter>
      </>
    );
  }

  const exercise = exercises[index];

  if (!exercise) {
    const score = Math.round((correct / exercises.length) * 100);
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <p className="font-mono text-3xl text-eel">
            {correct}/{exercises.length}
          </p>
          <p className="font-serif text-lg font-semibold text-eel">acertos</p>
          <p className="text-sm text-wolf">
            {score >= 70 ? 'Esse ponto está firmando.' : 'Ainda vale insistir aqui.'}
          </p>
        </div>
        <LessonFooter tone={score >= 70 ? 'correct' : 'neutral'} title={`${score}% de acerto`}>
          <button className="btn-primary px-8" onClick={() => onFinish(score)}>
            Continuar
          </button>
        </LessonFooter>
      </>
    );
  }

  const isCorrect = normalize(answer) === normalize(exercise.answer);

  function next() {
    if (checked && isCorrect) setCorrect((c) => c + 1);
    setChecked(false);
    setAnswer('');
    setIndex((i) => i + 1);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={exercises.length} size="sm" tone="bg-macaw" />
          <span className="shrink-0 font-mono text-xs text-hare">
            {index + 1}/{exercises.length}
          </span>
        </div>

        <div className="flex items-start gap-3">
          <p className="min-w-0 flex-1 font-serif text-xl font-semibold leading-snug text-eel">
            {exercise.prompt}
          </p>
          <AudioButton text={exercise.prompt} languageCode={activity.languageCode} />
        </div>

        {exercise.options?.length > 0 ? (
          <div className="grid gap-2">
            {exercise.options.map((option) => {
              const selected = answer === option;
              const state = !checked
                ? selected
                  ? 'selected'
                  : 'idle'
                : option === exercise.answer
                  ? 'correct'
                  : selected
                    ? 'wrong'
                    : 'idle';

              return (
                <AnswerOption
                  key={option}
                  state={state}
                  disabled={checked}
                  lang={activity.languageCode}
                  /*
                   * Escolher JA corrige. Antes eram tres toques por questao --
                   * opcao no meio da tela, "Verificar" no rodape, "Continuar" no
                   * mesmo canto --, e dois deles nao decidiam nada.
                   */
                  onClick={() => {
                    if (checked) return;
                    setAnswer(option);
                    setChecked(true);
                  }}
                >
                  {option}
                </AnswerOption>
              );
            })}
          </div>
        ) : (
          <AnswerInput
            value={answer}
            onChange={setAnswer}
            languageCode={activity.languageCode}
            disabled={checked}
            placeholder="Digite sua resposta"
            onSubmit={() => answer && setChecked(true)}
            className="text-lg"
          />
        )}
      </div>

      {checked ? (
        <LessonFooter
          tone={isCorrect ? 'correct' : 'wrong'}
          title={isCorrect ? 'Isso mesmo' : `Resposta certa: ${exercise.answer}`}
          detail={exercise.explanation}
        >
          <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={next}>
            Continuar
          </button>
        </LessonFooter>
      ) : (
        <LessonFooter>
          <SkipButton onSkip={onSkip} />
          {/* Sem opcoes, a resposta e digitada -- e ai ainda existe um passo de
              confirmar. Com opcoes, escolher ja corrigiu e o botao nao aparece. */}
          {!exercise.options?.length && (
            <button
              className="btn-primary flex-1 px-10 sm:flex-none"
              onClick={() => setChecked(true)}
              disabled={!answer}
            >
              Verificar
            </button>
          )}
        </LessonFooter>
      )}
    </>
  );
}

/**
 * Blocos sem correcao automatica (listening, speaking, writing, tutor).
 * O usuario cumpre o bloco e registra a propria percepcao -- essa nota
 * alimenta as subcompetencias CEFR ate existir avaliacao automatica.
 */
function SelfAssessedBlock({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const instructions: Record<string, { emoji: string; text: string }> = {
    writing: {
      emoji: '✍️',
      text: 'Escreva um texto curto no idioma. Use o Writing Lab do tutor para receber correção.',
    },
    tutor: { emoji: '🤖', text: 'Converse com o tutor de IA neste idioma.' },
  };
  const instruction = instructions[activity.type] ?? {
    emoji: '⭐',
    text: 'Cumpra este bloco e avalie seu desempenho ao final.',
  };

  const [score, setScore] = useState<number | null>(null);

  const options = [
    { label: 'Difícil', score: 35, className: 'border-cardinal bg-cardinal-soft text-cardinal-dark' },
    { label: 'Ok', score: 65, className: 'border-bee bg-bee-soft text-bee-dark' },
    { label: 'Tranquilo', score: 90, className: 'border-grass bg-grass-soft text-grass-dark' },
  ];

  return (
    <>
      <div className="space-y-4">
        <div className="card flex flex-col items-center gap-3 text-center">
          <p className="max-w-md text-lg leading-snug text-eel">{instruction.text}</p>
          {activity.type === 'tutor' && (
            <Link to="/tutor" className="btn-blue">
              Abrir o tutor
            </Link>
          )}
        </div>

        <div>
          <p className="section-title mb-2">Como você se saiu?</p>
          <div className="grid grid-cols-3 gap-2.5">
            {options.map((option) => (
              <button
                key={option.label}
                onClick={() => setScore(option.score)}
                className={`tap-target flex items-center justify-center rounded-md border px-2 py-4 text-sm transition-colors ${
                  score === option.score ? option.className : 'border-swan bg-white text-wolf'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <LessonFooter
        tone={score === null ? 'neutral' : 'correct'}
        title={score === null ? undefined : 'Anotado!'}
        detail={score === null ? 'Escolha uma nota para concluir o bloco.' : 'Isso ajusta o plano de amanhã.'}
      >
        <button className="btn-plain" onClick={onSkip}>
          Pular bloco
        </button>
        <button
          className="btn-primary flex-1 px-10 sm:flex-none"
          onClick={() => score !== null && onFinish(score)}
          disabled={score === null}
        >
          Concluir
        </button>
      </LessonFooter>
    </>
  );
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[.,!?;:]$/, '');
}
