import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
      <div className="mx-auto max-w-3xl px-4 py-5">
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <span className={`text-6xl ${generate.isPending ? 'animate-float' : ''}`}>
            {generate.isError ? '🔌' : '🧩'}
          </span>
          <p className="text-lg font-black">
            {generate.isPending ? 'Montando os exercícios...' : title}
          </p>
          <p className="max-w-sm text-sm font-semibold text-wolf">
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
      <div className="mx-auto max-w-3xl px-4 py-5">
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <span className="animate-pop text-6xl">{score >= 70 ? '🎉' : '💪'}</span>
          <p className="text-xl font-black">
            {correct} de {drills.length} acertos
          </p>
          {result && (
            <p className="text-sm font-semibold text-wolf">
              Domínio deste ponto: <strong>{result.mastery}%</strong>
            </p>
          )}
          <p className="max-w-sm text-sm font-semibold text-wolf">
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
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 pb-32">
      <div className="flex items-center gap-3">
        <ProgressBar value={index} max={drills.length} size="sm" tone="bg-macaw" />
        <span className="shrink-0 text-xs font-extrabold uppercase tracking-wider text-hare">
          {index + 1}/{drills.length}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className={`chip ${meta.chip}`}>{meta.label}</span>
        <span className="text-xs font-bold text-hare">{meta.hint}</span>
      </div>

      {drill.gloss && drill.type !== 'align' && (
        <p className="text-sm font-extrabold uppercase tracking-wider text-hare">{drill.gloss}</p>
      )}

      {/* As versoes de apoio ficam ANTES da pergunta: e delas que o aluno deve
          deduzir a resposta, entao elas precisam ser lidas primeiro. */}
      {drill.shown.length > 0 && (
        <div className="space-y-1.5 rounded-2xl border-2 border-swan bg-snow p-3">
          {drill.shown.map((line, i) => {
            const theme = languageTheme(line.lang);
            return (
              <div key={`${line.lang}-${i}`} className="flex items-center gap-2.5">
                <span className="w-6 shrink-0 text-center">
                  {line.lang === 'pt' ? '🇧🇷' : theme.flag}
                </span>
                <span className="flex-1 font-bold">{line.text}</span>
                {line.lang !== 'pt' && <AudioButton text={line.text} languageCode={line.lang} />}
              </div>
            );
          })}
        </div>
      )}

      <p
        className={`text-xl font-black leading-snug ${
          drill.type === 'trap' && !checked ? 'text-cardinal-dark' : ''
        }`}
      >
        {drill.sentence}
      </p>

      {drill.options?.length ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {drill.options.map((option) => {
            const selected = answer === option;
            const state = !checked
              ? selected
                ? 'border-macaw bg-macaw-soft text-macaw-dark'
                : 'border-swan bg-white hover:bg-snow'
              : option === drill.answer
                ? 'border-grass bg-grass-soft text-grass-dark'
                : selected
                  ? 'border-cardinal bg-cardinal-soft text-cardinal-dark'
                  : 'border-swan bg-white text-hare';

            return (
              <button
                key={option}
                onClick={() => !checked && setAnswer(option)}
                disabled={checked}
                className={`rounded-2xl border-2 border-b-[4px] px-4 py-3.5 text-left font-bold capitalize transition active:translate-y-[2px] active:border-b-2 ${state}`}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          className="input text-lg"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={checked}
          placeholder={
            drill.type === 'trap'
              ? 'Escreva a frase corrigida'
              : (drill.sentence.match(/___/g)?.length ?? 0) > 1
                ? 'Complete as duas lacunas, na ordem'
                : 'Complete a lacuna'
          }
          autoFocus
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
