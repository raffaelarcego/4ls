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

const ROUTES = [
  '/',
  '/vocabulario',
  '/estruturas',
  '/base/consulta',
  '/base/tutor',
  '/base/progresso',
];

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

/**
 * A consulta e a tela mais propensa a vazar de lado: ela mostra letras
 * grandes, transliteracao e uma nota de armadilha longa lado a lado.
 */
const reference = {
  languageCode: 'ru',
  title: 'Alfabeto cirílico',
  intro: 'As 33 letras, na ordem em que as armadilhas aparecem — não de А a Я.',
  sortable: true,
  sections: [
    {
      id: 'ru-alfa-2',
      title: 'As três que enganam',
      note: 'Parar de ler Н como "h" e Р como "p" — os dois enganos mais caros do começo.',
      mastery: 62,
      entries: [
        {
          symbol: 'Р р',
          name: 'er',
          sound: 'r de "caro", vibrado com a ponta da língua',
          example: 'рот',
          exampleMeaning: 'boca',
          exampleReading: 'rot',
          trap: 'Parece o P latino, mas é R. "рот" é "rot" (boca), nunca "pot".',
        },
      ],
    },
  ],
  all: [],
};
reference.all = reference.sections.flatMap((s) => s.entries);

const FIXTURES = {
  '/reference/languages': [
    { code: 'ru', name: 'Русский', title: 'Alfabeto cirílico' },
    { code: 'de', name: 'Deutsch', title: 'Como se lê o alemão' },
  ],
  '/reference': reference,
  '/auth/me': user,
  '/dashboard': dashboard,
  '/study/today': dashboard.session,
  '/languages': [
    { id: 'l-en', code: 'en', name: 'English' },
    { id: 'l-es', code: 'es', name: 'Español' },
    { id: 'l-de', code: 'de', name: 'Deutsch' },
    { id: 'l-ru', code: 'ru', name: 'Русский' },
  ],
  '/analytics/time': [
    { date: '2026-09-15', hours: 1.0, languageCode: 'en' },
    { date: '2026-09-16', hours: 0.8, languageCode: 'de' },
  ],
  '/analytics/consistency': { percentage: 78, activeDays: 22, days: 28 },
  // `languages` e obrigatorio: a tela faz `weekly.data.languages.map` sem guarda.
  '/analytics/weekly-review': {
    totalHours: 6.5,
    sessionsCompleted: 6,
    xpEarned: 1240,
    languages: [
      { code: 'en', name: 'English', hours: 2.1, xp: 420 },
      { code: 'de', name: 'Deutsch', hours: 1.6, xp: 380 },
    ],
  },
  // `estimatedCost` e obrigatorio: a tabela chama `.toFixed(4)` direto nele.
  '/analytics/ai-usage': [
    { task: 'plan.create', calls: 12, tokens: 4200, estimatedCost: 0.0123 },
  ],
  // Idem para `topPlayed`.
  '/speech/cache': {
    entries: 3,
    bytes: 128000,
    topPlayed: [{ text: 'рот', languageCode: 'ru', plays: 9 }],
  },
  // Envelopado em `topics` -- a tela le `data.topics`, nao a lista crua.
  '/grammar/topics': {
    topics: [
      {
        id: 't1',
        title: 'O verbo em segunda posição',
        summary:
          'Quando a frase começa por outra coisa, o sujeito cai para depois do verbo.',
        mastery: 45,
        flagged: false,
        attempts: 8,
      },
    ],
  },
  // O painel de interferencia da tela de Estruturas.
  '/errors/interference': [
    {
      id: 'i1',
      from: { code: 'es', name: 'Español' },
      to: { code: 'pt', name: 'Português' },
      categories: ['FALSE_COGNATE', 'WORD_ORDER'],
      occurrences: 5,
      topics: [{ id: 't1', title: 'Ser e estar' }],
    },
  ],
  '/review/due': [],
  '/vocabulary': { items: [], total: 0 },
  '/concepts/lesson': [],
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

  /*
   * Erro de pagina invalida a medida.
   *
   * Uma tela que quebrou renderiza vazio, e vazio nao vaza para os lados --
   * entao ela passava. Foi o que aconteceu com o tutor e o progresso: os dois
   * estouravam num `.map` sobre uma fixture errada e o medidor dava visto nos
   * dois. Medidor que aprova tela quebrada e pior que medidor nenhum, porque
   * da confianca falsa.
   */
  const crashes = [];
  page.on('pageerror', (error) => crashes.push(String(error).slice(0, 160)));

  for (const path of ROUTES) {
    crashes.length = 0;
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
        text: document.body.innerText.trim().length,
        // So os mais externos interessam: um pai que vaza arrasta os filhos.
        offenders: offenders.slice(0, 5),
      };
    }, viewport.width);

    const scrolls = result.scrollWidth > result.clientWidth;
    const leaks = result.offenders.length > 0;
    // Tela praticamente sem texto e tela que nao renderizou. O piso e baixo de
    // proposito: qualquer pagina real do app passa de 40 caracteres.
    const blank = result.text < 40;
    const broke = crashes.length > 0;

    if (scrolls || leaks || blank || broke) {
      failures.push({ viewport: viewport.name, path, ...result });
      console.log(`\n✗ ${viewport.name} (${viewport.width}px) ${path}`);
      if (broke) console.log(`  QUEBROU: ${crashes[0]}`);
      if (blank) console.log(`  EM BRANCO: só ${result.text} caracteres na tela`);
      if (scrolls) {
        console.log(`  scrollWidth ${result.scrollWidth} > clientWidth ${result.clientWidth}`);
      }
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
  console.log(`\n${failures.length} tela(s) com problema.`);
  process.exit(1);
}
console.log('\nTodas as telas renderizam, e nenhuma vaza para os lados.');
