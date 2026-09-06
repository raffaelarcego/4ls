/*
 * Service worker do 4L.
 *
 * Existe por dois motivos, nesta ordem: um service worker com handler de fetch
 * e requisito para o navegador oferecer a instalacao do app, e abrir o app sem
 * rede tem de mostrar a tela do app, nao o dinossauro do Chrome.
 *
 * O que ele deliberadamente NAO faz: guardar respostas da API. O app inteiro e
 * estado do aluno (sessao do dia, progresso, revisoes vencidas) e servir isso
 * de um cache produziria uma tela que parece atual e nao e -- pior que uma tela
 * de erro honesta. Estudo offline de verdade e outra feature: precisaria de
 * fila de sincronizacao e resolucao de conflito.
 */

const VERSION = 'v1';
const SHELL = `4l-shell-${VERSION}`;
const ASSETS = `4l-assets-${VERSION}`;

/*
 * So o que existe em caminho fixo. Os bundles do Vite tem hash no nome e
 * mudam a cada build, entao entram no cache em runtime (ver abaixo) em vez de
 * numa lista aqui, que ficaria desatualizada no primeiro deploy.
 */
const SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // addAll falha inteiro se um item falhar; aqui um icone ausente nao pode
      // impedir o service worker de instalar.
      .then((cache) => Promise.allSettled(SHELL_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  // Usado pelo aviso de "nova versao" no app.
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Outra origem: a API, o Google Fonts, o que for. Deixa passar direto --
  // cachear resposta de API aqui seria mostrar progresso velho como se fosse
  // o atual.
  if (url.origin !== self.location.origin) return;

  // Navegacao (abrir o app, recarregar, link direto numa rota): tenta a rede e
  // cai para a casca em cache. Como e uma SPA, qualquer rota e servida pelo
  // mesmo index.html, entao a casca basta para o app abrir offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(async () => (await caches.match('/')) ?? Response.error()),
    );
    return;
  }

  // Bundles com hash no nome sao imutaveis: se esta em cache, e o arquivo
  // certo, e ir a rede so gastaria tempo.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSETS).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Resto do proprio site (icones, manifest): rede primeiro, cache como rede
  // de seguranca.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) ?? Response.error()),
  );
});
