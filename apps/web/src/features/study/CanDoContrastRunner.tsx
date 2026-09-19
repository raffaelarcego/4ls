import { useQuery } from '@tanstack/react-query';
import { AudioButton } from '../../components/AudioButton';
import { LessonFooter, SkipButton } from '../../components/LessonFooter';
import { languageTheme } from '../../lib/ui';
import { api, errorMessage } from '../../services/api';
import {
  CanDoNote,
  CanDoRealization,
  CanDoSentence,
  CanDoToday,
  SessionActivity,
} from '../../types';

/**
 * A can-do do dia. Os dois blocos que abrem e fecham a sessao leem a MESMA
 * resposta -- o contraste mostra as quatro frases, a comparacao cobra as
 * quatro de memoria --, entao a consulta mora aqui e o cache do react-query
 * garante que o fim do dia cobre exatamente o que a abertura mostrou.
 */
export function useCanDoToday() {
  return useQuery<CanDoToday>({
    queryKey: ['cando', 'today'],
    queryFn: async () => (await api.get('/cando/today')).data,
    retry: false,
  });
}

/**
 * As ideias com pelo menos uma realizacao -- o resto nao tem o que mostrar.
 *
 * O conteudo chega agrupado por IDEIA e nao por idioma, e e esse o eixo certo:
 * a ideia e o que os quatro compartilham, e e so vendo as quatro realizacoes
 * da mesma ideia juntas que a diferenca entre elas aparece.
 */
export function canDoIdeas(canDo: CanDoToday | undefined): CanDoSentence[] {
  return (canDo?.sentences ?? []).filter((idea) => (idea?.realizations ?? []).length > 0);
}

/** As realizacoes de uma ideia, ja sem as que vieram sem frase. */
export function realizationsOf(idea: CanDoSentence | undefined): CanDoRealization[] {
  return (idea?.realizations ?? []).filter((r) => (r?.sentence ?? '').trim().length > 0);
}

/**
 * Nome de exibicao do idioma.
 *
 * O nome so existe na matricula (`languages`), nunca junto da frase: o
 * conteudo identifica o idioma pelo codigo. Sem a matricula o codigo cru ainda
 * e melhor do que uma celula vazia.
 */
export function canDoLanguageName(canDo: CanDoToday | undefined, code: string): string {
  return (canDo?.languages ?? []).find((l) => l?.code === code)?.name ?? code.toUpperCase();
}

/** O comentario curado daquele idioma nesta can-do, se o catalogo trouxe. */
export function canDoNoteFor(canDo: CanDoToday | undefined, code: string): CanDoNote | undefined {
  return (canDo?.notes ?? []).find((n) => n?.languageCode === code);
}

/** As colunas que esta realizacao NAO preenche, na ordem do cabecalho. */
function missingColumns(realization: CanDoRealization, columns: string[]): string[] {
  const filled = new Set((realization.parts ?? []).map((p) => p?.column));
  return columns.filter((column) => !filled.has(column));
}

/**
 * Bloco de contraste -- a ABERTURA do dia.
 *
 * O pedido do produto e literal: aprender as mesmas coisas nos quatro idiomas,
 * para saber exatamente como fazer a mesma coisa em cada um. Isso exige uma
 * tela onde os quatro aparecam resolvendo a MESMA funcao, e nao quatro aulas
 * sobre assuntos diferentes que por acaso acontecem no mesmo dia.
 *
 * Quatro decisoes que a tela carrega:
 *
 * 1. Ele ABRE o dia, e a comparacao de memoria fecha. A ordem nao e estetica:
 *    intercalar quatro idiomas antes do contraste explicito sobrecarrega um
 *    iniciante -- primeiro se ve a diferenca enunciada, depois se cobra.
 * 2. O agrupamento e por IDEIA: cada card traz uma ideia em portugues e logo
 *    abaixo as quatro maneiras de dize-la. Agrupar por idioma obrigaria a
 *    rolar de um card ao outro para comparar duas frases que dizem a mesma
 *    coisa -- e comparar e a unica razao desta tela existir.
 * 3. A licao e a ORDEM das colunas, nao as palavras. Por isso cada frase e
 *    exibida fatiada e numerada pela coluna que cada peca ocupa, e existe um
 *    mapa no fim com so os numeros: e ali que "1 2 3" contra "1 3 2" aparece
 *    sem precisar de tabela -- uma tabela de quatro colunas nao cabe em 360px,
 *    e encolher a fonte ate caber destroi justamente o que se quer notar.
 * 4. NAO HA exercicio aqui. O bloco e de notar, e medir o que acabou de ser
 *    lido mediria memoria de curtissimo prazo. A cobranca e no fim do dia.
 */
export function CanDoContrastRunner({
  onFinish,
  onSkip,
}: {
  activity: SessionActivity;
  onFinish: (score: number) => void;
  onSkip: () => void;
}) {
  const today = useCanDoToday();

  if (today.isPending) {
    return (
      <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
        <p className="font-serif text-lg font-semibold text-eel">Abrindo a função de hoje...</p>
        <p className="max-w-sm text-sm text-wolf">
          Uma só coisa para dizer, e as quatro maneiras de dizer.
        </p>
      </div>
    );
  }

  if (today.isError || !today.data) {
    return (
      <>
        <div className="card flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <p className="font-serif text-lg font-semibold text-eel">
            Não consegui abrir o contraste
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
  const columns = canDo.columns ?? [];
  const ideas = canDoIdeas(canDo);
  /* O mapa da ordem le a primeira ideia: as tres repetem o mesmo arranjo de
     colunas, e repetir o mapa tres vezes so diluiria o que ele mostra. */
  const first = realizationsOf(ideas[0]);
  /* So comenta idioma que apareceu em alguma frase -- nota sobre um idioma que
     a aula nao realizou e texto sem referente na tela. */
  const seen = new Set(ideas.flatMap((idea) => realizationsOf(idea).map((r) => r.languageCode)));
  const notes = (canDo.notes ?? []).filter((n) => seen.has(n?.languageCode));

  return (
    <>
      <div className="space-y-4">
        <div className="card space-y-2">
          <p className="font-mono text-xs text-hare">
            abertura do dia{canDo.level ? `, nível ${canDo.level}` : ''}
          </p>
          {/* A funcao vem em portugues e vem primeiro: e o unico enunciado que
              os quatro idiomas compartilham, e sem ele a tela vira uma lista
              de frases soltas. */}
          <h2 className="font-serif text-2xl font-semibold leading-tight text-eel">
            {canDo.question}
          </h2>
          {canDo.goal && <p className="text-sm leading-relaxed text-wolf">{canDo.goal}</p>}
        </div>

        {ideas.length === 0 ? (
          <div className="card">
            <p className="text-sm text-wolf">
              A função de hoje ainda não tem as frases dos quatro idiomas prontas.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <p className="section-title">A mesma coisa, nos quatro</p>
              {ideas.map((idea, i) => (
                <IdeaCard
                  key={`${idea.gloss}-${i}`}
                  idea={idea}
                  columns={columns}
                  canDo={canDo}
                  showColumns={i === 0}
                />
              ))}
            </div>

            {columns.length > 0 && first.length > 0 && (
              <OrderMap columns={columns} realizations={first} />
            )}
          </>
        )}

        {notes.length > 0 && (
          <div className="space-y-3">
            <p className="section-title">O que cada um exige</p>
            {notes.map((note) => (
              <NoteCard
                key={note.languageCode}
                note={note}
                name={canDoLanguageName(canDo, note.languageCode)}
              />
            ))}
          </div>
        )}

        {canDo.contrast && (
          <div className="card border-humpback bg-humpback-soft">
            <p className="section-title mb-1.5">O que muda de um para o outro</p>
            <p className="text-sm leading-relaxed text-humpback-dark">{canDo.contrast}</p>
          </div>
        )}
      </div>

      <LessonFooter detail="No fim do dia esta mesma função volta, nos quatro idiomas e sem consulta.">
        <SkipButton onSkip={onSkip} />
        {/* Bloco de leitura: nao ha o que pontuar, e inventar uma nota aqui
            sujaria a media do dia com algo que nao foi medido. */}
        <button className="btn-primary flex-1 px-10 sm:flex-none" onClick={() => onFinish(100)}>
          Entendi
        </button>
      </LessonFooter>
    </>
  );
}

/**
 * Uma ideia e as quatro maneiras de dize-la.
 *
 * O titulo e a ideia em portugues, e as realizacoes vem empilhadas logo abaixo:
 * empilhadas, e nao em colunas, porque quatro colunas em 360px cortariam as
 * quatro frases -- e a comparacao que interessa e entre linhas inteiras.
 */
function IdeaCard({
  idea,
  columns,
  canDo,
  showColumns,
}: {
  idea: CanDoSentence;
  columns: string[];
  canDo: CanDoToday;
  /** A legenda das colunas so no primeiro card: repeti-la tres vezes e ruido. */
  showColumns: boolean;
}) {
  const realizations = realizationsOf(idea);

  return (
    <div className="card space-y-3">
      <div>
        <p className="section-label mb-0.5">A ideia</p>
        <h3 className="font-serif text-lg font-semibold leading-snug text-eel">{idea.gloss}</h3>
        {showColumns && columns.length > 0 && (
          <p className="mt-1 font-mono text-[11px] leading-snug text-hare">
            {columns.map((column, i) => `${i + 1} ${column}`).join('   ')}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {realizations.map((realization, i) => (
          <Realization
            key={`${realization.languageCode}-${i}`}
            realization={realization}
            columns={columns}
            name={canDoLanguageName(canDo, realization.languageCode)}
          />
        ))}
      </div>
    </div>
  );
}

function Realization({
  realization,
  columns,
  name,
}: {
  realization: CanDoRealization;
  columns: string[];
  name: string;
}) {
  const code = realization.languageCode;
  const theme = languageTheme(code);
  const parts = realization.parts ?? [];
  const missing = missingColumns(realization, columns);

  return (
    <div className={`rounded-lg border bg-white p-3 ${theme.border}`}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className={`font-mono text-base ${theme.text}`}>{theme.mark}</span>
        <span className="text-sm font-medium text-eel">{name}</span>
      </div>

      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <p lang={code} className="font-serif text-lg font-semibold leading-snug text-eel">
            {realization.sentence}
          </p>
          {/* O russo chega em cirilico e ele esta aprendendo o alfabeto agora:
              sem a transliteracao a frase e um desenho, nao uma frase. */}
          {realization.romanization && (
            <p className="font-mono text-xs leading-snug text-hare">{realization.romanization}</p>
          )}
        </div>
        <AudioButton text={realization.sentence} languageCode={code} size="sm" />
      </div>

      {/*
        A frase fatiada na ordem em que ESTE idioma a monta, cada peca marcada
        com o numero da coluna. As pecas quebram linha em vez de rolarem de
        lado: em 360px uma faixa rolavel esconderia justamente a peca final,
        que e onde alemao e russo se separam dos outros dois.
      */}
      {(parts.length > 0 || missing.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {parts.map((part, i) => {
            const position = columns.indexOf(part.column);
            return (
              <span
                key={`${part.text}-${i}`}
                className="min-w-0 rounded-md border border-swan bg-snow px-2.5 py-1.5"
              >
                <span className="block font-mono text-[11px] leading-tight text-hare">
                  {position >= 0 ? `${position + 1} ` : ''}
                  {part.column}
                </span>
                <span lang={code} className="block text-sm font-medium leading-tight text-eel">
                  {part.text}
                </span>
              </span>
            );
          })}

        </div>
      )}

      {/*
        A coluna que este idioma NAO preenche fica na tela, mas FORA da fileira
        da frase.
        
        Ela ja esteve junto das outras pecas, e ali mentia: no russo, o "2 SER"
        vazio caia depois do "3 O QUE" e dava a entender que o russo poe o verbo
        no fim -- quando o que acontece e que ele nao tem verbo nenhum ali. A
        ausencia e a licao ("Soy brasileño." sem QUEM, "Я бразилец." sem SER),
        mas ela nao tem posicao na frase, entao nao pode ocupar lugar na
        sequencia que ensina a ordem.
      */}
      {missing.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t border-dashed border-swan pt-1.5">
          <span className="font-mono text-[11px] text-hare">não usa</span>
          {missing.map((column) => {
            const position = columns.indexOf(column);
            return (
              <span
                key={`vazio-${column}`}
                className="rounded-md border border-dashed border-swan bg-snow px-2 py-1 font-mono text-[11px] text-hare"
              >
                {position >= 0 ? `${position + 1} ` : ''}
                {column}
              </span>
            );
          })}
        </div>
      )}

      {realization.note && (
        <p className="mt-2 text-sm leading-relaxed text-wolf">{realization.note}</p>
      )}
    </div>
  );
}

/** O comentario curado de um idioma, com a armadilha destacada. */
function NoteCard({ note, name }: { note: CanDoNote; name: string }) {
  const theme = languageTheme(note.languageCode);

  return (
    <div className={`rounded-lg border bg-white p-3.5 ${theme.border}`}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className={`font-mono text-base ${theme.text}`}>{theme.mark}</span>
        <span className="text-sm font-medium text-eel">{name}</span>
      </div>

      {note.note && <p className="text-sm leading-relaxed text-wolf">{note.note}</p>}

      {/* A armadilha e o texto mais valioso da tela: e o erro que ele comete com
          confianca, e erro confiante nao se desfaz com exposicao. Por isso ela
          ganha moldura e cor propria em vez de virar mais uma linha da nota. */}
      {note.trap && (
        <div className="mt-2.5 rounded-md border border-cardinal bg-cardinal-soft px-3 py-2.5">
          <p className="section-title mb-1 text-cardinal-dark">Onde o português te trai</p>
          <p className="text-sm leading-relaxed text-cardinal-dark">{note.trap}</p>
        </div>
      )}
    </div>
  );
}

/**
 * O mapa da ordem: cada idioma reduzido aos numeros das colunas, na ordem em
 * que ele as preenche.
 *
 * E a unica parte da tela em que os quatro idiomas aparecem de fato juntos, e
 * ela so cabe em 360px porque abandonou o texto: quatro linhas de tres ou
 * quatro numeros cabem sem rolagem, e "1 2 3" contra "3 2 1" diz a regra mais
 * rapido do que qualquer frase enunciando-a.
 *
 * A coluna nao preenchida entra como casa tracejada no fim da linha: sem ela,
 * "1 2 3" contra "2 3" pareceria falta de dado em vez de sujeito omitido.
 */
function OrderMap({
  columns,
  realizations,
}: {
  columns: string[];
  realizations: CanDoRealization[];
}) {
  return (
    <div className="card space-y-2.5">
      <div>
        <p className="section-title">A ordem, lado a lado</p>
        <p className="mt-0.5 font-mono text-[11px] leading-snug text-hare">
          {columns.map((column, i) => `${i + 1} ${column}`).join('   ')}
        </p>
      </div>

      <div className="space-y-1.5">
        {realizations.map((realization, index) => {
          const theme = languageTheme(realization.languageCode);
          const parts = realization.parts ?? [];
          const missing = missingColumns(realization, columns);
          return (
            <div
              key={`${realization.languageCode}-${index}`}
              className="flex items-center gap-2"
              lang={realization.languageCode}
            >
              <span className={`w-5 shrink-0 font-mono text-base ${theme.text}`}>{theme.mark}</span>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {parts.map((part, i) => {
                  const position = columns.indexOf(part.column);
                  return (
                    <span
                      key={`${part.column}-${i}`}
                      className={`rounded-md border px-2 py-1 font-mono text-xs ${
                        position >= 0
                          ? `${theme.border} ${theme.soft} ${theme.text}`
                          : 'border-swan bg-snow text-hare'
                      }`}
                    >
                      {position >= 0 ? position + 1 : '·'}
                    </span>
                  );
                })}
                {missing.map((column) => (
                  <span
                    key={`vazio-${column}`}
                    title={`Sem ${column}`}
                    className="rounded-md border border-dashed border-swan bg-snow px-2 py-1 font-mono text-xs text-hare"
                  >
                    <span aria-hidden="true">·</span>
                    <span className="sr-only">{`sem ${column}`}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
