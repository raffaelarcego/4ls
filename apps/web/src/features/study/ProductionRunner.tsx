import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AnswerTextarea } from '../../components/AnswerField';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter, SkipButton } from '../../components/LessonFooter';
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
 * 2. A comparacao lado a lado e o coracao do bloco: e ela que faz o aluno
 *    perceber sozinho que escreveu a frase alema com a ordem do russo. Ela
 *    acontece na REVISAO, com as quatro ja escritas -- e nao enquanto digita.
 *
 *    As quatro caixas ficavam juntas na mesma tela desde o inicio, e no celular
 *    isso nao entregava comparacao nenhuma: comparar duas caixas vazias nao
 *    ensina nada, e o teclado cobria a terceira e a quarta junto com o rodape,
 *    entao escrever em russo era digitar as cegas. Escrevendo um idioma por vez
 *    o teclado nunca disputa espaco, e as frases ja escritas ficam visiveis
 *    acima como apoio -- que e o andaime comparativo de verdade.
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
  /** Idioma sendo escrito. Igual a quantidade de alvos = tela de revisao. */
  const [step, setStep] = useState(0);

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
        <p className="font-serif text-lg font-semibold text-eel">Escolhendo o conceito...</p>
        <p className="max-w-sm text-sm text-wolf">
          Vai ser um que você já domina — produção livre só mede o que assentou.
        </p>
      </div>
    );
  }

  if (mission.isError || !mission.data) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <p className="font-serif text-lg font-semibold text-eel">Ainda não</p>
          <p className="max-w-sm text-sm text-wolf">{errorMessage(mission.error)}</p>
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

  const targets = mission.data.targets;
  const written = targets.filter((t) => (sentences[t.languageCode] ?? '').trim());
  const reviewing = step >= targets.length;
  const target = targets[step];

  const gloss = (
    <div className="card space-y-1.5">
      <p className="text-xs text-hare">Escreva isto em todos os idiomas</p>
      <h2 className="font-serif text-2xl font-semibold leading-tight text-eel">
        {mission.data.gloss}
      </h2>
    </div>
  );

  /** Trilha dos quatro idiomas: onde ele esta e o que ja escreveu. */
  const trail = (
    <div className="flex gap-2">
      {targets.map((t, i) => {
        const theme = languageTheme(t.languageCode);
        const done = (sentences[t.languageCode] ?? '').trim().length > 0;
        const here = i === step;
        return (
          <button
            key={t.languageCode}
            onClick={() => setStep(i)}
            aria-label={t.languageName}
            className={`tap-target flex flex-1 items-center justify-center rounded-md border font-mono text-base transition-colors ${
              here
                ? `${theme.border} ${theme.soft} ${theme.text}`
                : done
                  ? 'border-swan bg-white text-eel'
                  : 'border-swan bg-snow text-hare'
            }`}
          >
            {theme.mark}
          </button>
        );
      })}
    </div>
  );

  if (reviewing) {
    return (
      <>
        <div className="space-y-4">
          {gloss}
          {trail}

          {/*
            Aqui as quatro ficam juntas de novo, e agora a comparacao rende:
            todas escritas, lado a lado, antes de mandar corrigir.
          */}
          {targets.map((t) => {
            const theme = languageTheme(t.languageCode);
            return (
              <div key={t.languageCode} className={`rounded-lg border p-3 ${theme.border}`}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`font-mono ${theme.text}`}>{theme.mark}</span>
                  <span className="text-sm font-medium text-eel">{t.term}</span>
                  <span className="min-w-0 truncate text-xs text-hare">{t.meaning}</span>
                </div>
                <AnswerTextarea
                  value={sentences[t.languageCode] ?? ''}
                  onChange={(v) => setSentences((s) => ({ ...s, [t.languageCode]: v }))}
                  languageCode={t.languageCode}
                  rows={2}
                  placeholder={`Sua frase em ${t.languageName}`}
                />
              </div>
            );
          })}

          {evaluate.isError && (
            <p className="rounded-md bg-cardinal-soft px-3 py-2 text-sm text-cardinal-dark">
              {errorMessage(evaluate.error)}
            </p>
          )}
        </div>

        <LessonFooter
          detail={
            written.length === targets.length
              ? 'As quatro escritas. A correção compara uma com a outra.'
              : `${written.length} de ${targets.length} escritas. Pode enviar incompleto.`
          }
        >
          <button className="btn-plain" onClick={() => setStep(targets.length - 1)}>
            Voltar
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

  const theme = languageTheme(target.languageCode);
  const earlier = targets.slice(0, step).filter((t) => (sentences[t.languageCode] ?? '').trim());

  return (
    <>
      <div className="space-y-4">
        {gloss}
        {trail}

        {/* O que ele ja escreveu fica a vista: e o apoio comparativo enquanto
            escreve o proximo idioma, e nao atrapalha o teclado porque e texto. */}
        {earlier.length > 0 && (
          <div className="space-y-1.5 rounded-lg bg-snow p-3">
            {earlier.map((t) => (
              <p key={t.languageCode} className="text-sm text-wolf">
                <span className={`mr-1.5 font-mono ${languageTheme(t.languageCode).text}`}>
                  {languageTheme(t.languageCode).mark}
                </span>
                {sentences[t.languageCode]}
              </p>
            ))}
          </div>
        )}

        <div className={`rounded-lg border p-3.5 ${theme.border}`}>
          <div className="mb-2 flex items-center gap-2">
            <span className={`font-mono text-lg ${theme.text}`}>{theme.mark}</span>
            <span className="text-sm font-medium text-eel">{target.term}</span>
            <span className="min-w-0 truncate text-xs text-hare">{target.meaning}</span>
          </div>

          <AnswerTextarea
            value={sentences[target.languageCode] ?? ''}
            onChange={(v) => setSentences((s) => ({ ...s, [target.languageCode]: v }))}
            languageCode={target.languageCode}
            rows={3}
            placeholder={`Sua frase em ${target.languageName}`}
          />
        </div>
      </div>

      <LessonFooter detail={`${target.languageName}, ${step + 1} de ${targets.length}`}>
        {step > 0 ? (
          <button className="btn-plain" onClick={() => setStep((i) => i - 1)}>
            Voltar
          </button>
        ) : (
          <SkipButton onSkip={onSkip} />
        )}
        <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={() => setStep((i) => i + 1)}>
          {step === targets.length - 1 ? 'Revisar as quatro' : 'Próximo idioma'}
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
          <p className="font-mono text-3xl text-eel">
            {acertos}/{evaluation.results.length}
          </p>
          <p className="font-serif text-lg font-semibold text-eel">frases naturais</p>
          <p className="text-sm text-wolf">{evaluation.gloss}</p>
        </div>

        {/* A leitura do conjunto vem antes das correcoes individuais: e o que
            este exercicio tem de proprio, e ela some se ficar no rodape. */}
        {evaluation.insight && (
          <div className="card border-humpback bg-humpback-soft">
            <p className="section-title mb-1.5">Olhando as quatro juntas</p>
            <p className="text-sm leading-relaxed text-humpback-dark">{evaluation.insight}</p>
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
                <span className={`font-mono text-lg ${theme.text}`}>{theme.mark}</span>
                <span className="flex-1 text-sm font-medium text-eel">{result.languageName}</span>
                <span
                  className={`chip ${result.ok ? 'border-grass bg-grass-soft text-grass-dark' : 'border-cardinal bg-cardinal-soft text-cardinal-dark'}`}
                >
                  {result.ok ? 'natural' : `${result.score}%`}
                </span>
              </div>

              {result.corrected && (
                <div className="flex items-start gap-2.5 rounded-md bg-snow p-3">
                  <p className="min-w-0 flex-1 font-medium leading-snug text-eel">
                    {result.corrected}
                  </p>
                  <AudioButton
                    text={result.corrected}
                    languageCode={result.languageCode}
                    size="sm"
                  />
                </div>
              )}

              {result.feedback && <p className="text-sm text-wolf">{result.feedback}</p>}

              {result.errors.map((error, i) => (
                <div key={`${error.description}-${i}`} className="space-y-0.5">
                  <p className="text-sm font-medium text-cardinal-dark">{error.description}</p>
                  {error.explanation && <p className="text-xs text-wolf">{error.explanation}</p>}
                  {/* A origem da interferencia e o dado mais util da correcao:
                      diz ao aluno qual dos outros idiomas dele produziu o erro. */}
                  {error.sourceLanguage && (
                    <span className="chip border-bee bg-bee-soft text-bee-dark">
                      {languageTheme(error.sourceLanguage).mark} interferência do{' '}
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
