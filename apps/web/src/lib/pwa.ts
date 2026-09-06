/**
 * Instalacao e atualizacao do app.
 *
 * O 4L e um site que se instala como aplicativo (PWA). Nao ha loja nem build
 * nativo: o navegador oferece a instalacao quando o site tem manifest, service
 * worker e HTTPS. Este arquivo cuida das duas pontas disso -- registrar o
 * worker e saber quando ha versao nova.
 */

import { useEffect, useState } from 'react';

/** O evento que o Chrome dispara quando o app pode ser instalado. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

if (typeof window !== 'undefined') {
  /*
   * O evento chega uma unica vez, e normalmente ANTES de a interface montar.
   * Guardar aqui, no modulo, e o que permite mostrar o botao de instalar
   * depois -- se so escutassemos dentro de um componente, o evento ja teria
   * passado e o botao nunca apareceria.
   */
  window.addEventListener('beforeinstallprompt', (event) => {
    // Sem isto o Chrome mostra a propria barra, que compete com o botao do app.
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

/** true quando o app esta aberto instalado, e nao numa aba do navegador. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari no iOS nao implementa display-mode e usa esta propriedade propria.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS se apresenta como Mac; o toque e o que o denuncia.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Estado de instalacao para a interface.
 *
 * O iOS nunca dispara `beforeinstallprompt` -- no Safari a instalacao e
 * manual, pelo menu Compartilhar. Por isso `canPrompt` e `needsManualSteps`
 * sao coisas diferentes: uma abre o dialogo, a outra so pode explicar.
 */
export function useInstall() {
  const [available, setAvailable] = useState(deferredPrompt !== null);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const update = () => {
      setAvailable(deferredPrompt !== null);
      setInstalled(isStandalone());
    };
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  async function install(): Promise<boolean> {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // O evento so serve uma vez; o navegador manda outro se couber.
    deferredPrompt = null;
    notify();
    return outcome === 'accepted';
  }

  return {
    installed,
    canPrompt: available && !installed,
    needsManualSteps: isIos() && !installed,
    install,
  };
}

/**
 * Registra o service worker e avisa quando ha versao nova esperando.
 *
 * Sem esse aviso, uma correcao publicada hoje so chegaria ao aluno quando ele
 * fechasse todas as abas do app -- o que, num app instalado, pode levar dias.
 */
let waitingWorker: ServiceWorker | null = null;
const updateListeners = new Set<() => void>();

/*
 * O registro roda no carregamento do modulo, e nao dentro de um componente.
 *
 * A razao e concreta: o convite de instalacao vive no Layout, e a tela de
 * login nao usa Layout. Registrando dentro dele, quem chegasse pela primeira
 * vez nunca teria service worker -- e portanto nunca receberia a oferta de
 * instalar o app, que e justamente quando ela mais faz sentido.
 */
export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // Em dev o worker serviria a casca em cache por cima do servidor do Vite.
  if (import.meta.env.DEV) return;

  const announce = (worker: ServiceWorker) => {
    waitingWorker = worker;
    for (const listener of updateListeners) listener();
  };

  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      // Ja havia uma versao nova parada, de uma visita anterior.
      if (registration.waiting && navigator.serviceWorker.controller) {
        announce(registration.waiting);
      }
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          // "installed" com um worker ja no controle significa: versao nova
          // pronta, aguardando. Sem controller e a primeira visita, e ai nao
          // ha nada a anunciar.
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            announce(worker);
          }
        });
      });
    })
    .catch(() => {
      // Falha em registrar nao pode derrubar o app: ele funciona sem o
      // worker, so perde a instalacao e a abertura offline.
    });
}

/** Avisa quando ha versao nova esperando para assumir. */
export function useServiceWorker() {
  const [updateReady, setUpdateReady] = useState(waitingWorker !== null);

  useEffect(() => {
    const update = () => setUpdateReady(waitingWorker !== null);
    updateListeners.add(update);
    return () => {
      updateListeners.delete(update);
    };
  }, []);

  function applyUpdate() {
    waitingWorker?.postMessage('skip-waiting');
    // Recarregar so depois que o worker novo assume, senao a pagina volta a
    // ser servida pelo antigo e o aviso reaparece.
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
      once: true,
    });
  }

  return { updateReady, applyUpdate };
}
