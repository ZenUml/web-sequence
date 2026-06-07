// Phase 4 (§05) milestone screenshots: sign-in last-used, pricing (yearly, struck
// price), embed (centered + capped). Drives a running web/ server (default :4173).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tmp', 'redesign-phase4');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.PW_BASE_URL || 'http://localhost:4173';

// Seed onboarding-suppression + a last-used provider (JSON-encoded, the storage
// layer JSON.parses on read).
const SEED = () => {
  localStorage.setItem('onboarded', 'true');
  localStorage.setItem('lastSeenVersion', '"9999.0.0"');
  localStorage.setItem('pledgeModalSeen', 'true');
  localStorage.setItem('lastAuthProvider', '"github"');
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
await page.waitForTimeout(500);

// 1) Sign-in returning user — GitHub floated under "Pick up where you left off".
await page.getByTestId('header-login').click();
await page.waitForTimeout(500);
await shot('01-signin-lastused');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// 2) Pricing (yearly) — struck monthly price proves the discount. Only if payment on.
await page.getByTestId('app-menu-trigger').click();
await page.waitForTimeout(250);
const pricing = page.getByTestId('app-menu-pricing');
if (await pricing.count()) {
  await pricing.click();
  await page.waitForTimeout(400);
  const yearly = page.getByTestId('pricing-period-yearly');
  if (await yearly.count()) { await yearly.click(); await page.waitForTimeout(300); }
  await shot('02-pricing-yearly');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
} else {
  console.log('  (skip 02-pricing — payment feature disabled in this build)');
  await page.keyboard.press('Escape');
}

// 3) Embed — centered + capped to content, with the "Edit in ZenUML" handoff.
await page.goto(`${BASE}/?embed&code=${encodeURIComponent('Alice->Bob: Hello\nBob->Alice: Hi back')}&title=Demo`, { waitUntil: 'networkidle' });
await page.getByTestId('embed-header').waitFor({ timeout: 15000 });
await page.waitForTimeout(900);
await shot('03-embed-centered');

console.log(JSON.stringify({ captured: results, out: OUT }, null, 2));
await browser.close();
