// M03 Task 15 — Library panel E2E (signed-out / local flows only).
//
// What this covers WITHOUT the Firebase emulator:
//   1. Library panel renders the user's locally-saved diagrams.
//   2. SearchInput filters the rendered list (client-side, in memory).
//   3. Export-all triggers a JSON file download.
//   4. Importing a small JSON adds a new row.
//
// DEFERRED to the staging gate (require Firebase auth/emulator, NOT testable
// signed-out): folder CRUD (writes users/{uid}.folders) and create-share (POST
// /create-share reads the cloud item doc + needs a fresh ID token). Same auth
// note as persistence.spec.js / M02.
//
// Load-bearing implementation fact (verified against web/src/hooks/useItems.ts):
// signed-out, `useItems` reads the localItems index EXACTLY ONCE per mount
// (effect deps [uid, svc], no storage listener). Items saved/imported *after*
// page load do NOT appear until the next full page load. So the seed → reload →
// open-library shape below is required, not incidental — mirroring how
// persistence.spec.js reloads to read restored state. Search/export operate on
// the already-loaded list and need no reload.

import { test, expect } from '@playwright/test';

const selectAll = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';

// Deployed sites load third-party analytics/CDN scripts that throw uncaught
// errors we don't own; treat those as noise (copied from persistence.spec.js).
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

/** Navigate to the app with a clean localStorage slate (see persistence.spec.js). */
async function gotoFresh(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
}

function editorLocator(page) {
  return page.locator('[data-testid="dsl-editor"] .cm-content');
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

/** Set the diagram title via the header title field (used to identify rows). */
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
 * The FIRST signed-out Save opens a one-time "Saved on this device" notice
 * (AppRoot: setNoticeOpen on first save when loginAndSaveMessageSeen is false).
 * It's a Radix Dialog whose overlay intercepts the next click, so dismiss it via
 * its "Not now" button (data-testid="confirm-cancel") if present.
 */
async function dismissSaveNoticeIfPresent(page) {
  const cancel = page.locator('[data-testid="confirm-cancel"]');
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click();
    await expect(cancel).toBeHidden();
  }
}

/**
 * Seed one local item: set a distinctive title + DSL, then Save. Signed-out
 * Save routes through itemService.setItem → localItems.add(id) (verified in
 * web/src/services/itemService.ts), so the id lands in the local index.
 */
async function seedItem(page, { title, dsl }) {
  await setTitle(page, title);
  await typeDsl(page, dsl);
  await expect(editorLocator(page)).toContainText(dsl.split('\n')[0]);
  await page.locator('[data-testid="header-save"]').click();
  await dismissSaveNoticeIfPresent(page);
}

/** Reload, then re-open the Library panel (uiStore.activePanel resets on reload). */
async function reloadIntoLibrary(page) {
  await page.reload();
  await expect(editorLocator(page)).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid="sidebar-library"]').click();
  await expect(page.locator('[data-testid="library-panel"]')).toBeVisible({ timeout: 10_000 });
}

// ──────────────────────────────────────────────────────────────────────────────
// Test 1: Library lists locally-saved diagrams; search filters them.
// ──────────────────────────────────────────────────────────────────────────────
test('library lists local items and SearchInput filters them', async ({ page }) => {
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });

  await gotoFresh(page);

  // Seed item 1.
  await seedItem(page, {
    title: 'AlphaDiagram',
    dsl: 'AlphaActor\nBetaActor\nAlphaActor->BetaActor: alphaCall',
  });

  // New diagram, then seed item 2 (distinct title so search can discriminate).
  await page.locator('[data-testid="header-new"]').click();
  await expect(editorLocator(page)).toBeVisible();
  await seedItem(page, {
    title: 'GammaDiagram',
    dsl: 'GammaActor\nDeltaActor\nGammaActor->DeltaActor: gammaCall',
  });

  // Reload so useItems re-reads the now-populated local index, then open Library.
  await reloadIntoLibrary(page);

  // Both saved items appear as rows.
  await expect(page.locator('[data-testid="library-list"]')).toBeVisible();
  await expect(page.getByText('AlphaDiagram', { exact: true })).toBeVisible();
  await expect(page.getByText('GammaDiagram', { exact: true })).toBeVisible();

  // Count the real item rows (exclude the per-row kebab menu testids).
  const rowCount = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid^="lib-row-"]')).filter(
      (el) => !el.getAttribute('data-testid')?.startsWith('lib-row-menu-'),
    ).length,
  );
  expect(rowCount).toBe(2);

  // Type into the search field → list filters to the matching item only.
  const search = page.locator('[data-testid="lib-search"]');
  await search.click();
  await search.pressSequentially('Alpha');

  await expect(page.getByText('AlphaDiagram', { exact: true })).toBeVisible();
  await expect(page.getByText('GammaDiagram', { exact: true })).toHaveCount(0);

  // Clearing the search restores both rows.
  await page.locator('[data-testid="search-clear"]').click();
  await expect(page.getByText('AlphaDiagram', { exact: true })).toBeVisible();
  await expect(page.getByText('GammaDiagram', { exact: true })).toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 2: Export-all triggers a JSON download.
// ──────────────────────────────────────────────────────────────────────────────
test('export-all triggers a JSON file download', async ({ page }) => {
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });

  await gotoFresh(page);

  await seedItem(page, {
    title: 'ExportableDiagram',
    dsl: 'ExA\nExB\nExA->ExB: exportMe',
  });

  await reloadIntoLibrary(page);
  await expect(page.getByText('ExportableDiagram', { exact: true })).toBeVisible();

  // Clicking export-all builds a Blob and triggers a download (handleExportAll →
  // downloadText('zenuml-diagrams.json', …)). Assert the download event fires.
  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
  await page.locator('[data-testid="lib-export-all"]').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('zenuml-diagrams.json');
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 3: Importing a small JSON adds a new row (after reload — stale-list rule).
// ──────────────────────────────────────────────────────────────────────────────
test('importing a JSON file adds a new library row', async ({ page }) => {
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });

  await gotoFresh(page);

  // Seed one pre-existing item so we can prove the import ADDS a row.
  await seedItem(page, {
    title: 'PreexistingDiagram',
    dsl: 'PreA\nPreB\nPreA->PreB: existing',
  });

  await reloadIntoLibrary(page);
  await expect(page.getByText('PreexistingDiagram', { exact: true })).toBeVisible();

  // Build a minimal import payload matching the { items: Item[] } shape that
  // exportAllItemsJson produces and parseImportJson accepts. The migrate step
  // (migrateToPages) tolerates this minimal item.
  const importedTitle = 'ImportedDiagram';
  const importedId = 'imported-item-e2e';
  const payload = JSON.stringify({
    items: [
      {
        id: importedId,
        title: importedTitle,
        js: 'ImpA\nImpB\nImpA->ImpB: imported',
        css: '',
        html: '',
        htmlMode: 'html',
        cssMode: 'css',
        jsMode: 'js',
        updatedOn: Date.now(),
      },
    ],
  });

  // setInputFiles on the hidden file input — no fixture file needed.
  await page.locator('[data-testid="lib-import-input"]').setInputFiles({
    name: 'import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(payload, 'utf-8'),
  });

  // handleImport calls itemService.saveItems (writes localItems) but does NOT
  // reload — so the new row only appears after the next mount. Reload + reopen.
  await reloadIntoLibrary(page);

  await expect(page.getByText('ImportedDiagram', { exact: true })).toBeVisible();
  await expect(page.getByText('PreexistingDiagram', { exact: true })).toBeVisible();
});
