// Signed-out/local flows only. Authenticated cloud-sync E2E requires the
// Firebase emulator and is deferred to the staging gate.
//
// Tests the local-persistence layer (localStorage) that survives page reloads
// and across tabs — without any Firebase auth:
//   1. typed DSL survives a reload of the editor URL (hub re-ground — see test 1)
//   2. per-page content is isolated across multi-page tabs
//   3. "New" resets to the default starter DSL
//
// Hub (PRs #800/#801): bare '/' renders the HomeView library, so every test
// reaches the editor through the hub's New CTA (openEditor) and the editor lives
// at /?id=<uuid>. That URL shape changes WHICH boot branch a reload exercises —
// see the test-1 comment.

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor } from './helpers/hub';

// Default starter DSL, from web/src/state/editorStore.ts DEFAULT_STARTER.
const STARTER_DSL_FRAGMENT = 'Alice -> Bob: Hello';

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
 * Navigate to the EDITOR with a clean localStorage slate.
 * Lands on the app origin first to clear storage, then clicks through the hub
 * (openEditor) — this avoids addInitScript-based clearing, which re-runs on every
 * page.reload() and would wipe the storage that the reload is supposed to read.
 */
async function gotoFresh(page) {
  // M04: seed ONLY the one-time-modal flags (onboarded / lastSeenVersion) via an
  // init script so Onboarding/Support-pledge don't trap focus. This is safe with
  // this spec's reload-reads-storage approach: the init script ADDS two unrelated
  // keys on each navigation but never touches the item/`code` slots reloads read.
  await suppressOneTimeModals(page);
  // Step 1: land on the app origin so we can write to its localStorage.
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  // Step 2: hub (PRs #800/#801) — '/' is the HomeView library; reach the editor
  // through the New CTA. User data is empty; the init script re-seeds only the
  // one-time flags. We do NOT re-clear here.
  await openEditor(page);
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
// Test 1: Typed DSL survives a page reload of the editor URL.
//
// HUB RE-GROUND (PRs #800/#801) — this used to be "last-code restore": reload at
// '/' booted the preserveLastCode branch, which read localStorage['code'] back
// into the editor. Under the hub the editor lives at /?id=<uuid> and bare '/'
// renders the HomeView library, so the boot-time last-code READ branch
// (resolveBootItem branch 3 — only reachable with NO ?id) can no longer be hit
// from any editor URL on the web (verified live: reloading /?id= with an unsaved
// item boots 'new' → starter DSL). The reload-persistence contract the user sees
// is now: SAVE the diagram → reload /?id=<id> → boot getItem(id) restores the
// local copy. This test follows that contract; the still-live last-code WRITE
// path (visibilitychange/beforeunload → 'code' slot, REQ-PST) keeps its
// assertion below so a regression in the write side stays visible.
// ──────────────────────────────────────────────────────────────────────────────
test('reload persistence: saved DSL is restored when the editor URL reloads', async ({ page }) => {
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

  // REQ-PST write path (unchanged by the hub): AppRoot writes the last-code slot
  // on `beforeunload` AND on `visibilitychange` (document.hidden → true).
  // Dispatch visibilitychange explicitly and poll until localStorage['code']
  // contains our token — keeps the write side guarded even though the web boot
  // no longer reads it back at an editor URL (see header comment).
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(
    (participant) => {
      const raw = localStorage.getItem('code');
      if (!raw) return false;
      try { return JSON.parse(raw)?.js?.includes(participant); } catch { return false; }
    },
    UNIQUE_PARTICIPANT,
    { timeout: 5_000 },
  );

  // Hub restore contract: SAVE the diagram so the reload's getItem(?id) finds the
  // local copy. Save lives inside the header-menu dropdown; the FIRST signed-out
  // save opens the one-time "Saved on this device" notice (fresh slate →
  // loginAndSaveMessageSeen is false, so it shows with certainty) — dismiss it.
  await page.locator('[data-testid="header-menu"]').click();
  await page.locator('[data-testid="header-save"]').click();
  const noticeCancel = page.locator('[data-testid="confirm-cancel"]');
  await expect(noticeCancel).toBeVisible();
  await noticeCancel.click();
  await expect(noticeCancel).toBeHidden();

  // Guard: poll until the item slot (keyed by the /?id= uuid) holds our token —
  // proves the save landed before we reload.
  const itemId = new URL(page.url()).searchParams.get('id');
  expect(itemId, 'editor URL must carry ?id=<uuid> under the hub').toBeTruthy();
  await page.waitForFunction(
    ({ id, participant }) => {
      const raw = localStorage.getItem(id);
      return !!raw && raw.includes(participant);
    },
    { id: itemId, participant: UNIQUE_PARTICIPANT },
    { timeout: 5_000 },
  );

  // Reload: boot resolves ?id= via getItem (signed-out → local copy) and restores
  // the item — no addInitScript clearing runs this time.
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

  // Open the app menu then click "New" (New lives inside the header-menu dropdown).
  await page.locator('[data-testid="header-menu"]').click();
  await page.locator('[data-testid="header-new"]').click();

  // #8: with unsaved edits, New first asks to confirm discarding them. Confirm the
  // discard so New proceeds (a clean diagram would skip this dialog entirely).
  await page.locator('[data-testid="confirm-ok"]').click();

  // After New, the editor should show the default starter DSL, not our custom content.
  // DEFAULT_STARTER.js = 'Alice -> Bob: Hello\nBob -> Alice: Hi back' (editorStore.ts)
  await expect(editorLocator(page)).toContainText(STARTER_DSL_FRAGMENT, { timeout: 10_000 });
  await expect(editorLocator(page)).not.toContainText('CustomActor');
});
