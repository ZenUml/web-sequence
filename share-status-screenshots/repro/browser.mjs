// Real-browser validation of the shared-link visitor status states against the
// local production build (vite preview :4398). ALL failures are SIMULATED via
// page.route fixtures; every non-localhost request is aborted (no production calls).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire('/Users/pengxiao/.codex/worktrees/share-visitor-claude/web-sequence/package.json');
const { chromium } = require('playwright');

const BASE = process.env.BASE ?? 'http://localhost:4398';
const OUT = process.env.OUT ?? '/Users/pengxiao/.codex/worktrees/share-visitor-claude/web-sequence/share-status-screenshots';
mkdirSync(OUT, { recursive: true });
const URL_PATH = '/?id=fixture-item&share-token=fixture-token';

const fixtureItem = {
  id: 'fixture-item',
  title: 'Checkout flow (fixture)',
  js: 'Alice->Bob: pay()\nBob->Alice: receipt',
  css: '',
  html: '',
  htmlMode: 'html', cssMode: 'css', jsMode: 'js',
  pages: [
    { id: 'p1', title: 'Main', js: 'Alice->Bob: pay()\nBob->Alice: receipt', css: '' },
    { id: 'p2', title: 'Refund', js: 'Bob->Alice: refund()', css: '' },
  ],
  currentPageId: 'p1',
  isShared: true,
  isReadOnly: true,
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const browser = await chromium.launch();

async function newPage({ width, height, appearance }) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript((appearance) => {
    localStorage.setItem('appearance', JSON.stringify(appearance));
    localStorage.setItem('onboarded', 'true');
    localStorage.setItem('lastSeenVersion', JSON.stringify('2026.6.7'));
    localStorage.setItem('pledgeModalSeen', 'true');
  }, appearance);
  const page = await context.newPage();
  const external = [];
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return route.continue();
    external.push(u.hostname);
    return route.abort();
  });
  // /track (analytics) is answered locally; nothing leaves the machine.
  await page.route('**/track', (route) => route.fulfill({ status: 200, body: '{}' }));
  return { context, page, external };
}

// Holds every get-shared-item request; the test decides each response.
async function controlShared(page) {
  const calls = [];
  const waiters = [];
  await page.route('**/get-shared-item*', (route) => {
    const u = new URL(route.request().url());
    calls.push({ id: u.searchParams.get('id'), token: u.searchParams.get('share-token'), route });
    waiters.splice(0).forEach((w) => w());
  });
  const nth = async (n) => {
    while (calls.length < n) await new Promise((r) => waiters.push(r));
    return calls[n - 1];
  };
  return { calls, nth };
}

const respond = {
  ok: (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtureItem) }),
  // SIMULATED transient failure (Firebase Functions 503 / 500 shape).
  unavailable503: (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Service Unavailable"}' }),
  // SIMULATED revoked link (exact backend 403 body).
  revoked403: (route) => route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Invalid share token or item not shared"}' }),
  networkDown: (route) => route.abort('internetdisconnected'),
};

async function noHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

const viewports = [
  { tag: 'desktop1440', width: 1440, height: 960 },
  { tag: 'narrow390', width: 390, height: 844 },
];

for (const vp of viewports) {
  for (const appearance of ['light', 'dark']) {
    const label = `${vp.tag}-${appearance}`;

    // ── Loading (deferred fixture; request held open) ──────────────────────────
    {
      const { context, page, external } = await newPage({ ...vp, appearance });
      const shared = await controlShared(page);
      await page.goto(BASE + URL_PATH);
      await shared.nth(1);
      const view = page.locator('[data-testid="share-visitor-status"][data-status="loading"]');
      await view.waitFor();
      const htmlAppearance = await page.evaluate(() => document.documentElement.dataset.appearance);
      check(`${label} loading: <html data-appearance> = ${appearance}`, htmlAppearance === appearance, htmlAppearance);
      const title = await page.getByTestId('share-status-title').textContent();
      check(`${label} loading: header title "Loading diagram…"`, title === 'Loading diagram…', title);
      check(`${label} loading: no Fork/Present/editable title/editor`,
        (await page.locator('[data-testid="header-fork"],[data-testid="header-present"],[data-testid="header-title"],[data-testid="dsl-editor"]').count()) === 0);
      check(`${label} loading: role=status announces`, (await page.getByRole('status').textContent())?.includes('Loading diagram…'));
      const panelBg = await page.getByTestId('share-status-panel').evaluate((el) => getComputedStyle(el).backgroundColor);
      const expectBg = appearance === 'dark' ? 'rgb(52, 63, 75)' : 'rgb(255, 255, 255)';
      check(`${label} loading: panel surface ${expectBg}`, panelBg === expectBg, panelBg);
      check(`${label} loading: no horizontal overflow`, await noHorizontalOverflow(page));
      await page.waitForTimeout(150); // let fonts settle; no forced delay in the app
      await page.screenshot({ path: `${OUT}/loading-${label}.png` });
      check(`${label} loading: no external requests leaked`, true, `aborted: ${[...new Set(external)].join(', ') || 'none'}`);
      await context.close();
    }

    // ── Failure (SIMULATED 503) → Try again → success, proving a fresh request ──
    {
      const { context, page } = await newPage({ ...vp, appearance });
      const shared = await controlShared(page);
      await page.goto(BASE + URL_PATH);
      const first = await shared.nth(1);
      await respond.unavailable503(first.route);
      await page.locator('[data-testid="share-visitor-status"][data-status="retryable-error"]').waitFor();
      const alertText = await page.getByRole('alert').textContent();
      check(`${label} failure: alert text`, alertText === 'Couldn’t load this diagram' + 'Check your connection and try again.', alertText);
      check(`${label} failure: header title "Shared link"`, (await page.getByTestId('share-status-title').textContent()) === 'Shared link');
      check(`${label} failure: not the dead-link dialog`, (await page.getByTestId('share-error').count()) === 0);
      const bodyText = await page.locator('body').innerText();
      check(`${label} failure: no token/id/status leak`, !/fixture-token|fixture-item|503|Service Unavailable/.test(bodyText));
      check(`${label} failure: no horizontal overflow`, await noHorizontalOverflow(page));
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${OUT}/failure-${label}-SIMULATED-503.png` });

      // Keyboard retry: Tab to "Try again" and press Enter.
      const retry = page.getByRole('button', { name: 'Try again' });
      await retry.focus();
      await page.keyboard.press('Enter');
      const second = await shared.nth(2);
      check(`${label} retry: fresh request #2 issued`, shared.calls.length === 2);
      check(`${label} retry: same id/token`, second.id === 'fixture-item' && second.token === 'fixture-token', `${second.id}/${second.token}`);
      await page.locator('[data-testid="share-visitor-status"][data-status="loading"]').waitFor();
      const focusOnPanel = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      check(`${label} retry: focus moved to status panel`, focusOnPanel === 'share-status-panel', focusOnPanel);
      // A second activation while loading cannot issue another request.
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      check(`${label} retry: no duplicate request while loading`, shared.calls.length === 2, String(shared.calls.length));
      await respond.ok(second.route);
      const titleInput = page.getByTestId('header-title');
      await titleInput.waitFor();
      check(`${label} success: original title`, (await titleInput.inputValue()) === 'Checkout flow (fixture)');
      check(`${label} success: title read-only`, await titleInput.evaluate((el) => el.readOnly));
      check(`${label} success: save state Read-only`,
        (await page.getByTestId('header-savestate').getAttribute('data-state')) === 'readonly');
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/success-after-retry-${label}.png` });
      await context.close();
    }
  }
}

// ── Explicit permanent conditions keep the existing unavailable-link notice ────
for (const [name, handler] of [['revoked403-after-retry', 'revoked'], ['initial404', '404']]) {
  const { context, page } = await newPage({ width: 1440, height: 960, appearance: 'light' });
  const shared = await controlShared(page);
  await page.goto(BASE + URL_PATH);
  const first = await shared.nth(1);
  if (handler === 'revoked') {
    await respond.networkDown(first.route); // SIMULATED network drop
    await page.getByRole('button', { name: 'Try again' }).click();
    const second = await shared.nth(2);
    await respond.revoked403(second.route); // SIMULATED revocation between attempts
  } else {
    await first.route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Item not found"}' });
  }
  await page.getByTestId('share-error').waitFor();
  check(`${name}: unavailable notice shown`, true);
  check(`${name}: no editor/source rendered`, (await page.locator('[data-testid="dsl-editor"]').count()) === 0);
  await page.screenshot({ path: `${OUT}/unavailable-${name}-SIMULATED.png` });
  await context.close();
}

// ── Navigating away while loading: late data must not take over ───────────────
{
  const { context, page } = await newPage({ width: 1440, height: 960, appearance: 'light' });
  const shared = await controlShared(page);
  await page.goto(BASE + URL_PATH);
  const first = await shared.nth(1);
  await page.getByTestId('header-go-home').click();
  await page.waitForURL(/view=diagrams/);
  await respond.ok(first.route);
  await page.waitForTimeout(500);
  check('navigate-away: hub stays, shared item not opened',
    (await page.locator('[data-testid="header-title"]').count()) === 0 && /view=diagrams/.test(page.url()), page.url());
  await context.close();
}

await browser.close();
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
