import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery<Interference[]>({
    queryKey: ['errors', 'interference'],
    queryFn: async () => (await api.get('/errors/interference')).data,
    retry: false,
  });

  /*
   * O painel diagnosticava e parava ali: mandava estudar o contraste, que e uma
   * AULA sobre a interferencia. Aula sobre interferencia nao desfaz
   * interferencia -- o que desfaz e escolher a forma certa com a importada do
   * lado, muitas vezes. Este botao e o caminho do diagnostico para o treino, e
   * ele cabe aqui porque e aqui que o aluno acabou de ver o problema.
   */
  const train = useMutation({
    mutationFn: async (languageCode: string) => {
      const { data } = await api.post('/study/practice', { languageCode, type: 'traps' });
      return data as { id: string };
    },
    onSuccess: (activity) => {
      queryClient.invalidateQueries({ queryKey: ['session', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate(`/sessao?activity=${activity.id}`);
    },
  });

  if (!data || data.length === 0) return null;

  return (
    <section className="space-y-2.5">
      <div>
        <p className="section-label">Um idioma entrando no outro</p>
        <p className="text-xs text-wolf">
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
                <span aria-hidden>{source.mark}</span> {pair.sourceName}
              </span>
              <span aria-hidden className="text-sm text-hare">
                →
              </span>
              <span className={`chip ${target.soft} ${target.text}`}>
                <span aria-hidden>{target.mark}</span> {pair.languageName}
              </span>
              <span className="ml-auto font-mono text-xs text-hare">{pair.occurrences}x</span>
            </div>

            <p className="text-sm text-wolf">
              Aparece em {pair.categories.map((c) => CATEGORY_LABEL[c] ?? c.toLowerCase()).join(', ')}.
            </p>

            <button
              className="btn-blue w-full"
              onClick={() => train.mutate(pair.languageCode)}
              disabled={train.isPending}
            >
              {train.isPending ? 'Abrindo...' : `Treinar as armadilhas em ${pair.languageName}`}
            </button>

            {/* Os topicos sao os pontos em que os dois idiomas divergem -- por
                isso resolvem esta interferencia especifica, e nao outra. */}
            {pair.topics.length > 0 && (
              <div className="space-y-1.5">
                <p className="section-label">O que resolve</p>
                {pair.topics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => onOpenTopic(topic.id)}
                    // `tap-target`: este e o atalho mais util do painel e vinha
                    // com duas linhas curtas de altura, abaixo do minimo de toque.
                    className="tap-target w-full rounded-md border border-swan bg-white px-3 py-2 text-left transition-colors hover:bg-snow"
                  >
                    <p className="font-serif text-sm font-semibold leading-snug text-eel">
                      {topic.title}
                    </p>
                    <p className="text-xs text-wolf">{topic.question}</p>
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
