// Signed-out/local flows only. Authenticated cloud-sync E2E requires the
// Firebase emulator and is deferred to the staging gate.
//
// Tests the local-persistence layer (localStorage) that survives page reloads
// and across tabs — without any Firebase auth:
//   1. last-code restore on reload (preserveLastCode default true)
//   2. per-page content is isolated across multi-page tabs
//   3. "New" resets to the default starter DSL

import { test, expect } from '@playwright/test';

// Default starter DSL, from web/src/state/editorStore.ts DEFAULT_STARTER.
const STARTER_DSL_FRAGMENT = 'A.SyncMessage';

// Helpers shared with dsl-spot-check.spec.js style — copy the exact approach:
// click .cm-content to focus, select-all, Delete, then pressSequentially.
const selectAll = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';

// Deployed sites (staging/prod, reached via PW_BASE_URL) load third-party
// analytics/CDN scripts that throw uncaught errors we don't own; treat those as
// noise so this spec stays usable against the live staging E2E gate.
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

/**
 * Navigate to the app with a clean localStorage slate.
 * Uses a two-step approach: navigate to /empty-storage-sentinel (any path the
 * app serves — its own origin), clear localStorage, THEN go to '/'. This avoids
 * addInitScript which re-runs on every page.reload() and would wipe the storage
 * that the reload is supposed to read.
 */
async function gotoFresh(page) {
  // Step 1: land on the app origin so we can write to its localStorage.
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  // Step 2: reload — this time localStorage is empty and we do NOT re-clear it.
  await page.goto('/');
}

/** Type a replacement DSL into the CM6 editor (select-all → Delete → type). */
async function typeDsl(page, dsl, { timeout = 10_000 } = {}) {
  const editor = page.locator('[data-testid="dsl-editor"] .cm-content');
  await expect(editor).toBeVisible({ timeout });
  await editor.click();
  await page.keyboard.press(selectAll);
  await page.keyboard.press('Delete');
  await editor.pressSequentially(dsl);
}

/** The CM6 editor content surface. */
function editorLocator(page) {
  return page.locator('[data-testid="dsl-editor"] .cm-content');
}

// ──────────────────────────────────────────────────────────────────────────────
// Test 1: Last-code restore on reload
// ──────────────────────────────────────────────────────────────────────────────
test('last-code restore: typed DSL persists across a page reload', async ({ page }) => {
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });

  // Fresh start: no prior state in localStorage.
  await gotoFresh(page);

  const UNIQUE_PARTICIPANT = 'PersistenceProbe';
  const DSL = `${UNIQUE_PARTICIPANT}\nUser\nUser->${UNIQUE_PARTICIPANT}: RestoreTest`;

  // Type distinctive DSL — proves restore, not the default starter.
  await typeDsl(page, DSL);

  // Confirm the text landed in the editor before triggering the reload.
  await expect(editorLocator(page)).toContainText(UNIQUE_PARTICIPANT);

  // Ensure last-code is written to localStorage. The AppRoot writes it on
  // `beforeunload` AND on `visibilitychange` (document.hidden → true).
  // Dispatch the visibilitychange event explicitly so the async write resolves
  // before we check — the storage call is void-ed but localStorage.setItem is
  // synchronous under localStore, so the value is available immediately after
  // the event fires.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  // Poll until localStorage['code'] contains our token — proves the write
  // happened before we reload (handles any async wrapper overhead).
  await page.waitForFunction(
    (participant) => {
      const raw = localStorage.getItem('code');
      if (!raw) return false;
      try { return JSON.parse(raw)?.js?.includes(participant); } catch { return false; }
    },
    UNIQUE_PARTICIPANT,
    { timeout: 5_000 },
  );

  // Reload: boot reads localStorage['code'] (preserveLastCode=true by default)
  // and restores the item — no addInitScript runs this time.
  await page.reload();

  // Wait for the editor to re-hydrate with the restored content.
  await expect(editorLocator(page)).toBeVisible({ timeout: 15_000 });
  await expect(editorLocator(page)).toContainText(UNIQUE_PARTICIPANT, { timeout: 15_000 });
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 2: Multi-page — per-page content is isolated
// ──────────────────────────────────────────────────────────────────────────────
test('multi-page: each page stores its own DSL independently', async ({ page }) => {
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });

  await gotoFresh(page);

  // Page 1: type distinctive DSL.
  const DSL_PAGE1 = 'AliceService\nBobService\nAliceService->BobService: Page1Call';
  await typeDsl(page, DSL_PAGE1);
  await expect(editorLocator(page)).toContainText('AliceService');

  // Add page 2 — addPage() auto-switches currentPageId to the new page.
  await page.locator('[data-testid="page-add"]').click();

  // The editor remounts (CodeEditor key=`dsl-${item.currentPageId}`) for the new
  // empty page. Re-focus and type page-2 DSL. Allow more time for the remount.
  const DSL_PAGE2 = 'CharlieService\nDaveService\nCharlieService->DaveService: Page2Call';
  await typeDsl(page, DSL_PAGE2, { timeout: 15_000 });
  await expect(editorLocator(page)).toContainText('CharlieService');

  // Switch back to page 1 tab (first tab by position).
  const page1Tab = page.locator('[data-testid^="page-tab-"]').nth(0);
  await page1Tab.click();

  // Editor remounts again — wait for it to show page-1 content.
  await expect(editorLocator(page)).toContainText('AliceService', { timeout: 10_000 });
  await expect(editorLocator(page)).not.toContainText('CharlieService');

  // Switch back to page 2 tab.
  const page2Tab = page.locator('[data-testid^="page-tab-"]').nth(1);
  await page2Tab.click();

  await expect(editorLocator(page)).toContainText('CharlieService', { timeout: 10_000 });
  await expect(editorLocator(page)).not.toContainText('AliceService');
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 3: "New" resets to the default starter DSL
// ──────────────────────────────────────────────────────────────────────────────
test('header-new: clicking New resets editor to the default starter DSL', async ({ page }) => {
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });

  await gotoFresh(page);

  // Type content that is distinctly NOT the starter so New has something to replace.
  const CUSTOM_DSL = 'CustomActor\nOtherActor\nCustomActor->OtherActor: CustomMessage';
  await typeDsl(page, CUSTOM_DSL);
  await expect(editorLocator(page)).toContainText('CustomActor');

  // Click the "New" button in the header.
  await page.locator('[data-testid="header-new"]').click();

  // After New, the editor should show the default starter DSL, not our custom content.
  // DEFAULT_STARTER.js = 'A.SyncMessage\nA->B: AsyncMessage' (editorStore.ts)
  await expect(editorLocator(page)).toContainText(STARTER_DSL_FRAGMENT, { timeout: 10_000 });
  await expect(editorLocator(page)).not.toContainText('CustomActor');
});
