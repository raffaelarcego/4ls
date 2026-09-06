import { useState } from 'react';
import { useInstall, useServiceWorker } from '../lib/pwa';

const DISMISSED_KEY = '4l.install.dismissed';

/**
 * Convite para instalar o app e aviso de versao nova.
 *
 * Fica no Layout, entao nunca aparece durante uma sessao de estudo -- a licao
 * roda em tela cheia, fora do Layout, e interromper o aluno no meio de um
 * bloco para oferecer instalacao seria o pior momento possivel.
 */
export function InstallPrompt() {
  const { canPrompt, needsManualSteps, install } = useInstall();
  const { updateReady, applyUpdate } = useServiceWorker();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      // Navegador com armazenamento bloqueado: melhor mostrar o convite do que
      // quebrar a tela por causa dele.
      return false;
    }
  });
  const [showIosSteps, setShowIosSteps] = useState(false);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Sem persistir, o convite volta na proxima visita. Aceitavel.
    }
  }

  // Atualizacao tem prioridade: e a unica das duas que corrige alguma coisa.
  if (updateReady) {
    return (
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 border-y-2 border-macaw bg-macaw-soft px-4 py-3 lg:bottom-0 lg:border-b-0">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="text-2xl">✨</span>
          <p className="flex-1 text-sm font-extrabold text-macaw-dark">
            Tem uma versão nova do 4L.
          </p>
          <button className="btn-blue px-5 py-2 text-sm" onClick={applyUpdate}>
            Atualizar
          </button>
        </div>
      </div>
    );
  }

  if (dismissed || (!canPrompt && !needsManualSteps)) return null;

  if (showIosSteps) {
    return (
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 border-y-2 border-swan bg-white px-4 py-3 lg:bottom-0 lg:border-b-0">
        <div className="mx-auto max-w-3xl space-y-2">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📲</span>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-black">Instalar no iPhone</p>
              <ol className="space-y-0.5 text-sm font-semibold text-wolf">
                <li>
                  1. Toque em <strong>Compartilhar</strong> na barra do Safari
                </li>
                <li>
                  2. Escolha <strong>Adicionar à Tela de Início</strong>
                </li>
              </ol>
            </div>
            <button className="btn-plain text-sm" onClick={dismiss}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 border-y-2 border-swan bg-white px-4 py-3 lg:bottom-0 lg:border-b-0">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <span className="text-2xl">📲</span>
        <p className="flex-1 text-sm font-extrabold">
          Instale o 4L no celular
          <span className="block text-xs font-bold text-hare">
            Abre em tela cheia, direto da sua tela de início.
          </span>
        </p>
        <button className="btn-plain text-sm" onClick={dismiss}>
          Agora não
        </button>
        <button
          className="btn-primary px-5 py-2 text-sm"
          onClick={() => (needsManualSteps ? setShowIosSteps(true) : install())}
        >
          Instalar
        </button>
      </div>
    </div>
  );
}
