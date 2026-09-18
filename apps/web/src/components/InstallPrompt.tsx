import { useState } from 'react';
import { isStandalone, snoozeInstall, useBottomBanner, useServiceWorker } from '../lib/pwa';
import { InstallGuide } from './InstallGuide';

/**
 * Convite para instalar o app e aviso de versao nova.
 *
 * Fica no Layout, entao nunca aparece durante uma sessao de estudo -- a licao
 * roda em tela cheia, fora do Layout, e interromper o aluno no meio de um
 * bloco para oferecer instalacao seria o pior momento possivel.
 *
 * Uma linha, sempre. Esta barra fica entre o conteudo e as abas, e cada linha
 * dela sobe o rodape do app inteiro: no celular, duas linhas de barra mais as
 * abas comiam um terco da tela. Por isso o subtitulo so aparece a partir do
 * `sm` e a acao secundaria e um X, nao um botao de texto -- o que nao couber em
 * uma linha nao entra.
 */
export function InstallPrompt() {
  const banner = useBottomBanner();
  const { applyUpdate } = useServiceWorker();
  const [showGuide, setShowGuide] = useState(false);

  if (showGuide) return <InstallGuide onClose={() => setShowGuide(false)} />;
  if (!banner) return null;

  if (banner === 'update') {
    return (
      <BannerShell tone="border-macaw bg-macaw-soft">
        <p className="min-w-0 flex-1 text-sm font-medium text-macaw-dark">Tem uma versão nova do 4L.</p>
        <button className="btn-blue shrink-0 px-5 py-2 text-sm" onClick={applyUpdate}>
          Atualizar
        </button>
      </BannerShell>
    );
  }

  return (
    <BannerShell tone="border-swan bg-white">
      {/* "Instale o 4L no celular" nao cabia ao lado do botao e chegava ao
          aluno como "Instale o 4L no ...". Texto curto o bastante para nunca
          truncar; o detalhe fica para o guia, que tem a tela inteira. */}
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-eel">
        Instalar o app
        <span className="hidden text-xs text-hare sm:block">Abre em tela cheia, direto da tela de início.</span>
      </p>
      <button className="btn-primary shrink-0 px-5 py-2 text-sm" onClick={() => setShowGuide(true)}>
        Instalar
      </button>
      {/*
        "Agora nao" virou um X.
        A barra fica ACIMA das abas, entao cada linha dela empurra o conteudo do
        app para cima. Um botao de texto para a acao secundaria custava a largura
        que obrigava a barra a empilhar em duas linhas -- e duas linhas mais as
        abas comiam um terco da tela do celular. O X faz o mesmo trabalho em 32px.
      */}
      <button
        onClick={snoozeInstall}
        aria-label="Agora não"
        className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-hare transition hover:bg-snow hover:text-wolf"
      >
        ✕
      </button>
    </BannerShell>
  );
}

/**
 * A casca das duas barras.
 *
 * O deslocamento de baixo acompanha a altura da barra de abas; no desktop nao
 * ha abas e ela desce para o rodape. O Layout reserva no conteudo o espaco que
 * esta casca ocupa -- ver `useBottomBanner` la.
 */
function BannerShell({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <div
      className={`fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-y px-4 py-2.5 lg:bottom-0 lg:border-b-0 ${tone}`}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2.5">{children}</div>
    </div>
  );
}

/**
 * Botao permanente de instalacao, para o cabecalho.
 *
 * E a peca que faltava: ate agora o unico caminho para instalar era a barra
 * automatica, que aparece quando o navegador quer e some quando o aluno
 * dispensa. Quem perdesse a janela nao tinha como voltar. Este botao esta
 * sempre la -- e some sozinho quando o app ja esta instalado, porque ai ele
 * nao teria mais o que oferecer.
 */
export function InstallButton({ className = '' }: { className?: string }) {
  const [showGuide, setShowGuide] = useState(false);

  // `isStandalone` e checado a cada render em vez de virar estado: quando o
  // app abre instalado ele ja nasce true, e quando nao esta nao muda no meio.
  if (isStandalone()) return null;

  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        aria-label="Instalar o app"
        title="Instalar o app"
        className={`flex shrink-0 items-center gap-1.5 rounded-md border border-grass bg-grass-soft px-2.5 py-1.5 text-xs font-medium text-grass-dark transition hover:bg-grass hover:text-snow ${className}`}
      >
        <span className="hidden sm:inline">Instalar</span>
        <span className="sm:hidden">Instalar app</span>
      </button>

      {showGuide && <InstallGuide onClose={() => setShowGuide(false)} />}
    </>
  );
}
