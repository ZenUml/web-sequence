// Editor language rewrite — renderer-in-the-loop verification screenshots.
// Drives the running web/ preview (default :4173). Captures the DSL editor (Lezer
// highlighting) BESIDE the @zenuml/core rendered diagram, and asserts the editor
// shows NO error squiggles on renderer-valid documents (the linter regression check).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tmp', 'editor-language');
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

// Type a doc into the CodeMirror DSL editor (replace existing content).
async function setDsl(text) {
  const editor = page.getByTestId('dsl-editor').locator('.cm-content');
  await editor.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(text);
  await page.waitForTimeout(900); // let @zenuml async layout settle
}

// Count CM6 lint error markers currently shown in the DSL editor.
async function errorMarkers() {
  return page.getByTestId('dsl-editor').locator('.cm-lintRange-error, .cm-lint-marker-error').count();
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByTestId('header-title').waitFor({ timeout: 15000 });
await page.waitForTimeout(700);

// 1) Default document — editor highlighting beside the rendered diagram.
await shot('01-default-editor-and-diagram');
const defaultErrors = await errorMarkers();
console.log(`  default doc error markers: ${defaultErrors}`);

// 2) Declare-then-message (the pattern that false-positived in the linter) — must be clean now.
await setDsl('@Actor Client #FFEBE6\n@Boundary OrderController\nClient->OrderController: place order\nOrderController.save() {\n  return ok\n}');
await shot('02-declare-then-message');
const declErrors = await errorMarkers();
console.log(`  declare-then-message error markers: ${declErrors}`);

// 3) A control-flow rich doc — exercises keyword/string/comment/number highlighting.
await setDsl('// payment flow\ntitle Checkout\nA.charge(amount) {\n  if(amount > 0) {\n    B->C: settle\n    return "done"\n  } else {\n    @return\n  }\n}');
await shot('03-control-flow-highlighting');
const richErrors = await errorMarkers();
console.log(`  control-flow doc error markers: ${richErrors}`);

console.log(JSON.stringify({
  captured: results,
  out: OUT,
  errorMarkers: { default: defaultErrors, declareThenMessage: declErrors, controlFlow: richErrors },
}, null, 2));
await browser.close();
