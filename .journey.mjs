// Real-browser acceptance journey for the core editor. Writes screenshots to web/.shots/final.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const OUT = 'web/.shots/final';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE ?? 'http://localhost:4411/';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); };
const seed = () => { localStorage.setItem('onboarded', 'true'); localStorage.setItem('pledgeModalSeen', 'true'); localStorage.setItem('lastSeenVersion', JSON.stringify('99.0.0')); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, acceptDownloads: true });
await ctx.addInitScript(seed);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE);
await page.waitForSelector('[data-testid=header-title]');
await page.waitForTimeout(3500);
const box = async (sel) => { const b = await page.locator(sel).first().boundingBox(); return b && [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };

// Geometry
const header = await box('header'); const card = await box('.editor-preview-panel');
check('header 56px', header[3] === 56, JSON.stringify(header));
check('preview card x392 y68 1036x880', JSON.stringify(card) === '[392,68,1036,880]', JSON.stringify(card));
check('header buttons 36px', (await box('[data-testid=header-present]'))[3] === 36);
const fork = await box('[data-testid=header-fork]'), share = await box('[data-testid=share-button]'), present = await box('[data-testid=header-present]'), theme = await box('[data-testid=header-appearance]'), login = await box('[data-testid=header-login]');
check('action gaps 12/12', share[0] - (fork[0] + fork[2]) === 12 && present[0] - (share[0] + share[2]) === 12, `${share[0] - (fork[0] + fork[2])},${present[0] - (share[0] + share[2])}`);
check('Present->theme 24, theme->account 8', theme[0] - (present[0] + present[2]) === 24 && login[0] - (theme[0] + theme[2]) === 8, `${theme[0] - (present[0] + present[2])},${login[0] - (theme[0] + theme[2])}`);
check('no horizontal overflow 1440', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
check('no DSL heading', (await page.getByText('DSL', { exact: true }).count()) === 0);
check('no "click to expand" filler', (await page.getByText(/click to expand/i).count()) === 0);
check('no "No issues" badge', (await page.getByText(/no issues/i).count()) === 0);
check('no renderer Present', (await page.locator('[data-testid=renderer-present]').count()) === 0);
check('no title menu arrow', (await page.locator('[data-testid=filemenu-trigger]').count()) === 0);
const saveText = await page.locator('[data-testid=header-savestate]').innerText();
const storedItems = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('item-')));
check('fresh unsaved diagram reads "Local only"', saveText === 'Local only' && storedItems.length === 0, `${saveText}; keys=${storedItems.join(',')}`);
await page.screenshot({ path: `${OUT}/desktop-light-1440.png` });

// Page tab label/underline centring
const tabCentre = await page.evaluate(() => {
  const tab = document.querySelector('.editor-page-tab--active'); const label = tab.querySelector('span');
  const t = tab.getBoundingClientRect(), l = label.getBoundingClientRect();
  return Math.abs((t.left + t.right) / 2 - (l.left + l.right) / 2);
});
check('page label centred on underline', tabCentre <= 1, `delta=${tabCentre}`);

// Zoom
const iframeTransform = () => page.locator('[data-testid=preview-iframe]').evaluate((f) => f.style.transform || 'none');
await page.click('[data-testid=renderer-zoom-in]');
check('zoom in → 110%', (await page.locator('[data-testid=renderer-zoom-label]').innerText()) === '110%' && (await iframeTransform()) === 'scale(1.1)');
await page.click('[data-testid=renderer-zoom-out]'); await page.click('[data-testid=renderer-zoom-out]');
check('zoom out → 90%', (await page.locator('[data-testid=renderer-zoom-label]').innerText()) === '90%');
await page.click('[data-testid=renderer-fit-width]'); await page.waitForTimeout(300);
const fitW = await page.locator('[data-testid=renderer-zoom-label]').innerText();
await page.click('[data-testid=renderer-fit-height]'); await page.waitForTimeout(300);
const fitH = await page.locator('[data-testid=renderer-zoom-label]').innerText();
await page.click('[data-testid=renderer-fit]'); await page.waitForTimeout(300);
const fitD = await page.locator('[data-testid=renderer-zoom-label]').innerText();
check('fit width/height/diagram change zoom', fitW !== '100%' && fitH !== '100%' && fitD === (parseInt(fitW) < parseInt(fitH) ? fitW : fitH), `${fitW} ${fitH} ${fitD}`);
await page.screenshot({ path: `${OUT}/desktop-light-fit-diagram.png` });
// Clicking inside a zoomed diagram still reaches the renderer (pointer maps through transform).
const frame = page.frameLocator('[data-testid=preview-iframe]');
check('zoomed diagram renders participants', (await frame.getByText('Alice').count()) > 0);
await page.click('[data-testid=renderer-zoom-label]');
check('zoom label resets to 100%', (await page.locator('[data-testid=renderer-zoom-label]').innerText()) === '100%' && (await iframeTransform()) === 'none');

// Split: keyboard + drag
const gutter = page.locator('.editor-split-gutter');
const w0 = (await box('[data-testid=editor-region]'))[2];
await gutter.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
const w1 = (await box('[data-testid=editor-region]'))[2];
check('keyboard resize grows code pane', w1 > w0, `${w0}→${w1}`);
const g = await gutter.boundingBox();
await page.mouse.move(g.x + 6, g.y + 300); await page.mouse.down(); await page.mouse.move(g.x + 106, g.y + 300, { steps: 5 }); await page.mouse.up();
const w2 = (await box('[data-testid=editor-region]'))[2];
check('drag resize grows code pane', w2 > w1 + 50, `${w1}→${w2}`);
await gutter.hover(); await page.screenshot({ path: `${OUT}/desktop-light-gutter-hover.png`, clip: { x: 300, y: 300, width: 200, height: 300 } });

// Sidebar toggle
await page.click('[data-testid=header-toggle-editor]');
const collapsedCard = await box('.editor-preview-panel');
check('sidebar toggle collapses code pane', await page.locator('[data-testid=editor-region]').isHidden() && collapsedCard[2] > 1300, JSON.stringify(collapsedCard));
await page.screenshot({ path: `${OUT}/desktop-light-collapsed.png` });
await page.click('[data-testid=header-toggle-editor]');
const restored = (await box('[data-testid=editor-region]'))[2];
check('sidebar toggle restores dragged width', Math.abs(restored - w2) <= 2, `${w2} vs ${restored}`);

// Pages: add, rename, scroll, delete
for (let i = 0; i < 6; i++) await page.click('[data-testid=page-add]');
const tabCount = await page.locator('[role=tab]').count();
const tabsScroll = await page.locator('.editor-page-tabs').evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
check('add pages', tabCount === 7, `tabs=${tabCount} scroll=${JSON.stringify(tabsScroll)}`);
const last = page.locator('[role=tab]').last();
await last.dblclick();
await page.keyboard.press('Meta+A'); await page.keyboard.type('Renamed'); await page.keyboard.press('Enter');
check('rename page', (await page.locator('[role=tab]').last().innerText()).toUpperCase().includes('RENAMED'));
await page.locator('[data-testid^=page-delete-]').last().click();
await page.getByRole('button', { name: 'Delete' }).last().click();
check('delete page', (await page.locator('[role=tab]').count()) === 6);
await page.screenshot({ path: `${OUT}/desktop-light-pages.png` });
// back to page 1
await page.locator('[role=tab]').first().click();

// Custom CSS expanded
await page.click('[data-testid=css-panel-strip]');
check('CSS expands with mode select + editor', (await page.locator('[data-testid=css-mode-select]').isVisible()) && (await page.locator('[data-testid=css-editor]').count()) > 0);
await page.screenshot({ path: `${OUT}/desktop-light-css-expanded.png` });
await page.locator('[data-testid=css-editor] .cm-content').click();
await page.keyboard.type('.x{}');
await page.waitForTimeout(500);
// Existing behaviour: custom CSS is gated for anonymous users (opens sign-in).
check('anonymous CSS edit opens existing sign-in gate', await page.locator('[data-testid=login-google]').isVisible());
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.click('[data-testid=css-panel-collapse]');

// Console: errors + clear
await page.click('[data-testid=console-toggle]');
await page.fill('[data-testid=console-eval]', 'console.error("boom")');
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
const errBadge = await page.locator('[data-testid=console-status]').count();
check('console shows error badge', errBadge === 1, await page.locator('[data-testid=console]').innerText());
await page.screenshot({ path: `${OUT}/desktop-light-console-error.png` });
await page.click('[data-testid=console-clear]');
check('console clear', (await page.locator('[data-testid=console-count]').innerText()) === '0');
await page.click('[data-testid=console-toggle]');

// Download
await page.click('[data-testid=renderer-download]');
await page.waitForSelector('[data-testid=export-dialog]');
await page.waitForTimeout(2500);
const dlPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
await page.click('[data-testid=export-download]');
const dl = await dlPromise;
check('download PNG', !!dl, dl ? dl.suggestedFilename() : 'no download');
await page.keyboard.press('Escape');

// Save-state truth after a real local save (⌘S)
await page.locator('[data-testid=dsl-editor] .cm-content').click();
await page.keyboard.press('End'); await page.keyboard.type('\nAlice->Bob: Thanks');
check('edit reads "Unsaved"', (await page.locator('[data-testid=header-savestate]').innerText()) === 'Unsaved');
await page.keyboard.press('Meta+s');
await page.waitForTimeout(1200);
const keysAfter = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('item-')));
check('after save reads "Saved locally" and item stored', (await page.locator('[data-testid=header-savestate]').innerText()) === 'Saved locally' && keysAfter.length === 1, keysAfter.join(','));
// dismiss one-time "Saved on this device" notice if shown
if (await page.getByRole('button', { name: 'Not now' }).isVisible().catch(() => false)) await page.getByRole('button', { name: 'Not now' }).click();

// Title edit
await page.click('[data-testid=header-title]');
await page.keyboard.press('Meta+A'); await page.keyboard.type('Order checkout'); await page.keyboard.press('Enter');
const t = await page.inputValue('[data-testid=header-title]'); check('title edit', t === 'Order checkout', t);

// Present + exit
await page.click('[data-testid=header-present]');
check('present opens', await page.locator('[data-testid=preview-fullscreen]').isVisible());
await page.click('[data-testid=preview-fullscreen]');

// Appearance toggle: immediate + persistent
await page.click('[data-testid=header-appearance]');
check('appearance dark applies immediately', (await page.evaluate(() => document.documentElement.dataset.appearance)) === 'dark');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/desktop-dark-1440.png` });
await page.reload(); await page.waitForSelector('[data-testid=header-title]'); await page.waitForTimeout(3000);
check('appearance dark persists after reload', (await page.evaluate(() => document.documentElement.dataset.appearance)) === 'dark');
const darkIframeBg = await frame.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor);
check('dark preview canvas is dark', darkIframeBg === 'rgb(43, 43, 43)', darkIframeBg);
await page.click('[data-testid=header-menu]');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/desktop-dark-app-menu.png` });
await page.keyboard.press('Escape');
await page.click('[data-testid=css-panel-strip]');
await page.screenshot({ path: `${OUT}/desktop-dark-css-expanded.png` });
await page.click('[data-testid=css-panel-collapse]');
await page.click('[data-testid=header-appearance]');
check('appearance back to light', (await page.evaluate(() => document.documentElement.dataset.appearance)) === 'light');

// Mid-width + narrow viewports, both appearances
for (const [w, h] of [[1024, 768], [390, 844]]) {
  for (const mode of ['light', 'dark']) {
    const p = await ctx.newPage();
    await p.addInitScript((m) => localStorage.setItem('appearance', JSON.stringify(m)), mode);
    await p.setViewportSize({ width: w, height: h });
    await p.goto(BASE); await p.waitForSelector('[data-testid=header-title]'); await p.waitForTimeout(3000);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const offscreen = await p.evaluate(() => [...document.querySelectorAll('header button, header input')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 0.5 || r.left < -0.5); }).map((e) => e.getAttribute('data-testid') || e.getAttribute('aria-label')));
    check(`${w}px ${mode}: no overflow, header controls on screen`, !overflow && offscreen.length === 0, offscreen.join(','));
    await p.screenshot({ path: `${OUT}/${w}-${mode}.png` });
    if (w === 390) {
      await p.click('[data-testid=layout-tab-preview]'); await p.waitForTimeout(2000);
      check(`390 ${mode}: preview tab shows diagram`, await p.locator('[data-testid=preview-iframe]').isVisible());
      await p.screenshot({ path: `${OUT}/390-${mode}-preview.png` });
    }
    await p.close();
  }
}

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
