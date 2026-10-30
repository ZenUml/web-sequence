// Browser validation, round 2. Two parts:
//  A. Share panel states — REAL ShareButton/SharePopover/useShare in the harness page on the
//     dev server (:4432). Backend calls are deferred fixtures resolved from this script.
//     Clipboard denial is SIMULATED with an init script.
//  B. Browser Back onto a shared URL — REAL app, production build (:4431), /get-shared-item
//     answered by route fixtures (SIMULATED 503 / 403 / network drop).
// Every non-localhost request is aborted; nothing reaches production.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire('/Users/pengxiao/.codex/worktrees/share-visitor-claude/web-sequence/package.json');
const { chromium } = require('playwright');

const DEV = process.env.DEV ?? 'http://localhost:4432';
const PREVIEW = process.env.PREVIEW ?? 'http://localhost:4431';
const OUT = process.env.OUT ?? '/Users/pengxiao/.codex/worktrees/share-visitor-claude/web-sequence/share-status-screenshots/round2';
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const browser = await chromium.launch();

async function isolate(page) {
  const external = new Set();
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return route.continue();
    external.add(u.hostname);
    return route.abort();
  });
  await page.route('**/track', (route) => route.fulfill({ status: 200, body: '{}' }));
  return external;
}

// ── A. Share panel states ───────────────────────────────────────────────────────
const LINK = 'http://localhost:4432/?id=demo&share-token=fixture-token';
async function panelPage({ width, height, appearance, denyClipboard = false }) {
  const context = await browser.newContext({ viewport: { width, height } });
  if (!denyClipboard) await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: DEV });
  if (denyClipboard) {
    await context.addInitScript(() => {
      // SIMULATED clipboard denial (e.g. permission blocked / insecure context).
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) },
      });
    });
  }
  const page = await context.newPage();
  await isolate(page);
  await page.goto(`${DEV}/@fs/tmp/share-status-cfg/harness/index.html?appearance=${appearance}`);
  await page.getByTestId('share-button').click();
  await page.getByTestId('share-panel').waitFor();
  return { context, page };
}
const ctl = {
  pending: (page, kind) => page.evaluate((k) => window.__share[k].length, kind),
  resolve: (page, kind, value) => page.evaluate(([k, v]) => window.__share[k].shift().resolve(v), [kind, value]),
  reject: (page, kind) => page.evaluate((k) => window.__share[k].shift().reject(new Error('Failed to create share link')), kind),
};
async function shot(page, name) {
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
async function panelBg(page) {
  return page.locator('.share-panel').evaluate((el) => getComputedStyle(el).backgroundColor);
}

for (const vp of [{ tag: 'desktop1440', width: 1440, height: 960 }, { tag: 'narrow390', width: 390, height: 844 }]) {
  for (const appearance of ['light', 'dark']) {
    const L = `${vp.tag}-${appearance}`;
    const expectBg = appearance === 'dark' ? 'rgb(52, 63, 75)' : 'rgb(255, 255, 255)';
    {
      const { context, page } = await panelPage({ ...vp, appearance });
      const panel = page.getByTestId('share-panel');
      check(`${L} create: state`, (await panel.getAttribute('data-state')) === 'create');
      check(`${L} create: sentence`, (await panel.textContent()).includes('Anyone with the link can view this diagram.'));
      check(`${L} create: panel follows theme`, (await panelBg(page)) === expectBg, await panelBg(page));
      const box = await page.locator('.share-panel').boundingBox();
      check(`${L} create: panel inside viewport`, box.x >= 0 && box.x + box.width <= vp.width, JSON.stringify(box));
      await shot(page, `panel-create-${L}`);

      // Double click → exactly one backend request; no link before confirmation.
      await page.getByTestId('share-create').dblclick();
      check(`${L} creating: single request`, (await ctl.pending(page, 'create')) === 1);
      check(`${L} creating: busy + disabled`,
        (await page.getByTestId('share-create').isDisabled()) && (await page.getByTestId('share-create').getAttribute('aria-busy')) === 'true');
      check(`${L} creating: no link yet`, (await page.getByTestId('share-url').count()) === 0);
      await shot(page, `panel-creating-${L}`);

      await ctl.reject(page, 'create'); // SIMULATED create failure
      await page.getByRole('alert').waitFor();
      check(`${L} create failed: guidance`, (await page.getByRole('alert').textContent()).includes('Couldn’t create a link.'));
      check(`${L} create failed: Try again`, (await page.getByTestId('share-create').textContent()).includes('Try again'));
      await shot(page, `panel-create-failed-SIMULATED-${L}`);

      await page.getByTestId('share-create').click();
      await ctl.resolve(page, 'create', { url: LINK, md5: 'm' });
      await page.getByTestId('share-url').waitFor();
      check(`${L} created: url after confirmation`, (await page.getByTestId('share-url').inputValue()) === LINK);
      const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      check(`${L} created: focus moved to Copy`, focused === 'share-copy', focused);
      await shot(page, `panel-created-${L}`);

      await page.getByTestId('share-copy').click();
      await page.getByText('Link copied to clipboard.').waitFor();
      const clip = await page.evaluate(() => navigator.clipboard.readText());
      check(`${L} copied: clipboard holds the link`, clip === LINK, clip);
      check(`${L} copied: button confirms`, (await page.getByTestId('share-copy').textContent()).includes('Copied'));
      await shot(page, `panel-copied-${L}`);

      await page.getByTestId('share-stop').click();
      await page.getByTestId('share-stop').click({ force: true, trial: false }).catch(() => {});
      check(`${L} stopping: single request`, (await ctl.pending(page, 'stop')) === 1);
      check(`${L} stopping: Stop busy/disabled, link kept`,
        (await page.getByTestId('share-stop').isDisabled()) && (await page.getByTestId('share-url').count()) === 1);
      await shot(page, `panel-stopping-${L}`);

      await ctl.reject(page, 'stop'); // SIMULATED stop failure
      await page.getByRole('alert').waitFor();
      check(`${L} stop failed: link still active`, (await page.getByRole('alert').textContent()).includes('Your link is still active.')
        && (await page.getByTestId('share-url').count()) === 1);
      await shot(page, `panel-stop-failed-SIMULATED-${L}`);

      await page.getByTestId('share-stop').click();
      await ctl.resolve(page, 'stop');
      await page.getByTestId('share-create').waitFor();
      check(`${L} stopped: back to create, link gone`, (await page.getByTestId('share-url').count()) === 0);
      check(`${L} no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await context.close();
    }
    {
      const { context, page } = await panelPage({ ...vp, appearance, denyClipboard: true });
      await page.getByTestId('share-create').click();
      await ctl.resolve(page, 'create', { url: LINK, md5: 'm' });
      await page.getByTestId('share-copy').click();
      await page.getByTestId('share-copy-error').waitFor();
      const sel = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.getAttribute('data-testid') === 'share-url' ? el.value.slice(el.selectionStart, el.selectionEnd) : null;
      });
      check(`${L} copy failed: link selected for manual copy`, sel === LINK, sel);
      check(`${L} copy failed: no false Copied`, !(await page.getByTestId('share-copy').textContent()).includes('Copied'));
      await shot(page, `panel-copy-failed-SIMULATED-${L}`);
      await context.close();
    }
  }
}

// ── B. Browser Back onto a shared URL (real app, production build) ──────────────
const SHARE = '/?id=fixture-item&share-token=fixture-token';
const item = (title) => ({
  id: 'fixture-item', title, js: 'Alice->Bob: pay()', css: '', html: '',
  htmlMode: 'html', cssMode: 'css', jsMode: 'js',
  pages: [{ id: 'p1', title: 'Main', js: 'Alice->Bob: pay()', css: '' }], currentPageId: 'p1', isReadOnly: true,
});
async function appPage({ width, height, appearance }) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript((a) => {
    localStorage.setItem('appearance', JSON.stringify(a));
    localStorage.setItem('onboarded', 'true');
    localStorage.setItem('lastSeenVersion', JSON.stringify('2026.6.7'));
    localStorage.setItem('pledgeModalSeen', 'true');
  }, appearance);
  const page = await context.newPage();
  await isolate(page);
  const calls = [];
  const waiters = [];
  await page.route('**/get-shared-item*', (route) => {
    const u = new URL(route.request().url());
    calls.push({ id: u.searchParams.get('id'), token: u.searchParams.get('share-token'), route });
    waiters.splice(0).forEach((w) => w());
  });
  const nth = async (n) => { while (calls.length < n) await new Promise((r) => waiters.push(r)); return calls[n - 1]; };
  return { context, page, calls, nth };
}
const ok = (route, title) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(item(title)) });

for (const vp of [{ tag: 'desktop1440', width: 1440, height: 960 }, { tag: 'narrow390', width: 390, height: 844 }]) {
  for (const appearance of ['light', 'dark']) {
    const L = `${vp.tag}-${appearance}`;
    // Loaded share → Diagrams (hub) → browser Back: re-read same id/token, title back.
    {
      const { context, page, calls, nth } = await appPage({ ...vp, appearance });
      await page.goto(PREVIEW + SHARE);
      await ok((await nth(1)).route, 'Checkout flow (fixture)');
      await page.getByTestId('header-title').waitFor();
      await page.getByTestId('header-go-home').click();
      await page.waitForURL(/view=diagrams/);
      await page.goBack();
      const second = await nth(2);
      await page.locator('[data-testid="share-visitor-status"][data-status="loading"]').waitFor();
      check(`${L} back: loading view (not blank) while re-reading`, true);
      check(`${L} back: same id/token re-read`, second.id === 'fixture-item' && second.token === 'fixture-token');
      await shot(page, `back-loading-${L}`);
      await ok(second.route, 'Checkout flow (fixture)');
      await page.getByTestId('header-title').waitFor();
      check(`${L} back: original title + read-only`,
        (await page.getByTestId('header-title').inputValue()) === 'Checkout flow (fixture)'
        && (await page.getByTestId('header-savestate').getAttribute('data-state')) === 'readonly');
      check(`${L} back: exactly 2 reads`, calls.length === 2, String(calls.length));
      await shot(page, `back-loaded-${L}`);
      await context.close();
    }
  }
}

// Pending → Diagrams → Back; stale first response dropped. Then failure variants (1440 light).
{
  const { context, page, calls, nth } = await appPage({ width: 1440, height: 960, appearance: 'light' });
  await page.goto(PREVIEW + SHARE);
  const first = await nth(1);
  await page.getByTestId('header-go-home').click();
  await page.waitForURL(/view=diagrams/);
  await page.goBack();
  const second = await nth(2);
  await ok(second.route, 'Fresh title');
  await page.getByTestId('header-title').waitFor();
  await ok(first.route, 'STALE title');
  await page.waitForTimeout(400);
  check('pending→hub→back: fresh response shown, stale dropped',
    (await page.getByTestId('header-title').inputValue()) === 'Fresh title', await page.getByTestId('header-title').inputValue());
  check('pending→hub→back: 2 reads', calls.length === 2);
  await context.close();
}
{
  const { context, page, nth } = await appPage({ width: 1440, height: 960, appearance: 'light' });
  await page.goto(PREVIEW + SHARE);
  await ok((await nth(1)).route, 'Checkout flow (fixture)');
  await page.getByTestId('header-title').waitFor();
  await page.getByTestId('header-go-home').click();
  await page.waitForURL(/view=diagrams/);
  await page.goBack();
  await (await nth(2)).route.abort('internetdisconnected'); // SIMULATED network drop
  await page.getByRole('button', { name: 'Try again' }).waitFor();
  check('back offline: retry view, not invalid-link notice', (await page.getByTestId('share-error').count()) === 0);
  await shot(page, 'back-offline-SIMULATED-desktop1440-light');
  await page.getByRole('button', { name: 'Try again' }).click();
  const third = await nth(3);
  check('back offline: Try again re-reads same id/token', third.id === 'fixture-item' && third.token === 'fixture-token');
  await third.route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Invalid share token or item not shared"}' }); // SIMULATED revocation
  await page.getByTestId('share-error').waitFor();
  check('back revoked after retry: unavailable notice, no editor', (await page.getByTestId('dsl-editor').count()) === 0);
  await shot(page, 'back-revoked-SIMULATED-desktop1440-light');
  await context.close();
}

await browser.close();
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
