import { test, expect } from '@playwright/test';

const THIRD_PARTY_ERROR_SOURCES = [
  'userscript.js',
  'gtm.js',
  'googletagmanager',
  'google-analytics',
  'analytics.js',
  'clarity.js',
  'clarity.ms',
  'paddle.js',
  'cdn.paddle.com',
  'zaraz',
  'cloudflareinsights',
];

function isThirdPartyError(err) {
  const haystack = `${err?.message || ''}\n${err?.stack || ''}`;
  return THIRD_PARTY_ERROR_SOURCES.some((src) => haystack.includes(src));
}

function previewText(page) {
  return page.evaluate(
    () =>
      document.getElementById('demo-frame')?.contentDocument?.body?.textContent || '',
  );
}

function previewHasParserError(page) {
  return page.evaluate(() => {
    const doc = document.getElementById('demo-frame')?.contentDocument;
    const pre = doc?.querySelector('pre');
    if (!pre) return false;
    const t = pre.textContent || '';
    return /error|syntax|parse/i.test(t);
  });
}

async function waitForEditorReady(page) {
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await expect.poll(async () => previewText(page), { timeout: 15_000 }).toContain('BookLibService');
}

async function setDiagram(page, dsl) {
  await page.evaluate((value) => {
    document.querySelector('.CodeMirror').CodeMirror.setValue(value);
  }, dsl);
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function assertRenderedPreviewLooksValid(page) {
  const metrics = await page.evaluate(() => {
    const doc = document.getElementById('demo-frame')?.contentDocument;
    if (!doc) return null;
    const root =
      doc.querySelector('#mounting-point') ||
      doc.querySelector('[id^="diagram"]') ||
      doc.body;
    const box = root.getBoundingClientRect();
    return {
      width: box.width,
      height: box.height,
      nodeCount: root.querySelectorAll('*').length,
      hasSvg: doc.querySelectorAll('svg').length > 0,
      textLength: (doc.body?.textContent || '').trim().length,
    };
  });
  expect(metrics).not.toBeNull();
  expect(metrics.hasSvg).toBe(true);
  expect(metrics.width).toBeGreaterThan(200);
  expect(metrics.height).toBeGreaterThan(120);
  expect(metrics.nodeCount).toBeGreaterThan(20);
  expect(metrics.textLength).toBeGreaterThan(0);
}

/** Capture iframe + SVG screenshots and attach to the HTML report for visual review. */
async function attachRenderedScreenshots(page, testInfo, slug) {
  const frame = page.frameLocator('#demo-frame');
  const previewRoot = frame.locator('#mounting-point, [id^="diagram"], body').first();
  await expect(previewRoot).toBeVisible();

  const diagramPng = await previewRoot.screenshot();
  await testInfo.attach(`render-diagram-${slug}.png`, {
    body: diagramPng,
    contentType: 'image/png',
  });

  const framePng = await page.locator('#demo-frame').screenshot();
  await testInfo.attach(`render-frame-${slug}.png`, {
    body: framePng,
    contentType: 'image/png',
  });

  // Editor + live preview — full-page context for spot-check review.
  const appPng = await page.screenshot({ fullPage: false });
  await testInfo.attach(`render-app-${slug}.png`, {
    body: appPng,
    contentType: 'image/png',
  });
}

// Representative DSL shapes beyond smoke.spec.js — mirrors core cy fixtures.
const DSL_CASES = [
  {
    name: 'async arrow messages',
    dsl: `A
B
A->B: async_ping
B->A: async_pong`,
    mustContain: ['async_ping', 'async_pong'],
  },
  {
    name: 'par fragment',
    dsl: `A
B
par {
  A.parOne()
  B.parTwo()
}`,
    mustContain: ['parOne', 'parTwo'],
  },
  {
    name: 'opt fragment',
    dsl: `A
opt {
  A.optOnly()
}`,
    mustContain: ['optOnly'],
  },
  {
    name: 'return inside method',
    dsl: `A
B
A.call() {
  return ret_marker
}`,
    mustContain: ['ret_marker'],
  },
  {
    name: 'nested if inside method',
    dsl: `A
B
A.outer() {
  if (inner) {
    B.innerCall()
  }
}`,
    mustContain: ['innerCall'],
  },
  {
    name: 'nested interaction with fragment',
    dsl: `A
B
A.Read() {
  B.Submit() {
    if (flag) {
      B.Callback()
    }
  }
}`,
    mustContain: ['Callback'],
  },
  {
    name: 'try/catch with par and opt',
    dsl: `A
B
C
try {
  par {
    A.tryPar()
    B.tryPar()
  }
} catch (e) {
  opt {
    C.catchOpt()
  }
}`,
    mustContain: ['tryPar', 'catchOpt'],
  },
  {
    name: 'loop with body call',
    dsl: `A
while (running) {
  A.loopBody()
}`,
    mustContain: ['loopBody'],
  },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('loginAndsaveMessageSeen', 'true');
  });

  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });

  await page.goto('/');
});

for (const { name, dsl, mustContain } of DSL_CASES) {
  test(`DSL spot-check: ${name}`, async ({ page }, testInfo) => {
    const slug = slugify(name);
    await waitForEditorReady(page);
    await setDiagram(page, dsl);

    await expect
      .poll(async () => previewHasParserError(page), { timeout: 15_000 })
      .toBe(false);

    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              !!document.getElementById('demo-frame')?.contentDocument?.querySelector('svg'),
          ),
        { timeout: 15_000 },
      )
      .toBe(true);

    for (const label of mustContain) {
      await expect.poll(async () => previewText(page), { timeout: 15_000 }).toContain(label);
    }

    await attachRenderedScreenshots(page, testInfo, slug);
    await assertRenderedPreviewLooksValid(page);
  });
}
