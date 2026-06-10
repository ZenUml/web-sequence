// Playwright demo: triggering the `/if` slash command in the ZenUML DSL editor.
// Records a video + step screenshots. Shows the CONTEXT GATING — `/if` is a block
// command, so it does NOT appear at the head (top-level) zone but DOES appear
// inside a `{ }` block. Drives the running web/ preview (default :4173).
//
// Run:  node scripts/editor-slash-demo.mjs        (against http://localhost:4173)
//       PW_BASE_URL=http://localhost:3000 node scripts/editor-slash-demo.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tmp', 'editor-slash');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.PW_BASE_URL || 'http://localhost:4173';

// Seed: suppress onboarding modal AND the one-time signed-out "Saved on this
// device" notice (loginAndsaveMessageSeen) so neither overlays the editor.
const SEED = () => {
  localStorage.setItem('onboarded', 'true');
  localStorage.setItem('lastSeenVersion', '"9999.0.0"');
  localStorage.setItem('pledgeModalSeen', 'true');
  localStorage.setItem('loginAndsaveMessageSeen', 'true');
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
});
const page = await ctx.newPage();
await page.addInitScript(SEED);

const log = [];
async function shot(name, note) {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  log.push(`  ✓ ${name}${note ? ' — ' + note : ''}`);
  console.log(log[log.length - 1]);
}

const content = () => page.getByTestId('dsl-editor').locator('.cm-content');
const popupItems = () =>
  page.locator('.cm-tooltip-autocomplete li').allInnerTexts();

// Clear the editor reliably (Playwright select-all works in CodeMirror).
async function clearEditor() {
  await content().click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(150);
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByTestId('header-title').waitFor({ timeout: 15000 });
await page.waitForTimeout(600);

// ── Scenario A: HEAD zone — `/` here does NOT offer /if ─────────────────────
await clearEditor();
await page.keyboard.type('/');
await page.waitForTimeout(500);
const headItems = await popupItems();
const headHasIf = headItems.some((t) => /^\/if\b/.test(t.trim()));
await shot('01-head-zone-slash', `head popup = [${headItems.map((t) => t.split(/\s/)[0]).join(', ')}]`);
console.log(`  head zone offers /if? ${headHasIf}  (expected: false — /if is a block command)`);
await page.keyboard.press('Escape');

// ── Scenario B: BLOCK zone — open a block, then `/if` works ──────────────────
await clearEditor();
// A valid first statement, then a sync block. CM auto-closes ( and {.
await page.keyboard.type('Alice->Bob: hello\n');
await page.keyboard.type('Alice.process() {');
await page.keyboard.press('Enter'); // cursor now INSIDE the block
await page.waitForTimeout(200);
await shot('02-block-open', 'cursor inside Alice.process() { } block');

// Type "/" → popup with block commands
await page.keyboard.type('/');
await page.waitForTimeout(500);
const blockItems = await popupItems();
const blockHasIf = blockItems.some((t) => /^\/if\b/.test(t.trim()));
await shot('03-block-zone-slash', `block popup includes /if? ${blockHasIf}`);
console.log(`  block zone offers /if? ${blockHasIf}  (expected: true)`);

// Filter to /if and accept
await page.keyboard.type('if');
await page.waitForTimeout(400);
await shot('04-filtered-if', 'popup filtered to /if');
await page.keyboard.press('Enter'); // accept → inserts snippet
await page.waitForTimeout(400);
await shot('05-if-inserted', 'if(condition) { } snippet inserted, condition tab stop selected');

// Fill the first tab stop (condition), then Tab to the body
await page.keyboard.type('order == null');
await page.waitForTimeout(150);
await page.keyboard.press('Tab');
await page.keyboard.type('Bob.reject()');
await page.waitForTimeout(900); // let @zenuml re-render
await shot('06-final-and-diagram', 'condition filled + body + live diagram');

const finalText = await content().innerText();
const errorMarkers = await page
  .getByTestId('dsl-editor')
  .locator('.cm-lintRange-error, .cm-lint-marker-error')
  .count();

console.log('\n=== RESULT ===');
console.log(JSON.stringify(
  {
    headZoneOffersIf: headHasIf,
    blockZoneOffersIf: blockHasIf,
    finalEditorText: finalText,
    errorMarkers,
    out: OUT,
  },
  null,
  2,
));

await ctx.close(); // flush video
await browser.close();

// Rename the video to something findable.
import { readdirSync, renameSync } from 'node:fs';
const webm = readdirSync(OUT).find((f) => f.endsWith('.webm'));
if (webm) {
  renameSync(join(OUT, webm), join(OUT, 'slash-if-demo.webm'));
  console.log(`  video: ${join(OUT, 'slash-if-demo.webm')}`);
}
