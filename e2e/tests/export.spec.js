// Export / Import variants (EXP-1..EXP-5 from e2e/E2E_GAP_TEST_PLAN.md §12).
//
// Signed-out / local flows only. Export-all JSON and import-JSON happy paths are
// covered by library.spec.js. This spec checks rendered PNG/SVG downloads,
// malformed-import feedback, and merge deduplication.
//
// SURFACE NOTES:
//   - The renderer header's Download diagram control opens ExportDialog, which
//     previews the current diagram and downloads PNG or SVG. SVG is intentionally
//     unavailable with custom CSS; native dark SVG is supported.
//   - EXP-3 checks the supported bulk JSON export (also covered by library.spec.js).
//   - Malformed import (EXP-4): ImportFeedback surfaces an actionable alert.
//   - Merge behavior is checked by EXP-5.
//
// GUARDS: download assertions and import cases that drive a hidden file input are
// local-only, so they self-skip on the remote staging gate (PW_BASE_URL set).

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor, gotoHome } from './helpers/hub';

const selectAll = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';
// A local override still runs local-only assertions; staging URLs remain excluded.
const isRemoteTarget = !!process.env.PW_BASE_URL && !/^https?:\/\/(localhost|127\.0\.0\.1)(?::|\/|$)/.test(process.env.PW_BASE_URL);

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
  await page.keyboard.press('ControlOrMeta+s'); // manual save (⌘S; the logo menu is gone)
  await dismissSaveNoticeIfPresent(page, { expected: firstSave });
}

// ──────────────────────────────────────────────────────────────────────────────
// EXP-1: PNG download contains a valid image with rendered pixels.
// ──────────────────────────────────────────────────────────────────────────────
test('EXP-1 Download diagram exports a non-empty PNG image', async ({ page }) => {
  test.skip(
    isRemoteTarget,
    'checks a local browser download and image bytes',
  );

  await gotoFresh(page);
  await setTitle(page, 'E2E PNG Export');
  await typeDsl(page, 'Alice\nBob\nAlice->Bob: pngExportProbe');

  await page.locator('[data-testid="renderer-download"]').click();
  const dialog = page.locator('[data-testid="export-dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('img', { name: 'Diagram export preview' })).toBeVisible({ timeout: 20_000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
  await dialog.getByRole('button', { name: 'Download PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('e2e-png-export.png');

  const path = await download.path();
  const fs = await import('fs');
  const png = fs.readFileSync(path);
  if (process.env.E2E_EXPORT_EVIDENCE_DIR) {
    fs.mkdirSync(process.env.E2E_EXPORT_EVIDENCE_DIR, { recursive: true });
    fs.copyFileSync(path, `${process.env.E2E_EXPORT_EVIDENCE_DIR}/exp1-diagram.png`);
  }
  expect(png.length).toBeGreaterThan(1000);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.toString('ascii', 12, 16)).toBe('IHDR');
  expect(png.readUInt32BE(16)).toBeGreaterThan(0);
  expect(png.readUInt32BE(20)).toBeGreaterThan(0);
});

// ──────────────────────────────────────────────────────────────────────────────
// EXP-2: SVG download is well-formed and contains the rendered diagram labels.
// ──────────────────────────────────────────────────────────────────────────────
test('EXP-2 Download diagram exports valid SVG with diagram content', async ({ page }) => {
  test.skip(
    isRemoteTarget,
    'checks a local browser download and SVG document',
  );

  await gotoFresh(page);
  await setTitle(page, 'E2E SVG Export');
  await typeDsl(page, 'Alice\nBob\nAlice->Bob: svgExportProbe');

  await page.locator('[data-testid="renderer-download"]').click();
  const dialog = page.locator('[data-testid="export-dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('img', { name: 'Diagram export preview' })).toBeVisible({ timeout: 20_000 });
  await dialog.getByRole('combobox', { name: 'Export format' }).click();
  await page.getByRole('option', { name: 'SVG image', exact: true }).click();
  const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
  await dialog.getByRole('button', { name: 'Download SVG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('e2e-svg-export.svg');

  const path = await download.path();
  const fs = await import('fs');
  const svgText = fs.readFileSync(path, 'utf-8');
  if (process.env.E2E_EXPORT_EVIDENCE_DIR) {
    fs.mkdirSync(process.env.E2E_EXPORT_EVIDENCE_DIR, { recursive: true });
    fs.copyFileSync(path, `${process.env.E2E_EXPORT_EVIDENCE_DIR}/exp2-diagram.svg`);
  }
  const parsed = await page.evaluate((text) => {
    const document = new DOMParser().parseFromString(text, 'image/svg+xml');
    return {
      hasParserError: Boolean(document.querySelector('parsererror')),
      rootName: document.documentElement.localName,
      namespace: document.documentElement.namespaceURI,
    };
  }, svgText);
  expect(parsed.hasParserError).toBe(false);
  expect(parsed.rootName).toBe('svg');
  expect(parsed.namespace).toBe('http://www.w3.org/2000/svg');
  expect(svgText).toContain('Alice');
  expect(svgText).toContain('Bob');
});

// ──────────────────────────────────────────────────────────────────────────────
// EXP-3: Export all produces a JSON backup containing the saved diagram.
// ──────────────────────────────────────────────────────────────────────────────
test('EXP-3 Export all downloads JSON containing the saved diagram', async ({
  page,
}) => {
  test.skip(
    isRemoteTarget,
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

  await gotoHome(page);
  await expect(page.getByText('HtmlExportDiagram', { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
  await page.locator('[data-testid="lib-export-all"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('zenuml-diagrams.json');
  const path = await download.path();
  const fs = await import('fs');
  const payload = JSON.parse(fs.readFileSync(path, 'utf-8'));
  expect(payload.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ title: 'HtmlExportDiagram', js: expect.stringContaining(UNIQUE_PARTICIPANT) }),
  ]));
});

// ──────────────────────────────────────────────────────────────────────────────
// EXP-4: Importing malformed JSON shows an error dialog (not silent).
// ──────────────────────────────────────────────────────────────────────────────
test('EXP-4 importing malformed JSON shows actionable import feedback', async ({
  page,
}) => {
  test.skip(
    isRemoteTarget,
    'drives a hidden file input via setInputFiles — local app only',
  );

  await gotoFresh(page);

  // Go to the HomeView hub where the ImportExportBar (and its import-error dialog)
  // lives. An empty library still renders the import control.
  await gotoHome(page);

  const errorAlert = page.locator('[data-testid="import-feedback"]');
  await expect(errorAlert).toHaveCount(0);

  // Feed the hidden file input a file that is NOT valid JSON. parseImportJson does
  // JSON.parse(text) which throws; handleImport catches it → setImportError → dialog.
  await page.locator('[data-testid="lib-import-input"]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{ this is not valid json ]]', 'utf-8'),
  });

  await expect(errorAlert).toContainText('This file can’t be imported', { timeout: 10_000 });
  await expect(errorAlert).toContainText('isn’t valid JSON');
  await expect(errorAlert.getByRole('button', { name: 'Choose another file' })).toBeVisible();
  await expect(page.locator('[data-testid^="home-card-"]')).toHaveCount(0);
});

// ──────────────────────────────────────────────────────────────────────────────
// EXP-5: Importing an overlapping set skips duplicate IDs (only new rows added).
// ──────────────────────────────────────────────────────────────────────────────
test('EXP-5 importing an overlapping set skips duplicate IDs — only new rows added', async ({
  page,
}) => {
  test.skip(
    isRemoteTarget,
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
