import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { AnswerTextarea } from '../../components/AnswerField';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter, SkipButton } from '../../components/LessonFooter';
import { languageTheme } from '../../lib/ui';
import { api, errorMessage } from '../../services/api';
import { CanDoNote, CanDoRealization, SessionActivity } from '../../types';
import {
  canDoIdeas,
  canDoLanguageName,
  canDoNoteFor,
  realizationsOf,
  useCanDoToday,
} from './CanDoContrastRunner';

/**
 * Bloco de comparacao -- o FECHAMENTO do dia.
 *
 * E o mesmo enunciado que abriu a sessao, agora sem nenhuma das quatro frases
 * na tela: ele produz de memoria. O par contraste/comparacao so ensina nesta
 * ordem -- a abertura mostra a diferenca enunciada, o fechamento cobra a
 * recuperacao, que e o que de fato fixa. Inverter os dois transformaria o dia
 * inteiro em reconhecimento.
 *
 * A cobranca e sobre UMA ideia, nao sobre as tres da aula. E a primeira, a
 * mesma que abriu o contraste: pedir as tres multiplicaria a tela por tres no
 * momento em que ele ja esta no fim do dia, e o que se mede -- "eu saberia
 * dizer isto nos quatro?" -- ja se mede com uma.
 *
 * UM IDIOMA POR TELA, como na producao quadrupla. As quatro caixas juntas ja
 * foram tentadas e nao sobreviveram ao celular: o teclado cobria a terceira e a
 * quarta, entao escrever em russo era digitar as cegas. O que ele ja escreveu
 * fica visivel acima em texto -- que e o andaime comparativo de verdade, e nao
 * disputa espaco com o teclado.
 *
 * A correcao e dele. O que se mede aqui ("eu saberia dizer isto?") nao
 * sobrevive a uma comparacao literal de strings: uma variante legitima marcada
 * como erro ensina o contrario do certo. A nota vai para o mastery da can-do.
 */
export function CanDoCompareRunner({
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const today = useCanDoToday();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  /** Idioma sendo escrito. Igual a quantidade de idiomas = tela de revelacao. */
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState(false);
  /** Autoavaliacao por idioma, decidida so depois de ver a frase modelo. */
  const [judged, setJudged] = useState<Record<string, boolean>>({});

  const record = useMutation({
    mutationFn: async (entry: { canDoId: string; languageCode: string; correct: number }) => {
      const { data } = await api.post('/cando/record', {
        canDoId: entry.canDoId,
        languageCode: entry.languageCode,
        correct: entry.correct,
        total: 1,
      });
      return data;
    },
  });

  if (today.isPending) {
    return (
      <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
        <p className="font-serif text-lg font-semibold text-eel">Retomando a função de hoje...</p>
        <p className="max-w-sm text-sm text-wolf">
          A mesma da abertura. Agora sem as frases na tela.
        </p>
      </div>
    );
  }

  if (today.isError || !today.data) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <p className="font-serif text-lg font-semibold text-eel">
            Não consegui abrir a comparação
          </p>
          <p className="max-w-sm text-sm text-wolf">{errorMessage(today.error)}</p>
        </div>
        <LessonFooter tone="wrong">
          <SkipButton onSkip={onSkip} />
          <button className="btn-primary px-8" onClick={() => today.refetch()}>
            Tentar de novo
          </button>
        </LessonFooter>
      </>
    );
  }

  const canDo = today.data;
  const idea = canDoIdeas(canDo)[0];
  /* As metas saem das realizacoes da ideia escolhida: e a frase daquele idioma
     que serve de modelo, e a ordem delas define a ordem das telas. */
  const targets = realizationsOf(idea);

  if (targets.length === 0) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <p className="font-serif text-lg font-semibold text-eel">Nada a comparar hoje</p>
          <p className="max-w-sm text-sm text-wolf">
            A função de hoje não trouxe as frases modelo dos idiomas.
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

  /*
   * O enunciado e a ideia em portugues, nao a pergunta da can-do: cobrar "como
   * digo quem eu sou?" aceitaria qualquer frase e nao daria o que comparar com
   * o modelo. A ideia e literalmente o mesmo significado nos quatro.
   */
  const meaning = (idea?.gloss ?? '').trim() || canDo.goal || canDo.question;

  const prompt = (
    <div className="card space-y-1.5">
      <p className="font-mono text-xs text-hare">fechamento do dia, de memória</p>
      <p className="text-xs text-hare">{canDo.question}</p>
      <h2 className="font-serif text-2xl font-semibold leading-tight text-eel">{meaning}</h2>
    </div>
  );

  /** Trilha dos idiomas: onde ele esta e o que ja escreveu. */
  const trail = (
    <div className="flex gap-2">
      {targets.map((target, i) => {
        const theme = languageTheme(target.languageCode);
        const done = (answers[target.languageCode] ?? '').trim().length > 0;
        const here = i === step && !revealed;
        return (
          <button
            key={target.languageCode}
            onClick={() => {
              if (revealed) return;
              setStep(i);
            }}
            aria-label={canDoLanguageName(canDo, target.languageCode)}
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

  if (revealed) {
    const decided = targets.filter((t) => judged[t.languageCode] !== undefined);
    const correct = targets.filter((t) => judged[t.languageCode]).length;
    const score = Math.round((correct / targets.length) * 100);

    return (
      <>
        <div className="space-y-4">
          {prompt}

          <div className="space-y-3">
            {targets.map((target) => (
              <Reveal
                key={target.languageCode}
                target={target}
                name={canDoLanguageName(canDo, target.languageCode)}
                note={canDoNoteFor(canDo, target.languageCode)}
                written={answers[target.languageCode] ?? ''}
                verdict={judged[target.languageCode]}
                onJudge={(ok) =>
                  setJudged((current) => ({
                    ...current,
                    [target.languageCode]: ok,
                  }))
                }
              />
            ))}
          </div>

          {canDo.contrast && (
            <div className="card border-humpback bg-humpback-soft">
              <p className="section-title mb-1.5">O que muda de um para o outro</p>
              <p className="text-sm leading-relaxed text-humpback-dark">{canDo.contrast}</p>
            </div>
          )}
        </div>

        <LessonFooter
          tone={decided.length < targets.length ? 'neutral' : score >= 70 ? 'correct' : 'wrong'}
          title={decided.length < targets.length ? undefined : `${correct} de ${targets.length}`}
          detail={
            decided.length < targets.length
              ? 'Julgue cada idioma: você diria assim?'
              : 'A nota de cada idioma entra no domínio desta função.'
          }
        >
          <button
            className="btn-primary flex-1 px-10 sm:flex-none"
            disabled={decided.length < targets.length}
            onClick={() => {
              /*
               * A gravacao e por idioma porque o dominio da can-do e por idioma:
               * acertar em espanhol e errar em russo tem que escolher blocos
               * diferentes amanha. Se a chamada falhar, o bloco conclui assim
               * mesmo -- perder o XP do dia por causa do servidor seria pior.
               */
              targets.forEach((target) =>
                record.mutate({
                  canDoId: canDo.canDoId,
                  languageCode: target.languageCode,
                  correct: judged[target.languageCode] ? 1 : 0,
                }),
              );
              onFinish(score);
            }}
          >
            Concluir
          </button>
        </LessonFooter>
      </>
    );
  }

  const target = targets[step];
  const name = canDoLanguageName(canDo, target.languageCode);
  const theme = languageTheme(target.languageCode);
  const written = targets.filter((t) => (answers[t.languageCode] ?? '').trim());
  const earlier = targets.slice(0, step).filter((t) => (answers[t.languageCode] ?? '').trim());

  return (
    <>
      <div className="space-y-4">
        {prompt}
        {trail}

        {/* As anteriores ficam a vista de proposito: e comparando com o que ele
            acabou de escrever que ele percebe sozinho que montou a frase alema
            com a ordem do russo. Sendo texto, nao briga com o teclado. */}
        {earlier.length > 0 && (
          <div className="space-y-1.5 rounded-lg bg-snow p-3">
            {earlier.map((t) => (
              <p key={t.languageCode} lang={t.languageCode} className="text-sm text-wolf">
                <span className={`mr-1.5 font-mono ${languageTheme(t.languageCode).text}`}>
                  {languageTheme(t.languageCode).mark}
                </span>
                {answers[t.languageCode]}
              </p>
            ))}
          </div>
        )}

        <div className={`rounded-lg border p-3.5 ${theme.border}`}>
          <div className="mb-2 flex items-center gap-2">
            <span className={`font-mono text-lg ${theme.text}`}>{theme.mark}</span>
            <span className="text-sm font-medium text-eel">{name}</span>
          </div>

          <AnswerTextarea
            value={answers[target.languageCode] ?? ''}
            onChange={(value) =>
              setAnswers((current) => ({
                ...current,
                [target.languageCode]: value,
              }))
            }
            languageCode={target.languageCode}
            rows={3}
            placeholder={`Sua frase em ${name}`}
          />
        </div>
      </div>

      <LessonFooter
        detail={
          step === targets.length - 1
            ? `${written.length} de ${targets.length} escritas. As frases certas aparecem depois.`
            : `${name}, ${step + 1} de ${targets.length}`
        }
      >
        {step > 0 ? (
          <button className="btn-plain" onClick={() => setStep((i) => i - 1)}>
            Voltar
          </button>
        ) : (
          <SkipButton onSkip={onSkip} />
        )}
        <button
          className="btn-primary flex-1 px-10 sm:flex-none"
          onClick={() => {
            if (step === targets.length - 1) setRevealed(true);
            else setStep((i) => i + 1);
          }}
        >
          {step === targets.length - 1 ? 'Ver as quatro' : 'Próximo idioma'}
        </button>
      </LessonFooter>
    </>
  );
}

/**
 * A revelacao de um idioma: o que ele escreveu, a frase modelo e o veredito.
 *
 * As duas ficam empilhadas e nao lado a lado -- em 360px duas colunas cortariam
 * as duas frases, e a comparacao que interessa e entre linhas inteiras.
 */
function Reveal({
  target,
  name,
  note,
  written,
  verdict,
  onJudge,
}: {
  target: CanDoRealization;
  name: string;
  note: CanDoNote | undefined;
  written: string;
  verdict: boolean | undefined;
  onJudge: (ok: boolean) => void;
}) {
  const code = target.languageCode;
  const theme = languageTheme(code);

  return (
    <div
      className={`rounded-lg border bg-white p-3.5 ${
        verdict === undefined ? theme.border : verdict ? 'border-grass' : 'border-cardinal'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={`font-mono text-lg ${theme.text}`}>{theme.mark}</span>
        <span className="flex-1 text-sm font-medium text-eel">{name}</span>
      </div>

      <div className="space-y-2">
        <div>
          <p className="section-label mb-0.5">Você escreveu</p>
          <p lang={code} className="text-base leading-snug text-eel">
            {written.trim() || <span className="text-hare">— em branco</span>}
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-md bg-snow p-3">
          <div className="min-w-0 flex-1">
            <p className="section-label mb-0.5">A frase</p>
            <p lang={code} className="font-serif text-lg font-semibold leading-snug text-eel">
              {target.sentence}
            </p>
            {/* Sem a transliteracao ele nao consegue nem conferir o que escreveu
                contra o modelo: o cirilico ainda esta sendo aprendido. */}
            {target.romanization && (
              <p className="font-mono text-xs leading-snug text-hare">{target.romanization}</p>
            )}
          </div>
          <AudioButton text={target.sentence} languageCode={code} size="sm" />
        </div>

        {/* O comentario da propria frase explica a diferenca que ele acabou de
            ver no modelo; a nota curada fala do idioma em geral. Nesta altura do
            dia a primeira e mais util, entao ela vem antes. */}
        {target.note && <p className="text-sm leading-relaxed text-wolf">{target.note}</p>}

        {note?.trap && (
          <div className="rounded-md border border-cardinal bg-cardinal-soft px-3 py-2.5">
            <p className="text-sm leading-relaxed text-cardinal-dark">{note.trap}</p>
          </div>
        )}
      </div>

      {/* Ele julga, nao a string: variante legitima marcada como erro ensinaria
          o contrario do certo, e o que se mede aqui e "eu saberia dizer isto?". */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => onJudge(false)}
          className={`tap-target rounded-md border px-3 py-2.5 text-sm transition-colors ${
            verdict === false
              ? 'border-cardinal bg-cardinal-soft text-cardinal-dark'
              : 'border-swan bg-white text-wolf'
          }`}
        >
          Não era isso
        </button>
        <button
          onClick={() => onJudge(true)}
          className={`tap-target rounded-md border px-3 py-2.5 text-sm transition-colors ${
            verdict === true
              ? 'border-grass bg-grass-soft text-grass-dark'
              : 'border-swan bg-white text-wolf'
          }`}
        >
          Eu diria assim
        </button>
      </div>
    </div>
  );
}
