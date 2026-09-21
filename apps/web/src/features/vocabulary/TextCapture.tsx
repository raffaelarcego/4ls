import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { preparePhoto } from '../../lib/photo';
import { languageTheme } from '../../lib/ui';
import { api, errorMessage } from '../../services/api';
import { CaptureResult } from '../../types';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ru', label: 'Русский' },
];

/**
 * Captura de texto.
 *
 * Cole um artigo, um e-mail, a legenda de um episodio -- o que voce estava
 * lendo de verdade -- e o vocabulario dele entra no seu estudo.
 *
 * O que torna isto diferente de "salvar palavras" e o que acontece depois da
 * extracao: cada termo aceito passa pela mesma porta de sempre, entao nasce ja
 * nos quatro idiomas. Um artigo lido em ingles vira vocabulario de russo
 * tambem. E a unica forma de um texto real alimentar quatro cursos ao mesmo
 * tempo, e e o motivo de esta tela existir aqui e nao como um bloco de notas.
 */
export function TextCapture() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [languageCode, setLanguageCode] = useState('en');
  const [text, setText] = useState('');
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const capture = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/concepts/capture', { languageCode, text, count: 6 });
      return data as CaptureResult;
    },
    onSuccess: (data) => {
      setResult(data);
      setText('');
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  /**
   * A foto vira texto -- e para ai.
   *
   * O texto lido cai no mesmo campo em que ele colaria um artigo, e a captura de
   * verdade continua sendo o botao de sempre. Ingerir direto pareceria mais
   * magico e seria pior: OCR de foto erra, e um erro vira card nos quatro
   * idiomas de uma vez. Conferir antes custa um toque.
   */
  const readPhoto = useMutation({
    mutationFn: async (file: File) => {
      const photo = await preparePhoto(file);
      const { data } = await api.post('/concepts/capture/photo', {
        languageCode,
        image: photo.data,
        mimeType: photo.mimeType,
      });
      return data as { text: string; note: string | null };
    },
    onSuccess: (data) => {
      setPhotoNote(data.note);
      // Acrescenta em vez de substituir: duas fotos de paginas seguidas do
      // mesmo cardapio sao um texto so, e sobrescrever perderia a primeira.
      setText((current) => (current.trim() ? `${current.trim()}
${data.text}` : data.text));
    },
  });

  if (!open) {
    return (
      <button className="btn-ghost w-full" onClick={() => setOpen(true)}>
        Aprender de um texto
      </button>
    );
  }

  return (
    <section className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="section-title">Aprender de um texto</h2>
          <p className="text-xs text-wolf">Cole algo que você leu. O vocabulário entra nos quatro idiomas.</p>
        </div>
        <button
          className="btn-plain px-2 text-xs"
          onClick={() => {
            setOpen(false);
            setResult(null);
          }}
        >
          Fechar
        </button>
      </div>

      <div className="flex gap-2">
        {LANGUAGES.map((option) => {
          const theme = languageTheme(option.code);
          const active = option.code === languageCode;
          return (
            <button
              key={option.code}
              onClick={() => setLanguageCode(option.code)}
              className={`flex-1 rounded-md border px-2 py-2.5 font-mono text-xs transition ${
                active
                  ? `${theme.border} ${theme.soft} ${theme.text}`
                  : 'border-swan bg-white text-wolf hover:bg-snow'
              }`}
            >
              <span aria-hidden className="mr-1">
                {theme.mark}
              </span>
              {option.code.toUpperCase()}
            </button>
          );
        })}
      </div>

      <textarea
        className="input min-h-[9rem] resize-y text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Cole aqui o texto no idioma escolhido — ou fotografe."
      />

      {/*
        `capture="environment"` abre a camera traseira direto no celular, sem
        passar pela galeria. No desktop o mesmo campo vira "escolher arquivo",
        que e o comportamento certo la.
      */}
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Limpa o valor para a MESMA foto poder ser escolhida de novo depois
          // de um erro -- sem isso o `change` nao dispara na segunda vez.
          event.target.value = '';
          if (file) readPhoto.mutate(file);
        }}
      />

      <button
        className="btn-ghost w-full"
        onClick={() => photoInput.current?.click()}
        disabled={readPhoto.isPending}
      >
        {readPhoto.isPending ? 'Lendo a foto...' : 'Fotografar um texto'}
      </button>

      {photoNote && (
        <p className="rounded-md border border-bee bg-bee-soft px-3 py-2 text-xs leading-snug text-bee-dark">
          {photoNote}
        </p>
      )}

      {readPhoto.isError && (
        <p className="rounded-md bg-cardinal-soft px-3 py-2 text-sm text-cardinal-dark">
          {errorMessage(readPhoto.error)}
        </p>
      )}

      {capture.isError && (
        <p className="rounded-md bg-cardinal-soft px-3 py-2 text-sm text-cardinal-dark">
          {errorMessage(capture.error)}
        </p>
      )}

      {result && (
        <div className="space-y-2.5">
          {result.learned.length === 0 ? (
            <p className="rounded-md bg-snow px-3 py-2 text-sm text-wolf">
              Nada de novo neste texto para o seu nível — você já sabe o que vale a pena aqui.
            </p>
          ) : (
            <>
              <p className="section-title">
                {result.learned.length} conceito(s) novo(s), em todos os idiomas
              </p>
              {result.learned.map((card) => (
                <div key={card.id} className="rounded-md border border-swan bg-white p-3">
                  <p className="text-sm font-medium text-eel">{card.gloss}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {card.entries.map((entry) => (
                      <span key={entry.languageCode} className="chip">
                        {languageTheme(entry.languageCode).mark} {entry.term}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Dizer o que foi descartado importa: sem isso, "3 de 6 termos"
              parece falha da extracao em vez do que e -- voce ja sabia o resto. */}
          {result.skipped.length > 0 && (
            <p className="text-xs text-hare">Já no seu vocabulário: {result.skipped.join(', ')}</p>
          )}
        </div>
      )}

      <button
        className="btn-primary w-full py-4"
        onClick={() => capture.mutate()}
        disabled={text.trim().length < 40 || capture.isPending}
      >
        {capture.isPending ? 'Lendo o texto...' : 'Extrair vocabulário'}
      </button>
    </section>
  );
}
