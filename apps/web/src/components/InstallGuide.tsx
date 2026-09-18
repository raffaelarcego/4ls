import { useState } from 'react';
import {
  installPlatform,
  isSecureContextForInstall,
  useInstall,
  type InstallPlatform,
} from '../lib/pwa';
import { CloseIcon } from './Icons';

/**
 * Guia de instalacao do app.
 *
 * Existe porque "instalar" nao e uma acao so: em metade dos casos o navegador
 * abre um dialogo nativo, e na outra metade nao existe dialogo nenhum -- o
 * caminho e um item de menu que muda de lugar em cada navegador. Um botao
 * generico "Instalar" que as vezes nao faz nada e pior que nao ter botao.
 *
 * Por isso cada situacao tem a sua tela, e as duas mais importantes sao as que
 * NAO instalam:
 *
 * - webview de outro app (Instagram, WhatsApp): nao ha o que fazer ali dentro,
 *   e sem esse aviso a pessoa tenta, falha e conclui que o app esta quebrado.
 *   E a causa mais comum de "nao consigo instalar" e a mais invisivel.
 * - iPhone fora do Safari: Chrome e Firefox no iOS nao instalam; o caminho
 *   passa obrigatoriamente pelo Safari.
 */
export function InstallGuide({ onClose }: { onClose: () => void }) {
  const { canPrompt, install } = useInstall();
  const [failed, setFailed] = useState(false);
  const platform = installPlatform(canPrompt);
  const secure = isSecureContextForInstall();

  async function handleInstall() {
    const accepted = await install();
    if (accepted) {
      onClose();
      return;
    }
    // Recusar o dialogo nao e erro; o dialogo nao ABRIR e. Nos dois casos o
    // caminho manual continua valendo, entao mostramos as instrucoes.
    setFailed(true);
  }

  const guide = GUIDES[failed && platform === 'prompt' ? 'desktop' : platform];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-eel/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Instalar o 4L"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-lg border border-swan bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-lg sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl font-semibold leading-tight text-eel">{guide.title}</h2>
            <p className="text-sm text-wolf">{guide.subtitle}</p>
          </div>
          <button className="btn-plain px-2 text-sm" onClick={onClose} aria-label="Fechar">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {!secure && (
          // Sem HTTPS nenhuma instrucao de menu resolve: o navegador nem
          // oferece a opcao. Dizer isso evita a busca por um item inexistente.
          <p className="mb-4 rounded-md border border-cardinal bg-cardinal-soft px-3.5 py-3 text-sm text-cardinal-dark">
            Este endereço não está em HTTPS, e sem isso nenhum navegador instala o app. Acesse
            pelo endereço oficial (https://…) e tente de novo.
          </p>
        )}

        {guide.steps.length > 0 && (
          <ol className="mb-4 space-y-2.5">
            {guide.steps.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-grass font-mono text-xs text-grass">
                  {i + 1}
                </span>
                {/* O HTML vem de GUIDES, uma constante deste arquivo -- nada
                    de fora entra aqui. E so <strong>, e ele importa: o aluno
                    procura o item de menu pelo nome exato, e o nome precisa
                    saltar da frase. */}
                <span className="text-sm leading-snug text-eel" dangerouslySetInnerHTML={{ __html: step }} />
              </li>
            ))}
          </ol>
        )}

        {guide.note && (
          <p className="mb-4 rounded-md bg-swan/40 px-3.5 py-3 text-sm text-wolf">{guide.note}</p>
        )}

        {platform === 'in-app' && <CopyLink />}

        {platform === 'prompt' && !failed ? (
          <button className="btn-primary w-full py-4 text-base" onClick={handleInstall}>
            Instalar agora
          </button>
        ) : (
          <button className="btn-ghost w-full" onClick={onClose}>
            Entendi
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * O endereco, para colar no navegador de verdade.
 *
 * Num webview nao da para "abrir no Chrome" por codigo de forma confiavel --
 * cada app trata o intent de um jeito, e vários ignoram. Copiar o link e o
 * unico caminho que funciona em todos.
 */
function CopyLink() {
  const [copied, setCopied] = useState(false);
  const url = typeof window === 'undefined' ? '' : window.location.origin;

  return (
    <div className="mb-4 space-y-2">
      <p className="truncate rounded-md border border-swan bg-snow px-3 py-2.5 font-mono text-sm text-eel">
        {url}
      </p>
      <button
        className="btn-blue w-full py-3"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            // Clipboard bloqueado no webview: o endereco esta ali em cima para
            // ser copiado a mao, entao nao ha o que consertar.
            setCopied(false);
          }
        }}
      >
        {copied ? 'Copiado!' : 'Copiar endereço'}
      </button>
    </div>
  );
}

interface Guide {
  emoji: string;
  title: string;
  subtitle: string;
  /** Aceitam <strong> para destacar o nome exato do item de menu. */
  steps: string[];
  note?: string;
}

const GUIDES: Record<InstallPlatform, Guide> = {
  installed: {
    emoji: '✅',
    title: 'Já está instalado',
    subtitle: 'Você está usando o app, não o navegador.',
    steps: [],
    note: 'O ícone do 4L já está na sua tela de início.',
  },

  prompt: {
    emoji: '📲',
    title: 'Instalar o 4L',
    subtitle: 'Abre em tela cheia, direto da tela de início.',
    steps: [],
    note: 'Seu navegador permite instalar com um toque. O app ocupa poucos megabytes e abre sem barra de endereço.',
  },

  'ios-safari': {
    emoji: '📲',
    title: 'Instalar no iPhone',
    subtitle: 'O iPhone não tem botão de instalar — o caminho é o menu Compartilhar.',
    steps: [
      'Toque em <strong>Compartilhar</strong> — o quadrado com a seta para cima, na barra de baixo do Safari.',
      'Role a lista e escolha <strong>Adicionar à Tela de Início</strong>.',
      'Toque em <strong>Adicionar</strong>, no canto superior direito.',
    ],
    note: 'Se não encontrar a opção, role a lista até o fim: ela costuma ficar depois dos apps de compartilhamento.',
  },

  'ios-other': {
    emoji: '🧭',
    title: 'Abra no Safari',
    subtitle: 'No iPhone, só o Safari instala aplicativos.',
    steps: [
      'Copie o endereço desta página.',
      'Abra o <strong>Safari</strong> e cole o endereço.',
      'Toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.',
    ],
    note: 'Chrome, Firefox e Edge no iPhone não conseguem instalar — é uma limitação do iOS, não do 4L.',
  },

  'in-app': {
    emoji: '🚪',
    title: 'Abra no navegador',
    subtitle: 'Você está no navegador interno de outro aplicativo.',
    steps: [
      'Toque nos <strong>três pontos</strong> no canto da tela.',
      'Escolha <strong>Abrir no navegador</strong> (ou Abrir no Chrome / no Safari).',
      'De lá, use o botão de instalar novamente.',
    ],
    note: 'Navegadores embutidos de Instagram, WhatsApp e afins não instalam aplicativos. Copie o endereço abaixo se não achar a opção.',
  },

  android: {
    emoji: '📲',
    title: 'Instalar no Android',
    subtitle: 'Pelo menu do navegador, em dois toques.',
    steps: [
      'Toque nos <strong>três pontos</strong> no canto superior direito do Chrome.',
      'Escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.',
      'Confirme em <strong>Instalar</strong>.',
    ],
    note: 'Se a opção não aparecer, recarregue a página uma vez e tente de novo — o navegador precisa ter carregado o app por completo.',
  },

  desktop: {
    emoji: '💻',
    title: 'Instalar no computador',
    subtitle: 'Chrome e Edge instalam pela barra de endereço.',
    steps: [
      'Procure o ícone de <strong>instalar</strong> (um monitor com uma seta) no fim da barra de endereço.',
      'Ou abra o menu <strong>⋮</strong> e escolha <strong>Instalar 4L</strong>.',
      'Confirme em <strong>Instalar</strong>.',
    ],
  },

  unsupported: {
    emoji: '🦊',
    title: 'Este navegador não instala',
    subtitle: 'O Firefox no computador não suporta instalação de apps web.',
    steps: [
      'Abra o 4L no <strong>Chrome</strong>, <strong>Edge</strong> ou no navegador do celular.',
      'Use o botão de instalar por lá.',
    ],
    note: 'No celular, o Firefox para Android consegue: use "Adicionar à tela inicial" no menu.',
  },
};
