/**
 * Mede se alguma tela vaza para os lados num celular estreito.
 *
 * Este arquivo existe por causa de um bug real: a trilha do dashboard desloca
 * os nos 24px para cada lado com `translate-x`, e os nos eram `w-full` -- o da
 * direita terminava 24px fora da tela e o celular passava a arrastar de lado.
 *
 * O `overflow-x: clip` do documento ESCONDE esse sintoma, e e justamente por
 * isso que ele precisa ser medido por fora: com o vazamento clipado, a pagina
 * para de arrastar mas o pedaco cortado continua la, e um botao que termina na
 * faixa cortada fica sem metade da area de toque. Olhar no navegador nao pega;
 * comparar `scrollWidth` com `clientWidth` pega.
 *
 * Uso:
 *   npx vite build && node tools/check-layout.mjs
 *
 * Sai com codigo 1 quando alguma largura estoura, para poder entrar em CI.
 */

import { chromium } from 'playwright';
import { createServer } from 'vite';

/** Aparelhos que importam: o mais estreito em uso e o comum. */
const VIEWPORTS = [
  { name: 'iPhone SE', width: 320, height: 568 },
  { name: 'Android comum', width: 360, height: 800 },
  { name: 'iPhone 14', width: 390, height: 844 },
];

const ROUTES = ['/', '/vocabulario', '/estruturas', '/progresso'];

const user = { id: 'u1', name: 'Raffael', email: 'raffael@example.com' };

const activity = (id, type, languageCode, languageName, completed, order) => ({
  id,
  languageCode,
  languageName,
  pillar: 'LEARN',
  type,
  order,
  plannedMinutes: 6,
  durationSeconds: 0,
  completed,
  score: null,
  xpEarned: 0,
  // Texto longo de proposito: motivo curto esconderia quebra de layout.
  reason:
    'As primeiras peças da frase, do zero. Sem elas, toda aula depois soa como língua estrangeira sobre língua estrangeira.',
});

const language = (code, name) => ({
  id: `l-${code}`,
  code,
  name,
  currentLevel: 'A1',
  targetLevel: 'B2',
  minutesPerDay: 15,
  compositeScore: 42,
  suggestedLevel: 'A1',
  skills: { listening: 40, reading: 35, writing: 30, speaking: 25, vocabScore: 45, grammar: 38 },
  dueReviews: 12,
  vocabulary: { total: 420, learning: 80, mastered: 120 },
  topErrors: [
    {
      id: 'e1',
      category: 'WORD_ORDER',
      description: 'Verbo fora da segunda posição em frases com advérbio inicial',
      occurrenceCount: 7,
    },
  ],
});

const dashboard = {
  session: {
    id: 's1',
    date: new Date().toISOString(),
    plannedMinutes: 60,
    durationSeconds: 0,
    xpEarned: 0,
    completed: false,
    rationale:
      'Os mesmos conceitos em todos os idiomas, cada um com a sua regra de frase. Foco extra: Deutsch em foundation.',
    activities: [
      activity('a1', 'contrast', 'en', 'English', true, 0),
      activity('a2', 'structure', 'en', 'English', true, 1),
      activity('a3', 'vocabulary', 'en', 'English', false, 2),
      activity('a4', 'foundation', 'de', 'Deutsch', false, 3),
      activity('a5', 'vocabulary', 'de', 'Deutsch', false, 4),
      activity('a6', 'alphabet', 'ru', 'Русский', false, 5),
      activity('a7', 'compare', 'en', 'English', false, 6),
    ],
  },
  languages: [
    language('en', 'English'),
    language('es', 'Español'),
    language('de', 'Deutsch'),
    language('ru', 'Русский'),
  ],
  streak: { current: 7, longest: 14 },
  xp: {
    today: 180,
    week: 1240,
    total: 4820,
    progress: {
      level: 7,
      title: 'Intérprete',
      xpIntoLevel: 820,
      xpForLevel: 2000,
      xpRemaining: 1180,
      percent: 41,
    },
  },
  aiEnabled: true,
};

const FIXTURES = {
  '/auth/me': user,
  '/dashboard': dashboard,
  '/study/today': dashboard.session,
  '/review/due': [],
  '/vocabulary': { items: [], total: 0 },
  '/concepts/lesson': [],
  '/grammar/topics': [],
  '/analytics/overview': {},
};

function fixtureFor(url) {
  const path = new URL(url).pathname.replace(/^\/api/, '');
  for (const [key, value] of Object.entries(FIXTURES)) {
    if (path === key || path.startsWith(`${key}/`)) return value;
  }
  // Rota nao prevista devolve vazio em vez de 404: o objetivo aqui e medir
  // largura, e uma tela de erro tambem tem largura a medir.
  return {};
}

const server = await createServer({ server: { port: 5199 }, logLevel: 'error' });
await server.listen();
const base = `http://localhost:5199`;

const browser = await chromium.launch();
const failures = [];

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  await context.addInitScript(() => {
    window.localStorage.setItem('4l.token', 'test-token');
  });

  await context.route('**/api/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixtureFor(route.request().url())),
    });
  });

  const page = await context.newPage();

  for (const path of ROUTES) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    // Uma batida de animacao, para o halo e o sprite assentarem antes da medida.
    await page.waitForTimeout(400);

    const result = await page.evaluate((vw) => {
      const doc = document.documentElement;

      /*
       * Um elemento largo NAO e problema quando algum ancestral o corta.
       *
       * Duas construcoes legitimas do app caem nisso: a faixa `.hscroll`, que
       * rola de lado de proposito (filtros, tira comparativa), e o halo
       * `-right-6` dentro de um painel `overflow-hidden`. Nos dois casos o
       * elemento passa da largura da tela e nunca chega a vazar para o
       * documento. Sem esta checagem o medidor grita nos dois e vira ruido --
       * e medidor que grita a toa deixa de ser lido.
       */
      const isClipped = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const overflowX = getComputedStyle(p).overflowX;
          if (overflowX !== 'visible') return true;
        }
        return false;
      };

      // Quem realmente ultrapassa a largura da tela. `getBoundingClientRect`
      // ja inclui o `transform`, que e exatamente o que causou o bug original.
      const offenders = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right <= vw + 1 && r.left >= -1) continue;
        if (isClipped(el)) continue;
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.getAttribute('class') ?? '').slice(0, 90),
          left: Math.round(r.left),
          right: Math.round(r.right),
        });
      }
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        // So os mais externos interessam: um pai que vaza arrasta os filhos.
        offenders: offenders.slice(0, 5),
      };
    }, viewport.width);

    const scrolls = result.scrollWidth > result.clientWidth;
    const leaks = result.offenders.length > 0;

    if (scrolls || leaks) {
      failures.push({ viewport: viewport.name, path, ...result });
      console.log(`\n✗ ${viewport.name} (${viewport.width}px) ${path}`);
      console.log(`  scrollWidth ${result.scrollWidth} > clientWidth ${result.clientWidth}`);
      for (const o of result.offenders) {
        console.log(`  ${o.left}..${o.right}  <${o.tag} class="${o.cls}">`);
      }
    } else {
      console.log(`✓ ${viewport.name} (${viewport.width}px) ${path}`);
    }
  }

  await context.close();
}

await browser.close();
await server.close();

if (failures.length > 0) {
  console.log(`\n${failures.length} tela(s) vazando para os lados.`);
  process.exit(1);
}
console.log('\nNenhum vazamento horizontal.');
