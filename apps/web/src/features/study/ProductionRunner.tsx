import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter } from '../../components/LessonFooter';
import { languageTheme } from '../../lib/ui';
import { api, errorMessage } from '../../services/api';
import { ProductionEvaluation, ProductionMission, SessionActivity } from '../../types';

/**
 * Producao quadrupla.
 *
 * O exame da tese do produto, e o unico bloco que nao da nenhuma pista: todo o
 * resto e reconhecimento -- escolher alternativa, ordenar pecas dadas --, e
 * reconhecimento esconde exatamente o que falha na hora de falar, que e puxar
 * a forma da memoria sem nada na tela para apoiar.
 *
 * Duas escolhas de tela que mudam o que o exercicio mede:
 *
 * 1. O TERMO aparece, a frase nao. O aluno nao esta sendo testado em lembrar a
 *    palavra -- o flashcard ja faz isso. Esta sendo testado em construir a
 *    frase em volta dela: a ordem, o caso, a preposicao, o que cada lingua
 *    obriga. Esconder o termo devolveria isto ao terreno do vocabulario.
 * 2. As quatro caixas ficam na MESMA tela, visiveis ao mesmo tempo. E
 *    desconfortavel de proposito: e essa visao lado a lado que faz o aluno
 *    perceber sozinho que escreveu a frase alema com a ordem do russo.
 */
export function ProductionRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const [sentences, setSentences] = useState<Record<string, string>>({});
  const [evaluation, setEvaluation] = useState<ProductionEvaluation | null>(null);

  const mission = useQuery<ProductionMission>({
    queryKey: ['concepts', 'production'],
    queryFn: async () => (await api.get('/concepts/production/mission')).data,
    retry: false,
  });

  const evaluate = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/concepts/production/evaluate', {
        conceptId: mission.data!.conceptId,
        sentences: Object.entries(sentences).map(([languageCode, sentence]) => ({
          languageCode,
          sentence,
        })),
      });
      return data as ProductionEvaluation;
    },
    onSuccess: setEvaluation,
  });

  if (mission.isPending) {
    return (
      <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
        <span className="animate-float text-6xl">🎤</span>
        <p className="text-lg font-black">Escolhendo o conceito...</p>
        <p className="max-w-sm text-sm font-semibold text-wolf">
          Vai ser um que você já domina — produção livre só mede o que assentou.
        </p>
      </div>
    );
  }

  if (mission.isError || !mission.data) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <span className="text-6xl">🌱</span>
          <p className="text-lg font-black">Ainda não</p>
          <p className="max-w-sm text-sm font-semibold text-wolf">
            {errorMessage(mission.error)}
          </p>
        </div>
        <LessonFooter tone="neutral">
          <button className="btn-primary px-8" onClick={onSkip}>
            Seguir
          </button>
        </LessonFooter>
      </>
    );
  }

  if (evaluation) {
    return <Result evaluation={evaluation} onFinish={onFinish} />;
  }

  const written = mission.data.targets.filter((t) => (sentences[t.languageCode] ?? '').trim());

  return (
    <>
      <div className="space-y-4">
        <div className="card space-y-1.5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-hare">
            escreva isto em todos os idiomas
          </p>
          <h2 className="text-2xl font-black leading-tight">{mission.data.gloss}</h2>
          <p className="text-sm font-semibold text-wolf">
            Uma frase inteira em cada idioma, usando o termo indicado. Sem alternativas: é
            você contra a memória.
          </p>
        </div>

        {mission.data.targets.map((target) => {
          const theme = languageTheme(target.languageCode);
          const value = sentences[target.languageCode] ?? '';

          return (
            <div
              key={target.languageCode}
              className={`rounded-2xl border-2 p-3.5 ${theme.border} ${value.trim() ? theme.soft : 'bg-white'}`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span aria-hidden className="text-lg">
                  {theme.flag}
                </span>
                <span className={`text-sm font-black ${theme.text}`}>{target.term}</span>
                <span className="truncate text-xs font-semibold text-hare">{target.meaning}</span>
              </div>

              <textarea
                className="input min-h-[4.5rem] resize-y text-base"
                value={value}
                onChange={(e) =>
                  setSentences((s) => ({ ...s, [target.languageCode]: e.target.value }))
                }
                placeholder={`Sua frase em ${target.languageName}`}
              />
            </div>
          );
        })}

        {evaluate.isError && (
          <p className="rounded-xl bg-cardinal-soft px-3 py-2 text-sm font-bold text-cardinal-dark">
            {errorMessage(evaluate.error)}
          </p>
        )}
      </div>

      <LessonFooter
        detail={
          written.length === mission.data.targets.length
            ? 'As quatro escritas. A correção compara uma com a outra.'
            : `${written.length} de ${mission.data.targets.length} escritas. Pode enviar incompleto.`
        }
      >
        <button className="btn-plain" onClick={onSkip}>
          Pular bloco
        </button>
        <button
          className="btn-primary flex-1 px-10 sm:flex-none"
          onClick={() => evaluate.mutate()}
          disabled={written.length === 0 || evaluate.isPending}
        >
          {evaluate.isPending ? 'Corrigindo...' : 'Corrigir'}
        </button>
      </LessonFooter>
    </>
  );
}

function Result({
  evaluation,
  onFinish,
}: {
  evaluation: ProductionEvaluation;
  onFinish: (score: number) => void;
}) {
  const acertos = evaluation.results.filter((r) => r.ok).length;

  return (
    <>
      <div className="space-y-4">
        <div className="card flex flex-col items-center gap-2 text-center">
          <span className="animate-pop text-6xl">{evaluation.score >= 70 ? '🎉' : '💪'}</span>
          <p className="text-xl font-black">
            {acertos} de {evaluation.results.length} frases naturais
          </p>
          <p className="text-sm font-semibold text-wolf">{evaluation.gloss}</p>
        </div>

        {/* A leitura do conjunto vem antes das correcoes individuais: e o que
            este exercicio tem de proprio, e ela some se ficar no rodape. */}
        {evaluation.insight && (
          <div className="card border-humpback bg-humpback-soft">
            <p className="section-title mb-1.5">Olhando as quatro juntas</p>
            <p className="text-sm font-semibold leading-relaxed text-humpback-dark">
              {evaluation.insight}
            </p>
          </div>
        )}

        {evaluation.results.map((result) => {
          const theme = languageTheme(result.languageCode);

          return (
            <div
              key={result.languageCode}
              className={`card space-y-2.5 ${result.ok ? 'border-grass' : 'border-cardinal'}`}
            >
              <div className="flex items-center gap-2">
                <span aria-hidden className="text-lg">
                  {theme.flag}
                </span>
                <span className="flex-1 text-sm font-black">{result.languageName}</span>
                <span
                  className={`chip ${result.ok ? 'bg-grass-soft text-grass-dark' : 'bg-cardinal-soft text-cardinal-dark'}`}
                >
                  {result.ok ? 'natural' : `${result.score}%`}
                </span>
              </div>

              {result.corrected && (
                <div className="flex items-start gap-2.5 rounded-xl bg-snow p-3">
                  <p className="min-w-0 flex-1 font-bold leading-snug">{result.corrected}</p>
                  <AudioButton
                    text={result.corrected}
                    languageCode={result.languageCode}
                    size="sm"
                  />
                </div>
              )}

              {result.feedback && (
                <p className="text-sm font-semibold text-wolf">{result.feedback}</p>
              )}

              {result.errors.map((error, i) => (
                <div key={`${error.description}-${i}`} className="space-y-0.5">
                  <p className="text-sm font-black text-cardinal-dark">{error.description}</p>
                  {error.explanation && (
                    <p className="text-xs font-semibold text-wolf">{error.explanation}</p>
                  )}
                  {/* A origem da interferencia e o dado mais util da correcao:
                      diz ao aluno qual dos outros idiomas dele produziu o erro. */}
                  {error.sourceLanguage && (
                    <span className="chip bg-bee-soft text-bee-dark">
                      {languageTheme(error.sourceLanguage).flag} interferência do{' '}
                      {LANGUAGE_NAME[error.sourceLanguage] ?? error.sourceLanguage}
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <LessonFooter
        tone={evaluation.score >= 70 ? 'correct' : 'neutral'}
        title={`${evaluation.score}% no conjunto`}
        detail="Os erros entraram no seu perfil, com a origem junto."
      >
        <button className="btn-primary px-8" onClick={() => onFinish(evaluation.score)}>
          Continuar
        </button>
      </LessonFooter>
    </>
  );
}

const LANGUAGE_NAME: Record<string, string> = {
  en: 'inglês',
  es: 'espanhol',
  de: 'alemão',
  ru: 'russo',
  pt: 'português',
};
