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
 * O layout empilha no celular e so vira uma linha a partir do `sm`. A versao
 * anterior era uma linha unica sempre, e num aparelho de 360px sobravam noventa
 * pixels para o texto entre o emoji e os dois botoes: o titulo quebrava em tres
 * linhas e a barra virava um bloco disforme. Numa barra fixa, que compete com o
 * conteudo por espaco, a largura minima e a que manda.
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
        <span aria-hidden className="text-2xl">
          ✨
        </span>
        <p className="min-w-0 flex-1 text-sm font-extrabold text-macaw-dark">
          Tem uma versão nova do 4L.
        </p>
        <button className="btn-blue shrink-0 px-5 py-2 text-sm" onClick={applyUpdate}>
          Atualizar
        </button>
      </BannerShell>
    );
  }

  return (
    <BannerShell tone="border-swan bg-white" stack>
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="text-2xl">
          📲
        </span>
        <p className="min-w-0 flex-1 text-sm font-extrabold leading-tight">
          Instale o 4L no celular
          <span className="block text-xs font-bold text-hare">
            Abre em tela cheia, direto da tela de início.
          </span>
        </p>
      </div>

      {/* No celular os botoes ganham a linha inteira e dividem a largura; a
          partir do sm voltam a ser dois botoes a direita do texto. */}
      <div className="flex shrink-0 gap-2">
        <button className="btn-ghost flex-1 px-4 py-2 text-sm sm:flex-none" onClick={snoozeInstall}>
          Agora não
        </button>
        <button
          className="btn-primary flex-1 px-5 py-2 text-sm sm:flex-none"
          onClick={() => setShowGuide(true)}
        >
          Instalar
        </button>
      </div>
    </BannerShell>
  );
}

/**
 * A casca das duas barras.
 *
 * `bottom-[4.25rem]` e a altura da barra de abas; no desktop nao ha abas e ela
 * desce para o rodape. O Layout reserva no conteudo o mesmo espaco que esta
 * casca ocupa -- ver `useBottomBanner` la.
 */
function BannerShell({
  tone,
  stack = false,
  children,
}: {
  tone: string;
  stack?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 border-y-2 px-4 py-3 lg:bottom-0 lg:border-b-0 ${tone}`}
    >
      <div
        className={`mx-auto flex max-w-3xl gap-3 ${
          stack ? 'flex-col sm:flex-row sm:items-center' : 'items-center'
        }`}
      >
        {children}
      </div>
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
        className={`flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-b-[3px] border-grass bg-grass-soft px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-grass-dark transition active:translate-y-[1px] active:border-b-2 ${className}`}
      >
        <span aria-hidden className="text-base leading-none">
          📲
        </span>
        <span className="hidden sm:inline">Instalar</span>
      </button>

      {showGuide && <InstallGuide onClose={() => setShowGuide(false)} />}
    </>
  );
}
