// Phase 1 chrome-redesign milestone screenshots (§01 + §02).
// Drives a running web/ server (default http://localhost:4173 — `vite preview`)
// with Playwright chromium and saves PNGs into web/tmp/redesign-phase1/.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tmp', 'redesign-phase1');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.PW_BASE_URL || 'http://localhost:4173';

const SEED = () => {
  localStorage.setItem('onboarded', 'true');
  localStorage.setItem('lastSeenVersion', '"9999.0.0"');
  localStorage.setItem('pledgeModalSeen', 'true');
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(SEED);
const results = [];
async function shot(name) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
  results.push(name);
  console.log(`  ✓ ${name}`);
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByTestId('header-title').waitFor({ timeout: 15000 });
await page.waitForTimeout(800); // let the diagram render

// 1) Redesigned editor: file-menu top bar + icon rail + grouped toolbar + renderer-side
//    page tabs + smart console.
await shot('01-editor');

// 2) App menu (logo ▾) open — New / New from template / Settings / Shortcuts / Help / Save.
await page.getByTestId('app-menu-trigger').click();
await page.waitForTimeout(300);
await shot('02-app-menu');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// 3) Document menu (filename ▾) open — Rename / Duplicate.
await page.getByTestId('filemenu-trigger').click();
await page.waitForTimeout(300);
await shot('03-document-menu');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// 4) CSS panel expanded from its collapsed "Custom CSS" strip (mode selector preserved).
const strip = page.getByTestId('css-panel-strip');
if (await strip.count()) {
  await strip.click();
  await page.waitForTimeout(250);
  await shot('04-css-expanded');
}

console.log(JSON.stringify({ captured: results, out: OUT }, null, 2));
await browser.close();
