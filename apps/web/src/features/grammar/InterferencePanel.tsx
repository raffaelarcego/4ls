import { useQuery } from '@tanstack/react-query';
import { languageTheme } from '../../lib/ui';
import { api } from '../../services/api';
import { Interference } from '../../types';

const CATEGORY_LABEL: Record<string, string> = {
  VOCABULARY: 'vocabulário',
  GRAMMAR: 'gramática',
  WORD_ORDER: 'ordem das palavras',
  ARTICLE: 'artigos',
  TENSE: 'tempo verbal',
  PREPOSITION: 'preposições',
  FALSE_COGNATE: 'falsos cognatos',
  SPELLING: 'ortografia',
  PRONUNCIATION: 'pronúncia',
  COMPREHENSION: 'compreensão',
};

/**
 * Quais idiomas estao contaminando quais.
 *
 * E o dado que so este produto consegue produzir, porque so ele sabe quais sao
 * os outros idiomas do aluno. Antes, oito erros de ordem das palavras eram um
 * numero que nao dizia o que fazer; aqui eles viram "o russo esta entrando no
 * seu alemao" com o topico que resolve logo abaixo.
 *
 * Nao aparece sem dado. Um painel vazio prometendo analise e pior que nenhum
 * painel -- ele ocupa espaco na tela ensinando que aquele espaco nao serve
 * para nada.
 */
export function InterferencePanel({ onOpenTopic }: { onOpenTopic: (topicId: string) => void }) {
  const { data } = useQuery<Interference[]>({
    queryKey: ['errors', 'interference'],
    queryFn: async () => (await api.get('/errors/interference')).data,
    retry: false,
  });

  if (!data || data.length === 0) return null;

  return (
    <section className="space-y-2.5">
      <div>
        <p className="section-label">Um idioma entrando no outro</p>
        <p className="text-xs font-semibold text-wolf">
          Erros que vieram de importar a regra de outra língua que você estuda.
        </p>
      </div>

      {data.map((pair) => {
        const target = languageTheme(pair.languageCode);
        const source = languageTheme(pair.sourceCode);

        return (
          <div
            key={`${pair.languageCode}-${pair.sourceCode}`}
            className="card space-y-2.5 border-bee"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip bg-bee-soft text-bee-dark">
                <span aria-hidden>{source.flag}</span> {pair.sourceName}
              </span>
              <span aria-hidden className="text-sm font-black text-hare">
                →
              </span>
              <span className={`chip ${target.soft} ${target.text}`}>
                <span aria-hidden>{target.flag}</span> {pair.languageName}
              </span>
              <span className="ml-auto text-xs font-extrabold uppercase tracking-wider text-hare">
                {pair.occurrences}x
              </span>
            </div>

            <p className="text-sm font-semibold text-wolf">
              Aparece em {pair.categories.map((c) => CATEGORY_LABEL[c] ?? c.toLowerCase()).join(', ')}.
            </p>

            {/* Os topicos sao os pontos em que os dois idiomas divergem -- por
                isso resolvem esta interferencia especifica, e nao outra. */}
            {pair.topics.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-hare">
                  o que resolve
                </p>
                {pair.topics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => onOpenTopic(topic.id)}
                    className="w-full rounded-xl border-2 border-swan bg-white px-3 py-2 text-left transition hover:bg-snow active:translate-y-[1px]"
                  >
                    <p className="text-sm font-black leading-snug">{topic.title}</p>
                    <p className="text-xs font-semibold text-wolf">{topic.question}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
