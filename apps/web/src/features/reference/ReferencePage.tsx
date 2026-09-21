import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AudioButton } from '../../components/AudioButton';
import { ProgressBar } from '../../components/ProgressBar';
import { languageTheme } from '../../lib/ui';
import { api, errorMessage } from '../../services/api';
import { Reference, ReferenceEntry, ReferenceLanguage } from '../../types';

/**
 * Consulta: a tabela na parede.
 *
 * A trilha de alfabeto serve uma licao por dia e decide o que voce ve e
 * quando. Isso e certo para APRENDER e inutil para LEMBRAR: quando o aluno
 * trava numa letra no meio de um ditado, ele nao quer uma licao, quer a
 * tabela -- e nao havia onde olhar.
 *
 * Por isso esta tela nao pontua, nao grava e nao entra na sessao. Ela tem uma
 * busca no topo, que e o controle mais importante daqui: consulta boa e a que
 * responde em dois segundos.
 */
export function ReferencePage() {
  const [code, setCode] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [alphabetical, setAlphabetical] = useState(false);

  const languages = useQuery<ReferenceLanguage[]>({
    queryKey: ['reference', 'languages'],
    queryFn: async () => (await api.get('/reference/languages')).data,
  });

  const active = code ?? languages.data?.[0]?.code ?? null;

  const reference = useQuery<Reference>({
    queryKey: ['reference', active],
    queryFn: async () => (await api.get('/reference', { params: { language: active } })).data,
    enabled: Boolean(active),
  });

  if (languages.isPending) {
    return <p className="text-sm text-wolf">Abrindo a consulta...</p>;
  }

  if (!languages.data?.length) {
    return (
      <div className="card">
        <p className="font-serif font-bold text-eel">Nada para consultar ainda</p>
        <p className="text-sm text-wolf">
          Os idiomas que você estuda usam o mesmo alfabeto e a mesma leitura do português.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-2xl font-bold text-eel">Consulta</h1>
        <p className="text-sm text-wolf">
          As tabelas que você olha no meio do estudo. Aqui nada é cobrado.
        </p>
      </header>

      {/* Um idioma por vez: duas tabelas de leitura lado a lado se misturam na
          cabeça, que é o oposto do que uma consulta deve fazer. */}
      <div className="hscroll -mx-4 flex gap-2 px-4 pb-1">
        {languages.data.map((language) => {
          const theme = languageTheme(language.code);
          const on = language.code === active;
          return (
            <button
              key={language.code}
              onClick={() => {
                setCode(language.code);
                setQuery('');
              }}
              className={`tap-target flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                on ? `${theme.border} ${theme.soft} ${theme.text}` : 'border-swan text-wolf'
              }`}
            >
              <span className="font-mono">{theme.mark}</span>
              {language.name}
            </button>
          );
        })}
      </div>

      {reference.isError && (
        <div className="card border-cardinal bg-cardinal-soft">
          <p className="text-sm text-cardinal-dark">{errorMessage(reference.error)}</p>
        </div>
      )}

      {reference.data && (
        <>
          <p className="rounded-xl border border-swan bg-white px-4 py-3 text-sm leading-snug text-wolf">
            {reference.data.intro}
          </p>

          <div className="flex items-center gap-2">
            <input
              className="input"
              placeholder="Procurar letra, som ou palavra"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {reference.data.sortable && (
              <button
                className="btn-ghost shrink-0 px-3 text-xs"
                onClick={() => setAlphabetical((v) => !v)}
              >
                {alphabetical ? 'Por lição' : 'A-Z'}
              </button>
            )}
          </div>

          <Entries
            reference={reference.data}
            query={query}
            alphabetical={alphabetical && reference.data.sortable}
          />
        </>
      )}
    </div>
  );
}

/** Casa a busca contra tudo que o aluno pode lembrar da entrada. */
function matches(entry: ReferenceEntry, query: string): boolean {
  if (!query.trim()) return true;
  const needle = query.trim().toLowerCase();
  return [entry.symbol, entry.name, entry.sound, entry.example, entry.exampleMeaning]
    .filter(Boolean)
    .some((field) => field!.toLowerCase().includes(needle));
}

function Entries({
  reference,
  query,
  alphabetical,
}: {
  reference: Reference;
  query: string;
  alphabetical: boolean;
}) {
  const searching = query.trim().length > 0;

  /*
   * Buscando ou em ordem alfabetica, as secoes desaparecem e vira uma lista
   * so. Manter os cabecalhos numa busca deixaria a tela cheia de titulos de
   * secao vazia, e o resultado escondido entre eles.
   */
  const flat = useMemo(() => {
    const all = reference.all.filter((e) => matches(e, query));
    if (!alphabetical) return all;
    return [...all].sort((a, b) => a.symbol.localeCompare(b.symbol, reference.languageCode));
  }, [reference, query, alphabetical]);

  if (searching || alphabetical) {
    if (flat.length === 0) {
      return (
        <div className="card text-center text-sm text-wolf">
          Nada encontrado para "{query}".
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {flat.map((entry) => (
          <EntryCard key={entry.symbol} entry={entry} languageCode={reference.languageCode} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reference.sections.map((section) => (
        <section key={section.id} className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="section-title">{section.title}</h2>
            {section.mastery !== null && (
              <span className="shrink-0 font-mono text-xs text-hare">{section.mastery}%</span>
            )}
          </div>
          {section.note && <p className="text-xs leading-snug text-wolf">{section.note}</p>}
          {/* A barra só aparece onde a seção corresponde a uma lição da
              trilha; regra de leitura não se "vence". */}
          {section.mastery !== null && (
            <ProgressBar value={section.mastery} size="sm" tone="bg-grass" />
          )}
          <div className="space-y-2 pt-1">
            {section.entries.map((entry) => (
              <EntryCard
                key={`${section.id}-${entry.symbol}`}
                entry={entry}
                languageCode={reference.languageCode}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EntryCard({ entry, languageCode }: { entry: ReferenceEntry; languageCode: string }) {
  return (
    <div className="card space-y-2 p-4">
      <div className="flex items-start gap-3">
        <span
          lang={languageCode}
          className="min-w-[3.5rem] shrink-0 font-serif text-3xl leading-none text-eel"
        >
          {entry.symbol}
        </span>
        <div className="min-w-0 flex-1">
          {entry.name && <p className="font-mono text-xs text-hare">{entry.name}</p>}
          <p className="text-sm leading-snug text-eel">{entry.sound}</p>
        </div>
      </div>

      {entry.trap && (
        <p className="rounded-md border border-cardinal bg-cardinal-soft px-3 py-2 text-xs leading-relaxed text-cardinal-dark">
          {entry.trap}
        </p>
      )}

      {entry.example && (
        <div className="flex items-center gap-3 border-t border-swan pt-2">
          <div className="min-w-0 flex-1">
            <p lang={languageCode} className="break-words font-serif text-lg text-eel">
              {entry.example}
            </p>
            <p className="text-xs text-wolf">
              {entry.exampleReading && (
                <span className="font-mono text-macaw-dark">{entry.exampleReading}</span>
              )}
              {entry.exampleReading && entry.exampleMeaning && ' · '}
              {entry.exampleMeaning}
            </p>
          </div>
          <AudioButton text={entry.example} languageCode={languageCode} size="sm" />
        </div>
      )}
    </div>
  );
}
