// Phase 2 (§03) milestone screenshots: mobile tabbed Edit/Preview + Present-mode fit.
// Drives a running web/ server (default http://localhost:4173) with Playwright chromium.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tmp', 'redesign-phase2');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.PW_BASE_URL || 'http://localhost:4173';

const SEED = () => {
  localStorage.setItem('onboarded', 'true');
  localStorage.setItem('lastSeenVersion', '"9999.0.0"');
  localStorage.setItem('pledgeModalSeen', 'true');
};

const browser = await chromium.launch();
const results = [];

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
  results.push(name);
  console.log(`  ✓ ${name}`);
}

// ---- Mobile (phone width) tabbed Edit / Preview ----
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await page.addInitScript(SEED);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByTestId('header-title').waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  await shot(page, '01-mobile-edit'); // segmented Edit active, full-width code, no rail
  // Switch to Preview tab.
  const previewTab = page.getByTestId('layout-tab-preview');
  if (await previewTab.count()) {
    await previewTab.click();
    await page.waitForTimeout(800);
    await shot(page, '02-mobile-preview'); // diagram fits the phone
  }
  await ctx.close();
}

// ---- Desktop Present (fullscreen) mode: fit + centered, no console/rail ----
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(SEED);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByTestId('header-title').waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  await page.getByTestId('header-present').click();
  await page.waitForTimeout(1000); // let fit/scale settle
  await shot(page, '03-present-fit');
  await ctx.close();
}

console.log(JSON.stringify({ captured: results, out: OUT }, null, 2));
await browser.close();
