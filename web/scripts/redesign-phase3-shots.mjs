// Phase 3 (§04) milestone screenshots: library empty-state, visual template picker,
// two-column settings. Drives a running web/ server (default http://localhost:4173).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tmp', 'redesign-phase3');
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
await page.waitForTimeout(600);

// 1) Library empty-state (no diagrams → folder glyph + New diagram + Browse templates).
await page.getByTestId('sidebar-library').click();
await page.waitForTimeout(500);
await shot('01-library-empty');

// 2) Visual template picker — open via the library's "Browse templates" CTA.
const browseBtn = page.getByTestId('lib-empty-templates');
if (await browseBtn.count()) {
  await browseBtn.click();
  await page.waitForTimeout(500);
  await shot('02-template-picker');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

// 3) Two-column Settings — open via the app menu (logo ▾ → Settings).
await page.getByTestId('app-menu-trigger').click();
await page.waitForTimeout(250);
await page.getByTestId('app-menu-settings').click();
await page.waitForTimeout(500);
await shot('03-settings-2col');

console.log(JSON.stringify({ captured: results, out: OUT }, null, 2));
await browser.close();
