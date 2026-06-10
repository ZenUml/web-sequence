// M03 Task 15 — Library E2E (signed-out / local flows only).
//
// Hub (PRs #800/#801; f023f89 "no-rail layout"): the in-editor Library PANEL was
// retired — the Sidebar icon rail (sidebar-library) and LibraryPanel no longer
// render anywhere. The web library IS the HomeView page at '/': rows are
// home-card-<id> cards in home-grid, search is home-search (same SearchInput
// component, so the clear affordance is still search-clear), and the bulk
// Export-all / Import controls (lib-export-all / lib-import-input) were re-homed
// into the HomeView header (see web/src/components/home/HomeView.tsx). Each
// test's INTENT is unchanged — list, filter, export, import — only the surface
// the library lives on moved.
//
// What this covers WITHOUT the Firebase emulator:
//   1. HomeView grid renders the user's locally-saved diagrams.
//   2. SearchInput filters the rendered grid (client-side, in memory).
//   3. Export-all triggers a JSON file download.
//   4. Importing a small JSON adds a new card.
//
// DEFERRED to the staging gate (require Firebase auth/emulator, NOT testable
// signed-out): folder CRUD (writes users/{uid}.folders) and create-share (POST
// /create-share reads the cloud item doc + needs a fresh ID token). Same auth
// note as persistence.spec.js / M02.
//
// Navigation note: seeding happens in the EDITOR (reached through the hub's New
// CTA — openEditor); reading the library back happens by a FULL navigation to
// '/' (gotoHome), which freshly mounts useItems and re-reads the localItems
// index regardless of in-page subscription timing.

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor, gotoHome } from './helpers/hub';

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

/** Navigate to the EDITOR with a clean localStorage slate (see persistence.spec.js). */
async function gotoFresh(page) {
  // M04: the first load would open the Onboarding/Support-pledge one-time modals on
  // a clean slate; seed their flags via an init script before any goto so the
  // header/editor stay interactable. (localStorage.clear() below wipes user data but
  // re-runs the init script's writes on the subsequent goto.)
  await suppressOneTimeModals(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  // Hub: '/' is the HomeView library — seeding drives the editor's header, so
  // click through the hub's New CTA (empty library → home-empty-new).
  await openEditor(page);
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
 * its "Not now" button (data-testid="confirm-cancel").
 *
 * The notice mounts several microtasks AFTER header-save.click() resolves (save()
 * runs setItem → localStore writes → setNoticeOpen → React render → portal mount).
 * A bare isVisible() check would race that mount. Because gotoFresh() clears
 * localStorage, loginAndSaveMessageSeen is false, so the FIRST save in every test
 * shows the notice with CERTAINTY — wait for it deterministically ({expected:true}).
 * Later saves never re-show it (the flag is now set) → fast no-op path.
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

/**
 * Seed one local item: set a distinctive title + DSL, then Save. Signed-out
 * Save routes through itemService.setItem → localItems.add(id) (verified in
 * web/src/services/itemService.ts), so the id lands in the local index.
 * Pass { firstSave: true } for the first seed after gotoFresh so the one-time
 * notice is awaited deterministically rather than raced.
 */
async function seedItem(page, { title, dsl, firstSave = false }) {
  await setTitle(page, title);
  await typeDsl(page, dsl);
  await expect(editorLocator(page)).toContainText(dsl.split('\n')[0]);
  // Save lives inside the header-menu dropdown — open it first.
  await page.locator('[data-testid="header-menu"]').click();
  await page.locator('[data-testid="header-save"]').click();
  await dismissSaveNoticeIfPresent(page, { expected: firstSave });
}

/**
 * Navigate to the library. Hub (PRs #800/#801): the library is no longer an
 * in-editor side panel (sidebar-library + library-panel are gone — f023f89
 * removed the rail and LibraryPanel was retired); it is the HomeView page at
 * '/'. gotoHome is a FULL navigation, so useItems freshly re-reads the
 * localItems index — same guarantee the old reload-then-open-panel shape gave.
 */
async function reloadIntoLibrary(page) {
  await gotoHome(page);
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

  // Seed item 1 — first save shows the one-time notice (await it deterministically).
  await seedItem(page, {
    title: 'AlphaDiagram',
    dsl: 'AlphaActor\nBetaActor\nAlphaActor->BetaActor: alphaCall',
    firstSave: true,
  });

  // New lives inside the header-menu dropdown — open it first.
  await page.locator('[data-testid="header-menu"]').click();
  await page.locator('[data-testid="header-new"]').click();
  await expect(editorLocator(page)).toBeVisible();
  await seedItem(page, {
    title: 'GammaDiagram',
    dsl: 'GammaActor\nDeltaActor\nGammaActor->DeltaActor: gammaCall',
  });

  // Navigate to the library (hub: the HomeView page) so useItems re-reads the
  // now-populated local index.
  await reloadIntoLibrary(page);

  // Both saved items appear as cards in the home grid (hub PRs: library-list /
  // lib-row-* became home-grid / home-card-* — see HomeView.tsx + DiagramCard.tsx).
  await expect(page.locator('[data-testid="home-grid"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('AlphaDiagram', { exact: true })).toBeVisible();
  await expect(page.getByText('GammaDiagram', { exact: true })).toBeVisible();

  // Count the item cards (DiagramCard's only testid is home-card-<id> — the kebab
  // trigger carries none, so a bare prefix count is exact).
  await expect(page.locator('[data-testid^="home-card-"]')).toHaveCount(2);

  // Type into the search field → grid filters to the matching item only.
  // (hub PRs: lib-search became home-search — same SearchInput component.)
  const search = page.locator('[data-testid="home-search"]');
  await search.click();
  await search.pressSequentially('Alpha');

  await expect(page.getByText('AlphaDiagram', { exact: true })).toBeVisible();
  await expect(page.getByText('GammaDiagram', { exact: true })).toHaveCount(0);

  // Clearing the search restores both cards (SearchInput's clear affordance kept
  // its search-clear testid through the hub move).
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
    firstSave: true,
  });

  await reloadIntoLibrary(page);
  await expect(page.getByText('ExportableDiagram', { exact: true })).toBeVisible();

  // Clicking export-all builds a Blob and triggers a download (handleExportAll →
  // downloadText('zenuml-diagrams.json', …)). Assert the download event fires.
  // (hub PRs: lib-export-all kept its testid but now lives in the HomeView
  // header's ImportExportBar — the retired LibraryPanel no longer renders it.)
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
    firstSave: true,
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

  // setInputFiles on the hidden file input — no fixture file needed. (hub PRs:
  // lib-import-input kept its testid but now lives in the HomeView header's
  // ImportExportBar.)
  await page.locator('[data-testid="lib-import-input"]').setInputFiles({
    name: 'import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(payload, 'utf-8'),
  });

  // handleImport calls itemService.saveItems (writes localItems). Re-navigate to
  // the library so a fresh useItems mount reads the updated index — deterministic
  // regardless of in-page subscription timing.
  await reloadIntoLibrary(page);

  await expect(page.getByText('ImportedDiagram', { exact: true })).toBeVisible();
  await expect(page.getByText('PreexistingDiagram', { exact: true })).toBeVisible();
});
