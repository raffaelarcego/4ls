/**
 * Instalacao e atualizacao do app.
 *
 * O 4L e um site que se instala como aplicativo (PWA). Nao ha loja nem build
 * nativo: o navegador oferece a instalacao quando o site tem manifest, service
 * worker e HTTPS. Este arquivo cuida das duas pontas disso -- registrar o
 * worker e saber quando ha versao nova.
 *
 * METADE DISTO DEPENDE DO `apps/web/vercel.json`, e la nao cabe explicacao:
 * vercel.json e JSON puro, nao aceita comentario, e o schema da Vercel recusa
 * o truque de por uma chave "//" dentro de `headers`. As tres regras de la que
 * sustentam o que este arquivo faz:
 *
 * 1. A reescrita de SPA manda toda rota para o index.html, MENOS os arquivos
 *    que precisam ser servidos como si mesmos (`sw.js`, `manifest.webmanifest`,
 *    `robots.txt`, `assets/`, imagens). Servidos como HTML, o navegador
 *    simplesmente nunca oferece a instalacao -- e sem mensagem de erro
 *    nenhuma, que e o que torna esse engano tao caro de achar.
 * 2. O `sw.js` vai com `max-age=0, must-revalidate`. Se o navegador servir um
 *    service worker velho do cache, nenhuma versao nova do app chega a quem ja
 *    esta com ele instalado -- e o aviso de atualizacao daqui nunca dispara.
 * 3. O `assets/` vai com `immutable` por um ano, porque o Vite poe hash no
 *    nome de cada bundle: o arquivo daquele nome nunca muda de conteudo.
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
 * Navegador embutido de outro app (Instagram, WhatsApp, LinkedIn...).
 *
 * E a causa mais comum de "nao consigo instalar" e a mais invisivel: quem abre
 * o link por uma mensagem nao esta no Chrome nem no Safari, esta num webview
 * que simplesmente nao instala nada. Nada na tela denuncia isso -- a pagina
 * parece um navegador normal --, entao sem detectar e avisar, a pessoa tenta,
 * falha e conclui que o app e que esta quebrado.
 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;

  return (
    /FBAN|FBAV|FB_IAB/i.test(ua) || // Facebook e Messenger
    /Instagram/i.test(ua) ||
    /WhatsApp/i.test(ua) ||
    /LinkedInApp/i.test(ua) ||
    /Twitter|TwitterAndroid/i.test(ua) ||
    /MicroMessenger/i.test(ua) || // WeChat
    /BytedanceWebview|musical_ly/i.test(ua) || // TikTok
    /Line\//i.test(ua) ||
    /Snapchat/i.test(ua)
  );
}

/** O navegador e o Safari de verdade (nao Chrome/Firefox no iOS)? */
function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome|Chromium|Android/i.test(ua);
}

/**
 * Por que a instalacao esta (ou nao esta) disponivel agora.
 *
 * A interface precisa desta distincao porque cada caso pede uma frase
 * diferente, e a frase generica ("use o menu do navegador") nao ajuda ninguem:
 * no iPhone o caminho e o botao Compartilhar, no Android e o menu de tres
 * pontos, e num webview nao existe caminho nenhum.
 */
export type InstallPlatform =
  | 'installed'
  | 'prompt'
  | 'ios-safari'
  | 'ios-other'
  | 'in-app'
  | 'android'
  | 'desktop'
  | 'unsupported';

export function installPlatform(canPrompt: boolean): InstallPlatform {
  if (isStandalone()) return 'installed';

  // O dialogo nativo esta em maos: nada mais importa.
  if (canPrompt) return 'prompt';

  if (isInAppBrowser()) return 'in-app';

  if (isIos()) return isSafari() ? 'ios-safari' : 'ios-other';

  if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) return 'android';

  if (typeof navigator !== 'undefined' && /Firefox/i.test(navigator.userAgent)) {
    // O Firefox desktop nao instala PWA, e fingir que instala seria pior.
    return 'unsupported';
  }

  return 'desktop';
}

/**
 * O site esta num contexto que permite instalar?
 *
 * Sem HTTPS (ou localhost) o navegador nao registra service worker nem oferece
 * instalacao, e nenhuma instrucao de menu vai resolver. Vale dizer isso em vez
 * de mandar o usuario procurar uma opcao que nao existe ali.
 */
export function isSecureContextForInstall(): boolean {
  if (typeof window === 'undefined') return true;
  return window.isSecureContext;
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

/**
 * Ha uma barra fixa no rodape agora? Qual?
 *
 * Mora aqui, no modulo, e nao dentro do componente da barra, porque DUAS telas
 * precisam da resposta: a barra, para se desenhar, e o Layout, para reservar o
 * espaco dela no rodape do conteudo. Sem essa segunda parte a barra cobre o fim
 * da pagina -- o botao do ultimo card fica atras dela e nao da para tocar.
 *
 * O estado do adiamento tambem vive aqui pelo mesmo motivo: se ficasse no
 * componente, o Layout nao teria como saber que a barra sumiu e continuaria
 * reservando espaco para uma barra que nao existe mais.
 */
const SNOOZE_KEY = '4l.install.snoozedUntil';

/**
 * Quanto tempo o convite some depois de "Agora nao".
 *
 * Antes ele sumia PARA SEMPRE, gravado num booleano. Parecia respeitoso e era
 * uma armadilha: um toque distraido apagava o unico caminho de instalacao que
 * a interface oferecia, sem nenhuma forma de traze-lo de volta a nao ser
 * limpar os dados do site.
 */
const SNOOZE_DAYS = 7;

function readSnooze(): number {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
  } catch {
    // Armazenamento bloqueado: melhor mostrar o convite do que quebrar a tela.
    return 0;
  }
}

let snoozedUntil = typeof window === 'undefined' ? 0 : readSnooze();
const snoozeListeners = new Set<() => void>();

export function snoozeInstall() {
  snoozedUntil = Date.now() + SNOOZE_DAYS * 86_400_000;
  try {
    localStorage.setItem(SNOOZE_KEY, String(snoozedUntil));
  } catch {
    // Sem persistir, o convite volta na proxima visita. Aceitavel.
  }
  for (const listener of snoozeListeners) listener();
}

export type BannerKind = 'update' | 'install' | null;

export function useBottomBanner(): BannerKind {
  const { canPrompt, needsManualSteps } = useInstall();
  const { updateReady } = useServiceWorker();
  const [snoozed, setSnoozed] = useState(snoozedUntil > Date.now());

  useEffect(() => {
    const update = () => setSnoozed(snoozedUntil > Date.now());
    snoozeListeners.add(update);
    return () => {
      snoozeListeners.delete(update);
    };
  }, []);

  // Atualizacao tem prioridade: e a unica das duas que corrige alguma coisa.
  if (updateReady) return 'update';
  if (snoozed || isStandalone()) return null;
  return canPrompt || needsManualSteps ? 'install' : null;
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
