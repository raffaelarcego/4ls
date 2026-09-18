import { useMutation, useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { AudioButton } from '../../components/AudioButton';
import { SendIcon } from '../../components/Icons';
import { languageTheme } from '../../lib/ui';
import { api, errorMessage } from '../../services/api';
import { DashboardLanguage } from '../../types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  correction?: CorrectionResult | null;
}

interface CorrectionResult {
  hasErrors: boolean;
  corrected: string;
  errors: Array<{ category: string; description: string; explanation?: string }>;
}

export function TutorPage() {
  const [languageCode, setLanguageCode] = useState('de');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: languages } = useQuery<DashboardLanguage[]>({
    queryKey: ['languages'],
    queryFn: async () => {
      const { data } = await api.get('/languages');
      return data;
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useMutation({
    mutationFn: async (content: string) => {
      const { data } = await api.post('/tutor/message', {
        languageCode,
        content,
        conversationId,
      });
      return data as {
        conversationId: string;
        reply: string;
        correction: CorrectionResult | null;
      };
    },
    onSuccess: (data) => {
      setConversationId(data.conversationId);
      setMessages((prev) => {
        // Anexa a correcao a ultima mensagem do usuario e adiciona a resposta.
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (next[i].role === 'user') {
            next[i] = { ...next[i], correction: data.correction };
            break;
          }
        }
        next.push({ role: 'assistant', content: data.reply });
        return next;
      });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setMessages((prev) => [...prev, { role: 'user', content }]);
    setDraft('');
    send.mutate(content);
  }

  function switchLanguage(code: string) {
    setLanguageCode(code);
    setConversationId(undefined);
    setMessages([]);
  }

  const active = languageTheme(languageCode);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-eel">Tutor</h1>
        <p className="text-sm text-wolf">Seus erros aqui entram no perfil e voltam como exercício.</p>
      </header>

      <div className="flex gap-4 border-b border-swan pb-0">
        {(languages ?? []).map((language) => {
          const theme = languageTheme(language.code);
          const isActive = languageCode === language.code;
          return (
            <button
              key={language.code}
              onClick={() => switchLanguage(language.code)}
              className={`min-w-0 border-b-2 px-1 pb-2.5 text-sm transition ${
                isActive ? `border-grass ${theme.text} font-medium` : 'border-transparent text-wolf hover:text-eel'
              }`}
            >
              <span className={`mr-1 font-mono ${theme.text}`}>{theme.mark}</span>
              {/* No celular so o codigo: com quatro idiomas e o nome inteiro, o
                  quarto ficava fora da tela -- e como a faixa rola na
                  horizontal, nada indicava que ele existia. */}
              <span className="sm:hidden">{language.code.toUpperCase()}</span>
              <span className="hidden sm:inline">{language.name}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-[26rem] space-y-3 rounded-lg border border-swan bg-snow p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className={`flex h-14 w-14 items-center justify-center rounded-md border font-mono text-2xl ${active.soft} ${active.border} ${active.text}`}>
              {active.mark}
            </span>
            <p className="max-w-xs text-sm text-wolf">
              Escreva algo no idioma. Errar não é problema — é assim que o sistema descobre o que
              você precisa treinar.
            </p>
          </div>
        )}

        {messages.map((message, i) => (
          <div key={i} className={message.role === 'user' ? 'text-right' : ''}>
            <div
              className={`inline-block max-w-[85%] rounded-md border px-4 py-2.5 text-left text-sm ${
                message.role === 'user'
                  ? 'border-macaw bg-macaw-soft text-macaw-dark'
                  : 'border-swan bg-white text-eel'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>

            {/* So a fala do tutor ganha audio: ouvir a propria frase errada
                de volta nao ensina nada. */}
            {message.role === 'assistant' && (
              <AudioButton
                text={message.content}
                languageCode={languageCode}
                size="sm"
                className="ml-2 align-top"
              />
            )}

            {message.correction?.hasErrors && (
              <div className="mt-2 inline-block max-w-[85%] rounded-md border border-bee bg-bee-soft px-4 py-2.5 text-left text-sm">
                <p className="font-medium text-bee-dark">{message.correction.corrected}</p>
                <ul className="mt-1.5 space-y-1">
                  {message.correction.errors.map((error, j) => (
                    <li key={j} className="text-xs text-eel">
                      <span className="chip mr-1 border-bee-dark/30 bg-white/70 text-bee-dark">
                        {error.category}
                      </span>
                      {error.explanation ?? error.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}

        {send.isPending && <p className="text-sm text-hare">O tutor está escrevendo...</p>}
        {send.isError && (
          <p className="rounded-md bg-cardinal-soft px-3 py-2 text-sm text-cardinal-dark">
            {errorMessage(send.error)}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escreva no idioma..."
        />
        <button
          type="submit"
          className="btn-primary shrink-0 px-5"
          disabled={send.isPending || !draft.trim()}
          aria-label="Enviar"
        >
          <SendIcon className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
