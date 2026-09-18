import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AnswerInput } from '../../components/AnswerField';
import { AnswerOption, OptionState } from '../../components/AnswerOption';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter } from '../../components/LessonFooter';
import { ProgressBar } from '../../components/ProgressBar';
import { languageTheme } from '../../lib/ui';
import { api, errorMessage } from '../../services/api';
import { Drill } from './types';

const TYPE_LABEL: Record<string, { chip: string; label: string; hint: string }> = {
  align: {
    chip: 'bg-humpback-soft text-humpback-dark',
    label: 'Mapa',
    hint: 'Qual idioma te ajuda neste ponto?',
  },
  mirror: {
    chip: 'bg-macaw-soft text-macaw-dark',
    label: 'Espelho',
    hint: 'Você tem a frase nos outros idiomas. Complete a que falta.',
  },
  trap: {
    chip: 'bg-cardinal-soft text-cardinal-dark',
    label: 'Armadilha',
    hint: 'Esta frase está errada. Escreva a versão correta.',
  },
};

/**
 * Comparacao tolerante das respostas escritas.
 *
 * O aluno esta treinando estrutura, nao digitacao: acento, maiuscula e
 * pontuacao final nao podem transformar um acerto conceitual em erro. O que
 * NAO e normalizado sao as letras em si -- trocar "den" por "der" continua
 * errado, que e justamente o ponto do exercicio.
 */
function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    // Propriedade unicode em vez de um intervalo de combining marks literais:
    // esses caracteres sao invisiveis no editor e nao sobrevivem a uma
    // gravacao com encoding diferente -- a regex passaria a nao remover
    // acento nenhum, em silencio.
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[.,!?;:]/g, '')
    // Quando o exercicio tem duas lacunas, a resposta vem como "schaltet … ein"
    // -- o separador e da notacao, nao da lingua. Sem remove-lo, o aluno que
    // digita "schaltet ein" (a unica coisa razoavel a digitar) erraria.
    .replace(/…|\.\.\./g, ' ')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function DrillRunner({
  topicId,
  languageCode,
  title,
  onDone,
}: {
  topicId: string;
  languageCode: string;
  title: string;
  onDone: () => void;
}) {
  const [drills, setDrills] = useState<Drill[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [result, setResult] = useState<{ score: number; mastery: number } | null>(null);

  const generate = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/grammar/topics/${topicId}/drills`, { languageCode });
      return data as Drill[];
    },
    onSuccess: (data) => setDrills(data),
  });

  const record = useMutation({
    mutationFn: async (payload: { correct: number; total: number }) => {
      const { data } = await api.post(`/grammar/topics/${topicId}/record`, {
        languageCode,
        ...payload,
      });
      return data as { score: number; mastery: number };
    },
    onSuccess: (data) => setResult(data),
  });

  // ----- carregar -----
  if (!drills) {
    return (
      <div className="lesson-pad">
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <p className="font-serif text-lg font-semibold text-eel">
            {generate.isPending ? 'Montando os exercícios...' : title}
          </p>
          <p className="max-w-sm text-sm text-wolf">
            {generate.isError
              ? errorMessage(generate.error)
              : 'Frases paralelas e armadilhas de interferência, feitas em cima deste contraste.'}
          </p>
        </div>

        <LessonFooter tone={generate.isError ? 'wrong' : 'neutral'}>
          <button className="btn-plain" onClick={onDone}>
            Voltar
          </button>
          <button
            className="btn-primary flex-1 px-10 sm:flex-none"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? 'Gerando...' : generate.isError ? 'Tentar de novo' : 'Começar'}
          </button>
        </LessonFooter>
      </div>
    );
  }

  const drill = drills[index];
  const finished = Boolean(drills.length) && !drill;

  /*
   * Grava a rodada uma unica vez, ao chegar no fim. Fica num efeito, e nao no
   * corpo do componente, porque disparar mutation durante o render reenviaria
   * a rodada a cada re-render -- inflando `attempts` e sujando o dominio.
   */
  const recordMutate = record.mutate;
  useEffect(() => {
    if (finished) recordMutate({ correct, total: drills.length });
    // Roda so na virada para o fim da rodada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  // ----- fim da rodada -----
  if (finished) {
    const score = Math.round((correct / drills.length) * 100);

    return (
      <div className="lesson-pad">
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <p className="font-mono text-xl text-eel">
            {correct}/{drills.length}
          </p>
          <p className="font-serif text-base font-semibold text-eel">acertos nesta rodada</p>
          {result && (
            <p className="text-sm text-wolf">
              Domínio deste ponto: <span className="font-mono">{result.mastery}%</span>
            </p>
          )}
          <p className="max-w-sm text-sm text-wolf">
            {score >= 70
              ? 'O contraste está firmando. Volte daqui a alguns dias para confirmar.'
              : 'Vale reler a comparação lado a lado antes de treinar de novo.'}
          </p>
        </div>

        <LessonFooter tone={score >= 70 ? 'correct' : 'neutral'} title={`${score}% de acerto`}>
          <button className="btn-primary px-8" onClick={onDone}>
            Continuar
          </button>
        </LessonFooter>
      </div>
    );
  }

  const isCorrect = normalize(answer) === normalize(drill.answer);
  const meta = TYPE_LABEL[drill.type] ?? TYPE_LABEL.mirror;

  function next() {
    if (checked && isCorrect) setCorrect((c) => c + 1);
    setChecked(false);
    setAnswer('');
    setIndex((i) => i + 1);
  }

  return (
    /*
     * `lesson-pad` no lugar do `pb-32` chutado: o rodape fixo cresce quando a
     * resposta certa e uma frase inteira, e o chute deixava a propria correcao
     * escondida atras dele. A classe reserva a altura medida do rodape mais a
     * das abas.
     */
    <div className="lesson-pad space-y-4">
      <div className="flex items-center gap-3">
        <ProgressBar value={index} max={drills.length} size="sm" tone="bg-macaw" />
        <span className="shrink-0 font-mono text-xs text-hare">
          {index + 1}/{drills.length}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className={`chip ${meta.chip}`}>{meta.label}</span>
        <span className="min-w-0 text-xs text-hare">{meta.hint}</span>
      </div>

      {drill.gloss && drill.type !== 'align' && (
        <p className="text-sm text-hare">{drill.gloss}</p>
      )}

      {/* As versoes de apoio ficam ANTES da pergunta: e delas que o aluno deve
          deduzir a resposta, entao elas precisam ser lidas primeiro. */}
      {drill.shown.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-swan bg-snow p-3">
          {drill.shown.map((line, i) => (
            <div key={`${line.lang}-${i}`} className="flex items-center gap-2.5">
              <span aria-hidden className="w-6 shrink-0 text-center font-serif">
                {line.lang === 'pt' ? 'ã' : languageTheme(line.lang).mark}
              </span>
              {/* `min-w-0`: o texto precisa poder quebrar, senao um composto
                  alemao empurra o botao de audio para fora da tela. */}
              <span lang={line.lang} className="min-w-0 flex-1 font-medium">
                {line.text}
              </span>
              {line.lang !== 'pt' && <AudioButton text={line.text} languageCode={line.lang} />}
            </div>
          ))}
        </div>
      )}

      <p
        lang={languageCode}
        className={`font-serif text-xl font-semibold leading-snug ${
          drill.type === 'trap' && !checked ? 'text-cardinal-dark' : 'text-eel'
        }`}
      >
        {drill.sentence}
      </p>

      {drill.options?.length ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {drill.options.map((option) => {
            const selected = answer === option;
            const state: OptionState = !checked
              ? selected
                ? 'selected'
                : 'idle'
              : option === drill.answer
                ? 'correct'
                : selected
                  ? 'wrong'
                  : 'idle';

            return (
              <AnswerOption
                key={option}
                lang={languageCode}
                state={state}
                disabled={checked}
                onClick={() => setAnswer(option)}
              >
                {option}
              </AnswerOption>
            );
          })}
        </div>
      ) : (
        /* `AnswerInput` e obrigatorio aqui: o teclado em portugues corrigia
           `der` para `de` e a comparacao literal marcava de errado uma resposta
           certa. */
        <AnswerInput
          value={answer}
          onChange={setAnswer}
          languageCode={languageCode}
          disabled={checked}
          onSubmit={() => answer.trim() && setChecked(true)}
          placeholder={
            drill.type === 'trap'
              ? 'Escreva a frase corrigida'
              : (drill.sentence.match(/___/g)?.length ?? 0) > 1
                ? 'Complete as duas lacunas, na ordem'
                : 'Complete a lacuna'
          }
        />
      )}

      {checked ? (
        <LessonFooter
          tone={isCorrect ? 'correct' : 'wrong'}
          title={isCorrect ? 'Isso mesmo!' : `Resposta certa: ${drill.answer}`}
          detail={drill.explanation}
        >
          <button
            className={`${isCorrect ? 'btn-primary' : 'btn-danger'} flex-1 px-10 sm:flex-none`}
            onClick={next}
          >
            Continuar
          </button>
        </LessonFooter>
      ) : (
        <LessonFooter>
          <button className="btn-plain" onClick={onDone}>
            Sair
          </button>
          <button
            className="btn-primary flex-1 px-10 sm:flex-none"
            onClick={() => setChecked(true)}
            disabled={!answer.trim()}
          >
            Verificar
          </button>
        </LessonFooter>
      )}
    </div>
  );
}
