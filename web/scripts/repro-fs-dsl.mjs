// Repro: (1) fullscreen clipping with a larger diagram, (2) DSL syntax highlighting.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tmp', 'repro');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.PW_BASE_URL || 'http://localhost:4173';

const SEED = () => {
  localStorage.setItem('onboarded', 'true');
  localStorage.setItem('lastSeenVersion', '"9999.0.0"');
  localStorage.setItem('pledgeModalSeen', 'true');
};

// A wide + tall diagram with keywords (alt/end), a quoted string, and a comment.
const DSL = `// Checkout flow
User -> Web: Click "Pay"
Web -> API: POST /charge
API -> Auth: validate()
alt authorized
  API -> Bank: authorize()
  Bank --> API: ok
  API -> Ledger: record()
else declined
  API --> User: 402
end
API -> Email: receipt()
API --> User: Receipt`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(SEED);
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByTestId('header-title').waitFor({ timeout: 15000 });
await page.waitForTimeout(600);

// Type the diagram into the DSL CodeMirror.
const cm = page.locator('[data-testid="dsl-editor"] .cm-content');
await cm.click();
await page.keyboard.press('ControlOrMeta+A');
await page.keyboard.press('Delete');
await cm.pressSequentially(DSL, { delay: 2 });
await page.waitForTimeout(1200); // debounced render

await page.screenshot({ path: join(OUT, 'editor-dsl.png') });
console.log('  ✓ editor-dsl (check DSL highlighting + width)');

// Zoom the DSL editor region only for a closer look at highlighting.
const editorBox = await page.getByTestId('dsl-editor').boundingBox();
if (editorBox) {
  await page.screenshot({ path: join(OUT, 'editor-dsl-crop.png'), clip: editorBox });
  console.log('  ✓ editor-dsl-crop');
}

// Enter fullscreen Present.
await page.getByTestId('header-present').click();
await page.waitForTimeout(1200);
await page.screenshot({ path: join(OUT, 'fullscreen.png') });
console.log('  ✓ fullscreen (check full diagram visible)');

await browser.close();
