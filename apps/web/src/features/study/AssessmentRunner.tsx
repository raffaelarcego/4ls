import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter, SkipButton } from '../../components/LessonFooter';
import { ProgressBar } from '../../components/ProgressBar';
import { SentenceBuilder } from '../../components/SentenceBuilder';
import { languageTheme } from '../../lib/ui';
import { api, errorMessage } from '../../services/api';
import { AssessmentExam, AssessmentItem, SessionActivity } from '../../types';

/**
 * A prova mensal.
 *
 * O unico bloco do app que MEDE em vez de ensinar, e a tela inteira e desenhada
 * a partir disso. Aqui nao ha regra escrita, nao ha dica, nao ha rotulo nas
 * pecas, nao ha segunda tentativa e nao ha "como voce se saiu?" -- cada uma
 * dessas coisas, que em qualquer outro bloco ajuda, aqui contamina a medida.
 *
 * Ela existe porque o resto do app se media por opiniao do aluno: comparacao e
 * autoavaliada, escuta e fala terminam num Dificil/Ok/Tranquilo, e o que e
 * medido de verdade cobra na mesma sessao que ensinou. Essas notas decidem o
 * dia seguinte, entao o laco se alimentava de si mesmo -- foi assim que meses
 * passaram sem o aluno aprender alemao e russo.
 *
 * O resultado so aparece no fim, de uma vez. Mostrar certo/errado item a item
 * transformaria a prova numa sequencia de pequenas derrotas no meio do
 * caminho, e o que se quer aqui e o numero final -- e a serie dele ao longo
 * dos meses.
 */
export function AssessmentRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const exam = useQuery<AssessmentExam>({
    queryKey: ['assessment', 'exam'],
    queryFn: async () => (await api.get('/assessment/exam')).data,
    retry: false,
    // A prova nao pode mudar embaixo do aluno no meio dela.
    staleTime: Infinity,
  });

  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Array<{ languageCode: string; correct: boolean }>>([]);
  const [answered, setAnswered] = useState<boolean | null>(null);

  const record = useMutation({
    mutationFn: async (all: Array<{ languageCode: string; correct: boolean }>) => {
      const { data } = await api.post('/assessment/record', { results: all });
      return data;
    },
  });

  if (exam.isPending) {
    return (
      <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
        <p className="font-serif text-lg font-semibold text-eel">Montando a prova...</p>
        <p className="max-w-sm text-sm text-wolf">
          Só funções que você aprendeu há três semanas ou mais.
        </p>
      </div>
    );
  }

  if (exam.isError || !exam.data) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <p className="font-serif text-lg font-semibold text-eel">Não consegui abrir a prova</p>
          <p className="max-w-sm text-sm text-wolf">{errorMessage(exam.error)}</p>
        </div>
        <LessonFooter tone="wrong">
          <SkipButton onSkip={onSkip} />
          <button className="btn-primary px-8" onClick={() => exam.refetch()}>
            Tentar de novo
          </button>
        </LessonFooter>
      </>
    );
  }

  const items = exam.data.items;

  /*
   * Sem material descansado nao ha o que medir. Isso NAO e erro: e o estado
   * normal de quem comecou ha pouco, e o texto tem de dizer isso em vez de
   * parecer uma falha do app.
   */
  if (items.length === 0) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <p className="font-serif text-lg font-semibold text-eel">Ainda não há o que medir</p>
          <p className="max-w-sm text-sm text-wolf">
            A prova só cobra o que descansou três semanas. Volte a estudar e ela aparece sozinha.
          </p>
        </div>
        <LessonFooter>
          <button className="btn-primary px-8" onClick={() => onFinish(0)}>
            Seguir
          </button>
        </LessonFooter>
      </>
    );
  }

  const item = items[index];

  // Fim da prova: o resultado, de uma vez.
  if (!item) {
    return (
      <Result
        items={items}
        results={results}
        onFinish={(score) => {
          // Quem grava a nota e o backend; se a gravacao falhar, o bloco ainda
          // fecha e credita o XP -- ter encarado a prova ja vale.
          record.mutate(results);
          onFinish(score);
        }}
      />
    );
  }

  function next() {
    setAnswered(null);
    setIndex((i) => i + 1);
  }

  return (
    <>
      <div className="space-y-4">
        <div>
          <p className="font-mono text-xs text-hare">
            Prova do mês · item {index + 1} de {items.length}
          </p>
          <p className="text-xs text-wolf">{exam.data.questions[0]?.question}</p>
        </div>

        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={items.length} size="sm" tone="bg-bee" />
          <LanguageChip code={item.languageCode} />
        </div>

        <ItemBuilder
          key={`${item.canDoId}-${item.languageCode}`}
          item={item}
          answered={answered !== null}
          onAnswer={(correct) => {
            setAnswered(correct);
            setResults((r) => [...r, { languageCode: item.languageCode, correct }]);
          }}
        />
      </div>

      {answered !== null ? (
        /*
         * Sem "certo" nem "errado": so a frase e o avanco.
         *
         * Numa aula, saber na hora e o que corrige. Numa prova, saber na hora
         * muda como o aluno encara os itens seguintes -- dois erros seguidos e
         * ele responde o resto com medo, tres acertos e ele acelera. A frase
         * certa aparece porque esconder tambem seria ruim: ele acabou de tentar
         * e merece ver.
         */
        <LessonFooter title="Resposta certa" detail={<Correct item={item} />}>
          <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={next}>
            Continuar
          </button>
        </LessonFooter>
      ) : (
        <LessonFooter detail="Sem dica e sem repetir — é isto que faz a nota valer.">
          <SkipButton onSkip={onSkip} label="Sair da prova" confirmLabel="Sair mesmo?" />
        </LessonFooter>
      )}
    </>
  );
}

function ItemBuilder({
  item,
  answered,
  onAnswer,
}: {
  item: AssessmentItem;
  answered: boolean;
  onAnswer: (correct: boolean) => void;
}) {
  // Embaralhado uma vez por item: reordenar a cada render faria as pecas
  // dancarem sob o dedo.
  const chunks = useMemo(
    () => shuffle(item.parts.map((p) => ({ text: p.text, label: p.column }))),
    [item],
  );

  return (
    <SentenceBuilder
      prompt={item.gloss}
      chunks={chunks}
      answer={item.parts.map((p) => p.text).join(' ')}
      languageCode={item.languageCode}
      answered={answered}
      onAnswer={onAnswer}
      // Rotulo some: com ele a ordem vira deducao a partir do portugues.
      showLabels={false}
    />
  );
}

function Correct({ item }: { item: AssessmentItem }) {
  return (
    <span className="flex items-center gap-2">
      <span lang={item.languageCode} className="font-serif text-base text-eel">
        {item.sentence}
      </span>
      <AudioButton text={item.sentence} languageCode={item.languageCode} size="sm" />
    </span>
  );
}

function LanguageChip({ code }: { code: string }) {
  const theme = languageTheme(code);
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-bold ${theme.border} ${theme.soft} ${theme.text}`}
    >
      {theme.mark}
    </span>
  );
}

/** A nota, por idioma e no total. */
function Result({
  items,
  results,
  onFinish,
}: {
  items: AssessmentItem[];
  results: Array<{ languageCode: string; correct: boolean }>;
  onFinish: (score: number) => void;
}) {
  const total = results.length || items.length;
  const correct = results.filter((r) => r.correct).length;
  const score = Math.round((correct / total) * 100);

  const byLanguage = new Map<string, { correct: number; total: number }>();
  for (const r of results) {
    const t = byLanguage.get(r.languageCode) ?? { correct: 0, total: 0 };
    t.total += 1;
    if (r.correct) t.correct += 1;
    byLanguage.set(r.languageCode, t);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="card flex flex-col items-center gap-1 text-center">
          <p className="font-mono text-4xl font-bold tabular-nums text-bee">{score}%</p>
          <p className="font-serif text-lg font-semibold text-eel">
            {correct} de {total} frases
          </p>
          <p className="max-w-sm text-sm text-wolf">
            {score >= 75
              ? 'O que você aprendeu há um mês continua lá.'
              : 'Parte do que você deu por aprendido escorregou — o plano dos próximos dias vai puxar para cá.'}
          </p>
        </div>

        <div className="space-y-2">
          <p className="section-title">Por idioma</p>
          {[...byLanguage.entries()].map(([code, t]) => {
            const theme = languageTheme(code);
            const pct = Math.round((t.correct / t.total) * 100);
            return (
              <div key={code} className="flex items-center gap-3">
                <LanguageChip code={code} />
                <ProgressBar value={pct} tone={theme.bg} />
                <span className="w-12 shrink-0 text-right font-mono text-sm font-bold text-eel">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <LessonFooter
        tone={score >= 75 ? 'correct' : 'neutral'}
        detail="Esta nota fica guardada. É com ela que dá para comparar este mês com o próximo."
      >
        <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={() => onFinish(score)}>
          Concluir
        </button>
      </LessonFooter>
    </>
  );
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
