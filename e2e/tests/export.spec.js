// Export / Import variants (EXP-1..EXP-5 from e2e/E2E_GAP_TEST_PLAN.md §12).
//
// Signed-out / local flows only. The export-all (JSON) + import-JSON happy paths
// are already covered by library.spec.js; this spec covers the REMAINING export /
// import variants: HTML export, malformed-import error surfacing, and merge dedup.
//
// SURFACE NOTES (verified against web/src/** on 2026-06-18):
//   - PNG / SVG export (EXP-1 / EXP-2): there is NO UI that exports the diagram to
//     PNG or SVG. PreviewFrame exposes a `getPng()` imperative handle
//     (web/src/preview/PreviewFrame.tsx:221) but NOTHING calls it — grep finds zero
//     download of a `.png`/`.svg` file anywhere in web/src. RendererHeader hosts
//     only Present + (optional) Fit. So these two cases have no implementable UI
//     today → test.fixme with the exact reason (not test.skip; the gap is real,
//     not environment-conditional).
//   - Export-as-HTML (EXP-3): DiagramCard's kebab → "Export as HTML"
//     (web/src/components/home/DiagramCard.tsx:107) → AppRoot.handleExportHtml →
//     downloadText(`${safe}.html`, buildStandaloneHtml(item), 'text/html')
//     (AppRoot.tsx:821). buildStandaloneHtml (services/exportImport.ts) embeds the
//     DSL inline + loads @zenuml/core from the jsDelivr CDN — a self-contained file.
//   - Malformed import (EXP-4): the HomeView header's ImportExportBar feeds the
//     file text to AppRoot.handleImport, which try/catches parseImportJson (throws
//     on invalid JSON) and calls setImportError → a ConfirmDialog titled
//     "Import failed" (AppRoot.tsx:972) — i.e. an explicit error dialog, not silent.
//   - Merge dedup (EXP-5): handleImport builds `map[it.id] = it`, so an imported id
//     that already exists OVERWRITES rather than appends — the row count only grows
//     by the number of genuinely-new ids.
//
// GUARDS: HTML export issues a real browser download, and the import cases drive a
// hidden <input type=file> via setInputFiles — both only meaningful against the
// local app, so they self-skip on the remote staging gate (PW_BASE_URL set), the
// same convention production-build.spec.js uses.

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor, gotoHome } from './helpers/hub';

const selectAll = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';

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

function editorLocator(page) {
  return page.locator('[data-testid="dsl-editor"] .cm-content');
}

/** Navigate to the EDITOR with a clean localStorage slate (library.spec.js pattern). */
async function gotoFresh(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openEditor(page);
}

/** Type a replacement DSL into the CM6 editor (select-all → Delete → type). */
async function typeDsl(page, dsl, { timeout = 15_000 } = {}) {
  const editor = editorLocator(page);
  await expect(editor).toBeVisible({ timeout });
  await editor.click();
  await page.keyboard.press(selectAll);
  await page.keyboard.press('Delete');
  await editor.pressSequentially(dsl);
}

/** Set the diagram title via the header title field. */
async function setTitle(page, title) {
  const titleInput = page.locator('[data-testid="header-title"]');
  await expect(titleInput).toBeVisible();
  await titleInput.click();
  await page.keyboard.press(selectAll);
  await page.keyboard.press('Delete');
  await titleInput.pressSequentially(title);
  await expect(titleInput).toHaveValue(title);
}

/**
 * The FIRST signed-out Save opens a one-time "Saved on this device" notice (a Radix
 * Dialog whose overlay intercepts the next click). gotoFresh clears localStorage, so
 * loginAndSaveMessageSeen is false → the first save in each test shows it with
 * certainty; dismiss via its "Not now" button (data-testid="confirm-cancel").
 * (Inlined from library.spec.js — sibling agents edit the shared helpers in parallel.)
 */
async function dismissSaveNoticeIfPresent(page, { expected = false } = {}) {
  const cancel = page.locator('[data-testid="confirm-cancel"]');
  if (expected) {
    await expect(cancel).toBeVisible();
  } else if (!(await cancel.isVisible().catch(() => false))) {
    return;
  }
  await cancel.click();
  await expect(cancel).toBeHidden();
}

/** Seed one local item: set title + DSL, then Save (writes the local item index). */
async function seedItem(page, { title, dsl, firstSave = false }) {
  await setTitle(page, title);
  await typeDsl(page, dsl);
  await expect(editorLocator(page)).toContainText(dsl.split('\n')[0]);
  await page.locator('[data-testid="header-menu"]').click();
  await page.locator('[data-testid="header-save"]').click();
  await dismissSaveNoticeIfPresent(page, { expected: firstSave });
}

// ──────────────────────────────────────────────────────────────────────────────
// EXP-1: Export PNG downloads a *.png.
//
// FIXME — no PNG export UI exists. PreviewFrame.getPng() is implemented but has no
// caller; nothing in web/src downloads a .png. Cannot be exercised without first
// building the export-to-PNG control (a product gap, not a test-env limitation).
// ──────────────────────────────────────────────────────────────────────────────
test.fixme(
  'EXP-1 export PNG downloads a .png — no PNG export UI exists yet (PreviewFrame.getPng has no caller)',
  async () => {},
);

// ──────────────────────────────────────────────────────────────────────────────
// EXP-2: Export SVG downloads a *.svg.
//
// FIXME — no SVG export UI exists. There is no SVG download path anywhere in
// web/src (the renderer side only exposes Present/Fit). Same product gap as EXP-1.
// ──────────────────────────────────────────────────────────────────────────────
test.fixme(
  'EXP-2 export SVG downloads a .svg — no SVG export UI exists yet',
  async () => {},
);

// ──────────────────────────────────────────────────────────────────────────────
// EXP-3: Export-as-HTML produces a self-contained *.html.
// ──────────────────────────────────────────────────────────────────────────────
test('EXP-3 card "Export as HTML" downloads a self-contained .html file', async ({
  page,
}) => {
  test.skip(
    !!process.env.PW_BASE_URL,
    'HTML export reads the downloaded file off disk — local app only',
  );

  await gotoFresh(page);

  // Seed a distinctive item so the exported HTML embeds known DSL we can assert on.
  const UNIQUE_PARTICIPANT = 'ExportHtmlProbe';
  await seedItem(page, {
    title: 'HtmlExportDiagram',
    dsl: `${UNIQUE_PARTICIPANT}\nUser\nUser->${UNIQUE_PARTICIPANT}: standaloneExport`,
    firstSave: true,
  });

  // The HTML export lives on the HomeView card's kebab menu.
  await gotoHome(page);
  const card = page.locator('[data-testid^="home-card-"]').first();
  await expect(card).toBeVisible({ timeout: 10_000 });

  // The kebab trigger is revealed on hover (opacity-0 group-hover). Hover the card,
  // then open its "Diagram options" menu.
  await card.hover();
  await card.getByRole('button', { name: 'Diagram options' }).click();

  // Click "Export as HTML" and capture the download it triggers.
  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
  await page.getByRole('menuitem', { name: 'Export as HTML' }).click();
  const download = await downloadPromise;

  // Filename is `${slug(title)}.html` (AppRoot.handleExportHtml).
  expect(download.suggestedFilename()).toMatch(/\.html$/);
  expect(download.suggestedFilename()).toBe('htmlexportdiagram.html');

  // Read the file off disk and assert it is SELF-CONTAINED: it embeds the diagram
  // DSL inline AND pulls @zenuml/core from a CDN (so it renders with no local server).
  const path = await download.path();
  const fs = await import('fs');
  const html = fs.readFileSync(path, 'utf-8');
  expect(html).toContain('<!doctype html>');
  expect(html).toContain(UNIQUE_PARTICIPANT); // the DSL is embedded, not referenced
  expect(html).toContain('mounting-point'); // the @zenuml/core mount scaffold
  expect(html).toMatch(/cdn\.jsdelivr\.net\/npm\/@zenuml\/core/); // CDN-loaded core
});

// ──────────────────────────────────────────────────────────────────────────────
// EXP-4: Importing malformed JSON shows an error dialog (not silent).
// ──────────────────────────────────────────────────────────────────────────────
test('EXP-4 importing malformed JSON shows an "Import failed" error dialog', async ({
  page,
}) => {
  test.skip(
    !!process.env.PW_BASE_URL,
    'drives a hidden file input via setInputFiles — local app only',
  );

  await gotoFresh(page);

  // Go to the HomeView hub where the ImportExportBar (and its import-error dialog)
  // lives. An empty library still renders the import control.
  await gotoHome(page);

  // The "Import failed" ConfirmDialog must NOT be present before we import.
  const errorDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Import failed' });
  await expect(errorDialog).toHaveCount(0);

  // Feed the hidden file input a file that is NOT valid JSON. parseImportJson does
  // JSON.parse(text) which throws; handleImport catches it → setImportError → dialog.
  await page.locator('[data-testid="lib-import-input"]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{ this is not valid json ]]', 'utf-8'),
  });

  // The error is surfaced as a dialog (title "Import failed") — not swallowed.
  await expect(errorDialog).toBeVisible({ timeout: 10_000 });

  // It is dismissible via its OK button (confirm-ok), proving the wired action path.
  await page.locator('[data-testid="confirm-ok"]').click();
  await expect(errorDialog).toHaveCount(0);
});

// ──────────────────────────────────────────────────────────────────────────────
// EXP-5: Importing an overlapping set skips duplicate IDs (only new rows added).
// ──────────────────────────────────────────────────────────────────────────────
test('EXP-5 importing an overlapping set skips duplicate IDs — only new rows added', async ({
  page,
}) => {
  test.skip(
    !!process.env.PW_BASE_URL,
    'drives a hidden file input via setInputFiles — local app only',
  );

  await gotoFresh(page);

  // Seed one pre-existing item, then read back its REAL id from the home-card testid.
  await seedItem(page, {
    title: 'OriginalDiagram',
    dsl: 'OrigA\nOrigB\nOrigA->OrigB: original',
    firstSave: true,
  });

  await gotoHome(page);
  await expect(page.locator('[data-testid="home-grid"]')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator('[data-testid^="home-card-"]')).toHaveCount(1);

  // Extract the seeded item's id from its card testid (home-card-<id>).
  const seededTestId = await page
    .locator('[data-testid^="home-card-"]')
    .first()
    .getAttribute('data-testid');
  const seededId = seededTestId.replace('home-card-', '');
  expect(seededId.length).toBeGreaterThan(0);

  // Build an import payload that OVERLAPS the seeded id (a duplicate) AND adds one
  // genuinely new id. handleImport keys items by id (map[it.id] = it), so the
  // duplicate overwrites the existing row rather than creating a second copy — the
  // grid should grow by exactly ONE (the new id), not two.
  const newId = 'exp5-brand-new-item';
  const payload = JSON.stringify({
    items: [
      {
        id: seededId, // DUPLICATE of the already-saved item
        title: 'OriginalDiagram (re-imported)',
        js: 'OrigA\nOrigB\nOrigA->OrigB: reimported',
        css: '',
        html: '',
        htmlMode: 'html',
        cssMode: 'css',
        jsMode: 'js',
        updatedOn: Date.now(),
      },
      {
        id: newId, // genuinely NEW
        title: 'FreshlyImportedDiagram',
        js: 'NewA\nNewB\nNewA->NewB: fresh',
        css: '',
        html: '',
        htmlMode: 'html',
        cssMode: 'css',
        jsMode: 'js',
        updatedOn: Date.now(),
      },
    ],
  });

  await page.locator('[data-testid="lib-import-input"]').setInputFiles({
    name: 'overlap.json',
    mimeType: 'application/json',
    buffer: Buffer.from(payload, 'utf-8'),
  });

  // Re-navigate so a fresh useItems mount reads the updated local index.
  await gotoHome(page);

  // The new item appears; the original is still there exactly once. Total = 2, NOT 3
  // — the duplicate id was merged (overwritten), not appended as a new row.
  await expect(
    page.getByText('FreshlyImportedDiagram', { exact: true }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.locator(`[data-testid="home-card-${newId}"]`),
  ).toBeVisible();
  await expect(
    page.locator(`[data-testid="home-card-${seededId}"]`),
  ).toHaveCount(1);
  await expect(page.locator('[data-testid^="home-card-"]')).toHaveCount(2);
});
