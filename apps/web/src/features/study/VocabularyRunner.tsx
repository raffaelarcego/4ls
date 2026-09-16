import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter } from '../../components/LessonFooter';
import { ProgressBar } from '../../components/ProgressBar';
import { languageTheme } from '../../lib/ui';
import { api, errorMessage } from '../../services/api';
import { ConceptCard, SessionActivity } from '../../types';

/**
 * Bloco de vocabulario.
 *
 * A mudanca central do produto vive nesta tela: o aluno nunca ve uma palavra
 * sozinha. Cada card e um CONCEITO -- "trabalho" -- com as quatro realizacoes
 * lado a lado. Ver "work", "trabajo", "Arbeit" e "работа" juntas e o que faz
 * uma lingua sustentar a memoria das outras; separa-las seria transformar uma
 * memoria em quatro.
 *
 * Depois de estudar os cards vem um teste rapido, e ele e deliberadamente
 * CRUZADO: o enunciado mostra o termo em um idioma e pergunta o do outro. Um
 * teste que so cobrasse o idioma do bloco nao verificaria a unica coisa que
 * esta tela existe para ensinar -- que as quatro palavras sao a mesma coisa.
 */
export function VocabularyRunner({
  activity,
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'study' | 'quiz'>('study');

  const lesson = useQuery<ConceptCard[]>({
    queryKey: ['concepts', 'lesson', activity.languageCode],
    queryFn: async () => {
      const { data } = await api.get('/concepts/lesson', {
        params: { language: activity.languageCode, count: 5 },
      });
      return data;
    },
    retry: false,
  });

  if (lesson.isPending) {
    return (
      <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
        <span className="animate-float text-6xl">💬</span>
        <p className="text-lg font-black">Separando os conceitos de hoje...</p>
        <p className="max-w-sm text-sm font-semibold text-wolf">
          Os mesmos que você vai ver nos outros idiomas.
        </p>
      </div>
    );
  }

  const cards = lesson.data ?? [];

  if (lesson.isError || cards.length === 0) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <span className="text-6xl">🔌</span>
          <p className="text-lg font-black">Sem conceitos para hoje</p>
          <p className="max-w-sm text-sm font-semibold text-wolf">
            {lesson.isError
              ? errorMessage(lesson.error)
              : 'Todos os conceitos disponíveis já estão em revisão. Volte amanhã ou adicione palavras novas.'}
          </p>
        </div>
        <LessonFooter tone="neutral">
          <button className="btn-plain" onClick={onSkip}>
            Pular bloco
          </button>
          <button className="btn-primary px-8" onClick={() => lesson.refetch()}>
            Tentar de novo
          </button>
        </LessonFooter>
      </>
    );
  }

  if (phase === 'quiz') {
    return (
      <CrossCheck
        cards={cards}
        languageCode={activity.languageCode}
        onFinish={onFinish}
        onSkip={onSkip}
      />
    );
  }

  const card = cards[index];
  const isLast = index === cards.length - 1;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={cards.length} size="sm" tone="bg-macaw" />
          <span className="shrink-0 text-xs font-extrabold uppercase tracking-wider text-hare">
            {index + 1}/{cards.length}
          </span>
        </div>

        <div className="card space-y-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-hare">
              conceito · nível {card.level}
            </p>
            <h2 className="text-2xl font-black leading-tight">{card.gloss}</h2>
          </div>

          <div className="space-y-2.5">
            {card.entries.map((entry) => {
              const theme = languageTheme(entry.languageCode);
              const isTarget = entry.languageCode === activity.languageCode;

              return (
                <div
                  key={entry.languageCode}
                  className={`rounded-2xl border-2 px-3.5 py-3 ${
                    isTarget ? `${theme.border} ${theme.soft}` : 'border-swan bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="text-xl leading-none">
                      {theme.flag}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-lg font-black leading-snug ${isTarget ? theme.text : ''}`}>
                        {entry.term}
                      </p>
                      <p className="text-xs font-semibold text-wolf">{entry.meaning}</p>
                      {entry.example && (
                        <p className="mt-1.5 text-sm font-bold leading-snug">{entry.example}</p>
                      )}
                      {entry.translation && (
                        <p className="text-xs font-semibold italic text-hare">
                          {entry.translation}
                        </p>
                      )}
                    </div>
                    <AudioButton
                      text={entry.example || entry.term}
                      languageCode={entry.languageCode}
                      size="sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {card.note && (
            <p className="rounded-xl bg-snow px-3 py-2 text-xs font-semibold text-wolf">
              <span aria-hidden>🔎 </span>
              {card.note}
            </p>
          )}
        </div>
      </div>

      <LessonFooter
        detail="Os quatro idiomas entram juntos — é assim que um segura a memória do outro."
      >
        <button className="btn-plain" onClick={onSkip}>
          Pular bloco
        </button>
        <button
          className="btn-primary flex-1 px-10 sm:flex-none"
          onClick={() => (isLast ? setPhase('quiz') : setIndex((i) => i + 1))}
        >
          {isLast ? 'Testar' : 'Próximo'}
        </button>
      </LessonFooter>
    </>
  );
}

interface Question {
  conceptId: string;
  gloss: string;
  /** O idioma mostrado no enunciado. */
  fromCode: string;
  fromTerm: string;
  /** O idioma que o aluno precisa produzir. */
  toCode: string;
  answer: string;
  options: string[];
}

/**
 * Teste cruzado entre idiomas.
 *
 * Uma pergunta por conceito, sempre partindo de um idioma e cobrando OUTRO.
 * As alternativas erradas vem dos outros conceitos do mesmo dia e no MESMO
 * idioma da resposta -- distratores de outro idioma seriam eliminaveis pela
 * aparencia da palavra, e o aluno acertaria sem saber nada.
 */
function CrossCheck({
  cards,
  languageCode,
  onFinish,
  onSkip,
}: {
  cards: ConceptCard[];
  languageCode: string;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const questions = useMemo(() => buildQuestions(cards, languageCode), [cards, languageCode]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);

  if (questions.length === 0) {
    return (
      <LessonFooter detail="Não há conceitos suficientes para montar o teste.">
        <button className="btn-primary px-8" onClick={() => onFinish(70)}>
          Concluir
        </button>
      </LessonFooter>
    );
  }

  const question = questions[index];

  if (!question) {
    const score = Math.round((correct / questions.length) * 100);
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
          <span className="animate-pop text-6xl">{score >= 70 ? '🎉' : '💪'}</span>
          <p className="text-xl font-black">
            {correct} de {questions.length} acertos
          </p>
          <p className="text-sm font-semibold text-wolf">
            {score >= 70
              ? 'A rede entre os idiomas está firmando.'
              : 'Esses conceitos voltam amanhã, nos quatro idiomas.'}
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

  const checked = answer !== null;
  const isCorrect = answer === question.answer;
  const fromTheme = languageTheme(question.fromCode);
  const toTheme = languageTheme(question.toCode);

  function next() {
    if (isCorrect) setCorrect((c) => c + 1);
    setAnswer(null);
    setIndex((i) => i + 1);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ProgressBar value={index} max={questions.length} size="sm" tone="bg-macaw" />
          <span className="shrink-0 text-xs font-extrabold uppercase tracking-wider text-hare">
            {index + 1}/{questions.length}
          </span>
        </div>

        <div className="card space-y-3">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-hare">
            {question.gloss}
          </p>
          <div className="flex items-center gap-3">
            <span aria-hidden className="text-2xl">
              {fromTheme.flag}
            </span>
            <p className={`flex-1 text-2xl font-black ${fromTheme.text}`}>{question.fromTerm}</p>
            <AudioButton text={question.fromTerm} languageCode={question.fromCode} size="sm" />
          </div>
          <p className="text-sm font-bold text-wolf">
            <span aria-hidden>{toTheme.flag} </span>
            Como é isso em {languageName(question.toCode)}?
          </p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {question.options.map((option, i) => {
            const selected = answer === option;
            const state = !checked
              ? 'border-swan bg-white hover:bg-snow'
              : option === question.answer
                ? 'border-grass bg-grass-soft text-grass-dark'
                : selected
                  ? 'border-cardinal bg-cardinal-soft text-cardinal-dark'
                  : 'border-swan bg-white text-hare';

            return (
              <button
                key={option}
                onClick={() => !checked && setAnswer(option)}
                disabled={checked}
                className={`flex items-center gap-3 rounded-2xl border-2 border-b-[4px] px-4 py-3.5 text-left font-bold transition active:translate-y-[2px] active:border-b-2 ${state}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-current text-xs font-black opacity-60">
                  {i + 1}
                </span>
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {checked ? (
        <LessonFooter
          tone={isCorrect ? 'correct' : 'wrong'}
          title={isCorrect ? 'Isso mesmo!' : `Resposta certa: ${question.answer}`}
          detail={`"${question.gloss}" — o mesmo conceito nos quatro idiomas.`}
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
          <button className="btn-plain" onClick={onSkip}>
            Pular bloco
          </button>
        </LessonFooter>
      )}
    </>
  );
}

/**
 * Monta uma pergunta por conceito.
 *
 * O idioma cobrado alterna entre todos os que o conceito tem, comecando pelo
 * idioma do bloco: sem isso o bloco de ingles so cobraria ingles e a promessa
 * "aprendeu num, aprendeu nos quatro" nunca seria verificada.
 */
export function buildQuestions(cards: ConceptCard[], languageCode: string): Question[] {
  const questions: Question[] = [];

  cards.forEach((card, position) => {
    if (card.entries.length < 2) return;

    const codes = card.entries.map((e) => e.languageCode);
    const toCode = codes[position % codes.length];
    const from = card.entries.find((e) => e.languageCode !== toCode);
    const to = card.entries.find((e) => e.languageCode === toCode);
    if (!from || !to) return;

    // Distratores: o mesmo idioma da resposta, vindos dos outros conceitos de
    // hoje. Em outro idioma, a resposta se entregaria pela grafia.
    const distractors = cards
      .filter((other) => other.id !== card.id)
      .map((other) => other.entries.find((e) => e.languageCode === toCode)?.term)
      .filter((term): term is string => Boolean(term) && term !== to.term)
      .slice(0, 3);

    if (distractors.length === 0) return;

    questions.push({
      conceptId: card.id,
      gloss: card.gloss,
      fromCode: from.languageCode,
      fromTerm: from.term,
      toCode,
      answer: to.term,
      // Ordem estavel derivada da posicao: a resposta nao fica sempre no mesmo
      // lugar, e ainda assim nao muda a cada re-render do componente.
      options: rotate([to.term, ...distractors], position),
    });
  });

  return questions;
}

function rotate<T>(items: T[], by: number): T[] {
  const offset = ((by % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

const LANGUAGE_NAME: Record<string, string> = {
  en: 'inglês',
  es: 'espanhol',
  de: 'alemão',
  ru: 'russo',
  pt: 'português',
};

function languageName(code: string): string {
  return LANGUAGE_NAME[code] ?? code;
}
