// Screenshot + interaction proof for the account-flow fixture. Run from repo root:
//   node web/.account-flows-harness/shoot.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:4517/.account-flows-harness/fixture.html';
const OUT = '/Users/pengxiao/.codex/account-flows-handoff/screenshots';
const VIEWPORTS = { '1440': { width: 1440, height: 900 }, '390': { width: 390, height: 844 } };
const STATIC = [
  ['login-default', 'modal=login&state=default'],
  ['login-lastused', 'modal=login&state=lastused'],
  ['login-pending', 'modal=login&state=pending'],
  ['login-error', 'modal=login&state=error'],
  ['saved-on-device', 'modal=saved'],
  ['import-default', 'modal=import&state=default'],
  ['import-one', 'modal=import&state=one'],
  ['import-pending', 'modal=import&state=pending'],
  ['import-error', 'modal=import&state=error'],
];

const results = { shots: [], metrics: [], interactions: [], consoleErrors: [] };
const assert = (cond, msg) => { if (!cond) throw new Error('ASSERT: ' + msg); };

async function metrics(page, name) {
  return page.evaluate((name) => {
    const d = document.querySelector('[role="dialog"]');
    const r = d.getBoundingClientRect();
    const t = d.querySelector('h2');
    const btns = [...d.querySelectorAll('.af-provider, .af-btn')].map((b) => {
      const br = b.getBoundingClientRect();
      return { text: b.textContent.trim(), w: Math.round(br.width), h: Math.round(br.height), top: Math.round(br.top) };
    });
    const cs = getComputedStyle(d);
    return {
      name,
      dialog: { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(window.innerWidth - r.right), top: Math.round(r.top), bottom: Math.round(window.innerHeight - r.bottom) },
      bg: cs.backgroundColor, border: cs.borderTopColor, color: cs.color,
      title: { size: getComputedStyle(t).fontSize, align: getComputedStyle(t).textAlign, family: getComputedStyle(t).fontFamily.split(',')[0] },
      buttons: btns,
    };
  }, name);
}

(async () => {
  const browser = await chromium.launch();
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    for (const appearance of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on('console', (m) => { if (m.type() === 'error') results.consoleErrors.push(`${vpName}/${appearance}: ${m.text()}`); });
      page.on('pageerror', (e) => results.consoleErrors.push(`${vpName}/${appearance} pageerror: ${e.message}`));
      for (const [name, qs] of STATIC) {
        await page.goto(`${BASE}?${qs}&appearance=${appearance}`);
        await page.getByRole('dialog').waitFor();
        await page.waitForTimeout(250);
        const file = path.join(OUT, `${name}-${appearance}-${vpName}.png`);
        await page.screenshot({ path: file });
        results.shots.push(file);
        const m = await metrics(page, `${name}-${appearance}-${vpName}`);
        results.metrics.push(m);
        // Viewport-safe: the dialog stays fully inside the viewport.
        assert(m.dialog.left >= 0 && m.dialog.right >= 0 && m.dialog.top >= 0 && m.dialog.bottom >= 0, `${m.name} inside viewport`);
        if (name.startsWith('login')) {
          assert(m.dialog.w <= 400, `${m.name} max 400px`);
          for (const b of m.buttons) assert(b.h === 48, `${m.name} 48px buttons`);
          assert(m.buttons[1].top - m.buttons[0].top - 48 === 12, `${m.name} 12px gap`);
          assert(m.buttons[0].w === m.buttons[1].w, `${m.name} equal width`);
          assert(m.title.size === '24px' && m.title.align === 'center', `${m.name} 24px centred title`);
        }
      }

      // ── Interaction: login pending → failure → retry (both providers) ──
      await page.goto(`${BASE}?modal=login&state=default&appearance=${appearance}`);
      await page.getByTestId('login-google').click();
      await page.getByTestId('login-pending').waitFor();
      assert(await page.getByTestId('login-github').isDisabled(), 'github disabled while google pending');
      await page.screenshot({ path: path.join(OUT, `live-login-pending-${appearance}-${vpName}.png`) });
      await page.getByTestId('login-error').waitFor();
      const errText = await page.getByTestId('login-error').textContent();
      assert(/window was closed/.test(errText) && /use GitHub/.test(errText), 'actionable google failure');
      await page.screenshot({ path: path.join(OUT, `live-login-error-${appearance}-${vpName}.png`) });
      await page.getByTestId('login-github').click();
      await page.getByTestId('login-pending').waitFor();
      assert((await page.getByTestId('login-github').textContent()).includes('Signing in'), 'github pending');
      // Close while pending; reopen is clean; focus returns to the opener.
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Open sign in' }).click();
      await page.getByRole('dialog').waitFor();
      assert(await page.getByTestId('login-pending').count() === 0, 'reopened modal not pending');
      await page.waitForTimeout(700); // old timer fires; fixture parent drops it? (parent-level state)
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      const focused = await page.evaluate(() => document.activeElement?.textContent);
      assert(focused === 'Open sign in', `focus restored to opener, got ${focused}`);
      results.interactions.push(`${vpName}/${appearance}: login pending→error→other provider→close→reopen clean→focus restored OK`);

      // ── Interaction: saved on this device ──
      await page.goto(`${BASE}?modal=saved&appearance=${appearance}`);
      await page.getByRole('button', { name: 'Not now' }).click();
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      await page.getByLabel('editor').fill('A->B: still editing');
      assert(await page.getByRole('dialog').count() === 0, 'saved prompt does not return');
      results.interactions.push(`${vpName}/${appearance}: saved-on-device Not now closes, editing continues OK`);

      // ── Interaction: REAL useImportOnLogin — fail, retry, success ──
      await page.goto(`${BASE}?modal=import-live&appearance=${appearance}`);
      await page.getByTestId('import-confirm').waitFor();
      assert((await page.getByTestId('import-confirm').textContent()) === 'Import 3 diagrams', 'real count excludes ghost');
      await page.getByTestId('import-confirm').click();
      await page.getByText('Importing…').waitFor();
      // Busy: Escape and a second click do nothing.
      await page.keyboard.press('Escape');
      assert(await page.getByTestId('import-dismiss').isDisabled(), 'dismiss disabled while busy');
      await page.screenshot({ path: path.join(OUT, `live-import-pending-${appearance}-${vpName}.png`) });
      await page.getByTestId('import-error').waitFor();
      assert(await page.evaluate(() => localStorage.getItem('askedToImportCreations')) === null, 'flag not set after failure');
      assert(await page.evaluate(() => localStorage.getItem('fx-a')) !== null, 'local record kept');
      await page.screenshot({ path: path.join(OUT, `live-import-error-${appearance}-${vpName}.png`) });
      await page.getByTestId('import-confirm').click(); // Try again
      await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 5000 });
      assert(await page.evaluate(() => localStorage.getItem('askedToImportCreations')) === 'true', 'flag set after success');
      const log = await page.evaluate(() => window.__afLog);
      assert(log.filter((l) => l.startsWith('save#')).length === 2, 'exactly two saves (fail + retry): ' + log.join(' '));
      assert(log[0] === 'save#1:fx-a,fx-b,fx-c', 'ghost excluded from save: ' + log[0]);
      await page.screenshot({ path: path.join(OUT, `live-import-done-${appearance}-${vpName}.png`) });
      results.interactions.push(`${vpName}/${appearance}: import fail→retry→success, 2 saves, flag only after success OK`);
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`shots=${results.shots.length} interactions=${results.interactions.length} consoleErrors=${results.consoleErrors.length}`);
  for (const e of results.consoleErrors) console.log('CONSOLE', e);
})().catch((e) => { console.error(e); process.exit(1); });
