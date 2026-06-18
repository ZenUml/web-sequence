// CSS editor (CSS-1..CSS-6 from e2e/E2E_GAP_TEST_PLAN.md §"CSS editor").
//
// Signed-out / local flows only. The custom-CSS pre-processor pipeline (SCSS/Less/
// Stylus/ACSS) is Plus-gated for SIGNED-IN users; for a SIGNED-OUT user every
// non-plain CSS *user edit* (handleSetCssMode / handleSetCss) routes through
// AppRoot.cssGated() which opens the sign-in modal and WITHHOLDS the change
// (verified in web/src/app/AppRoot.tsx:604-632, and exercised by modals-gap.spec.js
// MOD-7). So we cannot reach the compiled-CSS render path by *typing* — instead we
// seed an item that ALREADY carries `cssMode:'scss'|'less'|'acss'` via the library
// JSON-import path (AppRoot.handleImport → saveItems) and OPEN it (handleOpenItem →
// loadItem). loadItem/import never call cssGated(), and the async transpile effect
// (AppRoot.tsx:354-361 computeCss → transpiledCss → previewCss) runs purely on
// item.cssMode/item.css regardless of auth. The preview iframe applies that CSS as
// the textContent of `#zenumlstyle` (web/src/preview/previewHtml.ts:55 +
// previewBootstrap.runtime.js:159-161), which is the OBSERVABLE outcome we assert.
//
// SURFACE NOTES (verified against web/src/** on 2026-06-18):
//   - CSS panel (CSS-1): empty CSS → collapsed strip `css-panel-strip`; clicking it
//     opens `css-panel-expanded` whose footer carries `css-panel-collapse`
//     (web/src/components/editor/CssPanel.tsx). Opening the panel is NOT gated.
//   - CSS mode select (CSS-2): a Radix Select `css-mode-select` rendering CSS_MODES
//     (AppRoot.tsx:71-78) = CSS/SCSS/Sass/Less/Stylus/Atomic CSS. OPENING the
//     dropdown is not gated (only *picking* a non-css option is), so the six
//     options are assertable for a signed-out user.
//   - ACSS settings entry (CSS-4): when item.cssMode === 'acss' the headerControls
//     reveal an `acss-settings-open` button (AppRoot.tsx:1281-1290) that opens the
//     AtomicCssSettingsModal (`acss-modal`, web/src/components/modals/AtomicCssSettingsModal.tsx).
//   - Prettier-format (CSS-6): Mod-Shift-f is a CSS-only CodeMirror binding
//     (web/src/editor/CodeEditor.tsx:196-215) that runs formatCss(prettier) and
//     dispatches the reformatted text into the CM doc. The dispatched doc change
//     fires @uiw's updateListener → onChange → handleSetCss, which for a SIGNED-OUT
//     user is gated (cssGated withholds the store write; @uiw is controlled on the
//     parent `value` and reverts the buffer). So the format result is NOT observable
//     for a signed-out user → test.fixme.
//   - CSS-5 (Plus-gate routes a free SIGNED-IN user to pricing): needs emulator auth
//     → test.fixme (mirrors cloud.fixme.spec.js CSS-5).
//
// GUARDS: CSS-3 / CSS-4 drive a hidden <input type=file> via setInputFiles and read
// the preview iframe — meaningful only against the local app — so they self-skip on
// the remote staging gate (PW_BASE_URL set), the convention export/production-build
// specs use.

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor, gotoHome } from './helpers/hub';

// Deployed sites load third-party analytics/CDN scripts that throw uncaught errors
// we don't own; treat those as noise (copied verbatim from smoke/library specs).
const THIRD_PARTY_ERROR_SOURCES = [
  'userscript.js',
  'gtm.js',
  'googletagmanager',
  'google-analytics',
  'analytics.js',
  'clarity.js',
  'clarity.ms',
  'paddle.js',
  'cdn.paddle.com',
  'zaraz',
  'cloudflareinsights',
];

function isThirdPartyError(err) {
  const haystack = `${err?.message || ''}\n${err?.stack || ''}`;
  return THIRD_PARTY_ERROR_SOURCES.some((src) => haystack.includes(src));
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });
  // M04: keep the Onboarding / Support-pledge one-time modals from trapping focus.
  await suppressOneTimeModals(page);
});

/** Navigate to the EDITOR with a clean localStorage slate (export.spec.js pattern). */
async function gotoFresh(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openEditor(page);
}

/**
 * Seed ONE item via the HomeView JSON-import path and OPEN it in the editor.
 *
 * Why import (not type): the non-plain CSS modes are Plus-gated on *user edits* for a
 * signed-out user (cssGated → sign-in modal, change withheld). handleImport writes
 * the item fields verbatim, and handleOpenItem → loadItem reloads them WITHOUT
 * touching cssGated — so the boot-time transpile effect runs on the seeded
 * cssMode/css and the preview reflects the COMPILED css. Returns the seeded id.
 */
async function importAndOpen(page, item) {
  await gotoHome(page);
  const payload = JSON.stringify({ items: [item] });
  await page.locator('[data-testid="lib-import-input"]').setInputFiles({
    name: 'seed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(payload, 'utf-8'),
  });
  // Re-navigate so a fresh useItems mount reads the updated local index, then open
  // the card (handleOpenItem → loadItem → navigate to ?id=).
  await gotoHome(page);
  const card = page.locator(`[data-testid="home-card-${item.id}"]`);
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.click();
  await expect(
    page.locator('[data-testid="dsl-editor"] .cm-content'),
  ).toBeVisible({
    timeout: 15_000,
  });
}

/** Build a minimal importable Item with the given css fields. */
function seedItem({ id, cssMode, css = '', html = '', cssSettings }) {
  return {
    id,
    title: `seed-${cssMode}`,
    js: 'Alice -> Bob: Hello',
    css,
    html,
    htmlMode: 'html',
    cssMode,
    jsMode: 'js',
    ...(cssSettings !== undefined ? { cssSettings } : {}),
    updatedOn: Date.now(),
  };
}

/**
 * Poll the preview iframe's user-CSS rail (#zenumlstyle) and return its raw
 * textContent. computeCss output is pushed there as the <style> textContent via the
 * 'updateCss' postMessage. We read textContent directly (NOT toContainText): a
 * <style> element carries no *rendered* visible text, so Playwright's text matchers
 * see "" even when innerHTML holds the compiled CSS. expect.poll over this getter
 * gives the same auto-retry while reading the real node content.
 */
async function readZenumlStyle(page) {
  return page
    .frameLocator('[data-testid="preview-iframe"]')
    .locator('#zenumlstyle')
    .textContent();
}

// ──────────────────────────────────────────────────────────────────────────────
// CSS-1: the Custom-CSS pane expands from its strip and collapses from its footer.
// ──────────────────────────────────────────────────────────────────────────────
test('CSS-1 the Custom-CSS pane expands from its strip and collapses from its footer', async ({
  page,
}) => {
  await gotoFresh(page);

  // Fresh diagram → empty CSS → the panel renders collapsed as a thin strip.
  const strip = page.locator('[data-testid="css-panel-strip"]');
  const expanded = page.locator('[data-testid="css-panel-expanded"]');
  const collapse = page.locator('[data-testid="css-panel-collapse"]');

  await expect(strip).toBeVisible();
  await expect(strip).toHaveAttribute('aria-expanded', 'false');
  await expect(expanded).toHaveCount(0);

  // Expand from the strip → the expanded body + the CSS editor surface appear.
  await strip.click();
  await expect(expanded).toBeVisible();
  await expect(
    page.locator('[data-testid="css-editor"] .cm-content'),
  ).toBeVisible();
  await expect(collapse).toHaveAttribute('aria-expanded', 'true');
  await expect(strip).toHaveCount(0);

  // Collapse from the footer control → back to the strip, body gone.
  await collapse.click();
  await expect(strip).toBeVisible();
  await expect(expanded).toHaveCount(0);
});

// ──────────────────────────────────────────────────────────────────────────────
// CSS-2: the CSS mode select offers CSS / SCSS / Sass / Less / Stylus / ACSS.
// ──────────────────────────────────────────────────────────────────────────────
test('CSS-2 the CSS mode select offers CSS/SCSS/Sass/Less/Stylus/Atomic CSS', async ({
  page,
}) => {
  await gotoFresh(page);

  // Expand the CSS pane to reach the pre-processor mode Select.
  await page.locator('[data-testid="css-panel-strip"]').click();
  const modeSelect = page.locator('[data-testid="css-mode-select"]');
  await expect(modeSelect).toBeVisible();
  // Default plain mode reads "CSS".
  await expect(modeSelect).toContainText('CSS');

  // Opening the Radix dropdown is NOT gated (only PICKING a non-css option is), so
  // the full pre-processor roster is assertable for a signed-out user.
  await modeSelect.click();
  for (const label of ['CSS', 'SCSS', 'Sass', 'Less', 'Stylus', 'Atomic CSS']) {
    await expect(
      page.getByRole('option', { name: label, exact: true }),
    ).toBeVisible();
  }

  // Close the dropdown without selecting (Escape) — picking SCSS here would trip the
  // signed-out sign-in gate, which CSS-2 isn't about.
  await page.keyboard.press('Escape');
});

// ──────────────────────────────────────────────────────────────────────────────
// CSS-3: entering SCSS (and Less) source transpiles so the preview reflects the
// COMPILED css. Seeded via import to bypass the signed-out user-edit gate; the
// transpile effect runs on the seeded cssMode/css regardless of auth.
// ──────────────────────────────────────────────────────────────────────────────
test('CSS-3 SCSS source transpiles so the preview reflects compiled CSS', async ({
  page,
}) => {
  test.skip(
    !!process.env.PW_BASE_URL,
    'reads the preview iframe + seeds via a hidden file input — local app only',
  );

  // SCSS that ONLY compiles to plain CSS via the transpiler: a nested rule plus a
  // variable. If sass did NOT run, `#zenumlstyle` would carry the raw `$accent`/
  // nesting source (or nothing), never the flattened `.zenuml-label { color: ... }`.
  const SCSS =
    '$accent: rgb(10, 20, 30);\n.zenuml-label {\n  color: $accent;\n}\n';
  await importAndOpen(
    page,
    seedItem({ id: 'css3-scss', cssMode: 'scss', css: SCSS }),
  );

  // The compiled CSS lands in the iframe's #zenumlstyle. sass flattens the nesting
  // and resolves the variable (sass KEEPS rgb() — verified: compileString emits
  // `.zenuml-label {\n  color: rgb(10, 20, 30);\n}`). Assert the FLAT compiled
  // selector + resolved value, and that the raw SCSS variable token is absent
  // (proving compilation ran, not raw passthrough).
  await expect
    .poll(() => readZenumlStyle(page), { timeout: 15_000 })
    .toContain('.zenuml-label');
  const compiled = await readZenumlStyle(page);
  expect(compiled).toContain('color: rgb(10, 20, 30)');
  expect(compiled).not.toContain('$accent');
});

test('CSS-3 Less source transpiles so the preview reflects compiled CSS', async ({
  page,
}) => {
  test.skip(
    !!process.env.PW_BASE_URL,
    'reads the preview iframe + seeds via a hidden file input — local app only',
  );

  // Less with a variable; less.render resolves @brand and emits flat CSS. less
  // NORMALIZES rgb(40, 50, 60) to the hex form #28323c (verified: less.render emits
  // `.zenuml-label {\n  color: #28323c;\n}`) — that normalization is itself proof the
  // Less compiler ran (a raw passthrough would keep `@brand` / `rgb(...)`).
  const LESS =
    '@brand: rgb(40, 50, 60);\n.zenuml-label {\n  color: @brand;\n}\n';
  await importAndOpen(
    page,
    seedItem({ id: 'css3-less', cssMode: 'less', css: LESS }),
  );

  await expect
    .poll(() => readZenumlStyle(page), { timeout: 15_000 })
    .toContain('.zenuml-label');
  const compiled = await readZenumlStyle(page);
  expect(compiled).toContain('color: #28323c');
  expect(compiled).not.toContain('@brand');
});

// ──────────────────────────────────────────────────────────────────────────────
// CSS-4: ACSS mode reveals the Atomic-CSS settings entry, which opens the
// AtomicCssSettingsModal. Seeded via import (acss mode is Plus-gated on edits).
// ──────────────────────────────────────────────────────────────────────────────
test('CSS-4 ACSS mode reveals the Atomic-CSS settings entry that opens the modal', async ({
  page,
}) => {
  test.skip(
    !!process.env.PW_BASE_URL,
    'seeds via a hidden file input — local app only',
  );

  // Seed an ACSS item. acssConfig is a JSON *string* (transpilers.ts JSON.parses it);
  // html carries the atomic class names atomizer scans. The CSS editor is read-only
  // in acss mode, so config is edited via the revealed settings button.
  await importAndOpen(
    page,
    seedItem({
      id: 'css4-acss',
      cssMode: 'acss',
      html: '<div class="D(b) C(#0a141e)">x</div>',
      cssSettings: { acssConfig: '{}' },
    }),
  );

  // Expand the CSS pane → in acss mode the headerControls reveal the settings entry.
  await page.locator('[data-testid="css-panel-strip"]').click();
  const settingsOpen = page.locator('[data-testid="acss-settings-open"]');
  await expect(settingsOpen).toBeVisible();

  // The Atomic-CSS-config modal is not open yet.
  await expect(page.locator('[data-testid="acss-modal"]')).toHaveCount(0);

  // Clicking it opens the AtomicCssSettingsModal with its config textarea.
  await settingsOpen.click();
  await expect(page.locator('[data-testid="acss-modal"]')).toBeVisible();
  await expect(page.locator('[data-testid="acss-config"]')).toBeVisible();

  // Escape closes it (proving the wired Dialog).
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="acss-modal"]')).toHaveCount(0);
});

// ──────────────────────────────────────────────────────────────────────────────
// CSS-5: non-plain CSS mode gated behind Plus for a FREE signed-in user → pricing.
// Needs the Firebase emulator (auth) — deferred to the staging gate, mirroring
// cloud.fixme.spec.js CSS-5.
// ──────────────────────────────────────────────────────────────────────────────
test.fixme(
  'CSS-5 — needs: emulator (auth) — non-plain CSS mode gated behind Plus for free users (→ pricing)',
  async () => {
    // Free signed-in user (signInViaEmulator), expand the CSS pane, pick SCSS in
    // css-mode-select → cssGated() opens the pricing modal (pricing-modal visible).
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// CSS-6: Prettier-format (Ctrl/Cmd+Shift+F) reformats the CSS buffer.
//
// The Mod-Shift-f binding runs formatCss(prettier) and dispatches the result into
// the CM doc — but that dispatch fires @uiw's updateListener → onChange →
// handleSetCss, which for a SIGNED-OUT user routes through cssGated() and WITHHOLDS
// the store write. @uiw is a CONTROLLED editor on the parent `value`, so it reverts
// the buffer to the (still-empty) store value — the reformatted text is never
// observable without a Plus session. (For a Plus signed-in user the write lands and
// the buffer shows the reformatted CSS.) Needs emulator auth → test.fixme.
// ──────────────────────────────────────────────────────────────────────────────
test.fixme(
  'CSS-6 — needs: emulator (Plus auth) — Ctrl+Shift+F reformats the CSS buffer',
  async () => {
    // Plus signed-in user: switch css-mode (or stay css), type unformatted CSS such
    // as `.a{color:red}` into css-editor, press Mod-Shift-f → the buffer reformats to
    // prettier output (`.a {\n  color: red;\n}`). For a signed-out user the gate
    // withholds the css write and @uiw reverts the buffer, so the reformat is not
    // observable — hence this is auth-gated, not implementable locally.
  },
);
