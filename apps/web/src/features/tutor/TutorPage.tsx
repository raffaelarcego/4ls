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
        <h1 className="text-2xl font-black tracking-tight">Tutor 🤖</h1>
        <p className="text-sm font-semibold text-wolf">
          Seus erros aqui entram no perfil e voltam como exercício.
        </p>
      </header>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(languages ?? []).map((language) => {
          const theme = languageTheme(language.code);
          const isActive = languageCode === language.code;
          return (
            <button
              key={language.code}
              onClick={() => switchLanguage(language.code)}
              className={`shrink-0 rounded-full border-2 px-4 py-2 text-xs font-extrabold uppercase tracking-wide transition ${
                isActive
                  ? `${theme.border} ${theme.soft} ${theme.text}`
                  : 'border-swan bg-white text-wolf hover:bg-snow'
              }`}
            >
              <span aria-hidden>{theme.flag} </span>
              {language.name}
            </button>
          );
        })}
      </div>

      <div className="min-h-[26rem] space-y-3 rounded-2xl border-2 border-swan bg-snow p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="animate-float text-6xl">{active.flag}</span>
            <p className="max-w-xs text-sm font-bold text-wolf">
              Escreva algo no idioma. Errar não é problema — é assim que o sistema descobre o que
              você precisa treinar.
            </p>
          </div>
        )}

        {messages.map((message, i) => (
          <div key={i} className={message.role === 'user' ? 'text-right' : ''}>
            <div
              className={`inline-block max-w-[85%] rounded-2xl border-2 px-4 py-2.5 text-left text-sm font-semibold ${
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
              <div className="mt-2 inline-block max-w-[85%] rounded-2xl border-2 border-bee bg-bee-soft px-4 py-2.5 text-left text-sm">
                <p className="font-extrabold text-bee-dark">
                  <span aria-hidden>✏️ </span>
                  {message.correction.corrected}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {message.correction.errors.map((error, j) => (
                    <li key={j} className="text-xs font-semibold text-eel">
                      <span className="chip mr-1 bg-white/70 text-bee-dark">{error.category}</span>
                      {error.explanation ?? error.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}

        {send.isPending && (
          <p className="flex items-center gap-2 text-sm font-bold text-hare">
            <span className="animate-float">🦉</span> O tutor está escrevendo...
          </p>
        )}
        {send.isError && (
          <p className="rounded-xl bg-cardinal-soft px-3 py-2 text-sm font-bold text-cardinal-dark">
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
          placeholder="Escreva no idioma que você está estudando..."
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
