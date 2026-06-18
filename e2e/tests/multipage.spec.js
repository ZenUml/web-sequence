// Multi-page (PG-1..PG-4) — signed-out / local UI, no Firebase emulator.
//
// Drives the PageTabs component (web/src/components/pages/PageTabs.tsx), which
// renders inside the renderer header, always present in the editor. REAL
// selectors from that component:
//   - page-tab-<id>      : a <div role="tab"> per page; double-click → rename
//   - page-rename-<id>   : the inline TextInput shown while renaming a tab
//   - page-delete-<id>   : the × IconButton, ONLY rendered when !page.isDefault
//   - page-add           : the + IconButton (addPage auto-switches to the new page)
//   - confirm-ok / confirm-cancel : the shared ConfirmDialog buttons (delete confirm)
//
// Page ids are genId()-dynamic, so each test discovers the live id from the
// `page-tab-<id>` testid rather than hard-coding one — mirroring persistence.spec.js's
// positional `[data-testid^="page-tab-"]` approach.
//
// PG-4 note: signed-out, the header save-state indicator is pinned to "local"
// (AppHeader SaveState short-circuits `!signedIn → local` BEFORE the dirty branch),
// so it is NOT a usable dirty signal here. The renamePage store action sets
// dirty=true (editorStore.ts:76) which is what gates persistence; the observable
// proof is that a manual Save (which only writes because the item is dirty) persists
// the renamed page title into the item's localStorage record (itemService.setItem →
// localStore.set(id, item) → localStorage[<id>] = JSON with pages[].title).

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor } from './helpers/hub';

// Deployed sites (staging/prod via PW_BASE_URL) load third-party analytics/CDN
// scripts that throw uncaught errors we don't own; treat those as noise so this
// spec stays usable against the live staging E2E gate. Locally there are none.
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
 * Land on the origin to clear storage, then click through the hub (openEditor) so
 * boot seeds a fresh sample item — its single default page is what PG-3 checks.
 */
async function gotoFresh(page) {
  await suppressOneTimeModals(page); // M04: keep onboarding/pledge from trapping focus
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openEditor(page);
  // The PageTabs live in the renderer header — at least the default tab is present.
  await expect(page.locator('[data-testid^="page-tab-"]').first()).toBeVisible({
    timeout: 15_000,
  });
}

/** Extract the genId() page id from a `page-tab-<id>` element's testid. */
async function pageIdOf(tab) {
  const testid = await tab.getAttribute('data-testid');
  return testid.replace('page-tab-', '');
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    if (!isThirdPartyError(err)) throw err;
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// PG-1: Rename a page inline (double-click tab) — the tab label updates.
// ──────────────────────────────────────────────────────────────────────────────
test('PG-1: double-click a page tab, rename it, and the tab label updates', async ({
  page,
}) => {
  await gotoFresh(page);

  const firstTab = page.locator('[data-testid^="page-tab-"]').first();
  const id = await pageIdOf(firstTab);

  // Default page starts as "Page 1".
  await expect(firstTab).toContainText('Page 1');

  // Enter rename mode via double-click → the inline TextInput appears.
  await firstTab.dblclick();
  const renameInput = page.locator(`[data-testid="page-rename-${id}"]`);
  await expect(renameInput).toBeVisible();

  // Replace the title and commit with Enter (commitRename → onRename).
  const NEW_TITLE = 'Login Flow';
  await renameInput.fill(NEW_TITLE);
  await renameInput.press('Enter');

  // The rename input is gone and the SAME tab (same id) now shows the new label.
  await expect(renameInput).toBeHidden();
  const renamedTab = page.locator(`[data-testid="page-tab-${id}"]`);
  await expect(renamedTab).toContainText(NEW_TITLE);
  await expect(renamedTab).not.toContainText('Page 1');
});

// ──────────────────────────────────────────────────────────────────────────────
// PG-2: Delete a non-default page (confirm dialog) removes it; active falls back.
// ──────────────────────────────────────────────────────────────────────────────
test('PG-2: deleting a non-default page confirms, removes it, and the active page falls back', async ({
  page,
}) => {
  await gotoFresh(page);

  // Add a second page — addPage auto-switches currentPageId to the new (now active) page.
  await page.locator('[data-testid="page-add"]').click();
  await expect(page.locator('[data-testid^="page-tab-"]')).toHaveCount(2);

  const tabs = page.locator('[data-testid^="page-tab-"]');
  const firstId = await pageIdOf(tabs.nth(0));
  const secondTab = tabs.nth(1);
  const secondId = await pageIdOf(secondTab);

  // The newly-added (second) tab is the active one and is the delete target.
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');

  // Its delete affordance exists (non-default page). Click it → confirm dialog opens.
  await page.locator(`[data-testid="page-delete-${secondId}"]`).click();
  const confirmOk = page.locator('[data-testid="confirm-ok"]');
  await expect(confirmOk).toBeVisible();
  // The dialog is the delete-page confirm, not some other confirm. Target the
  // visible RadixDialog.Title heading — the same text also renders in an sr-only
  // Description fallback (Dialog.tsx), so a plain getByText would match two nodes.
  await expect(
    page.getByRole('heading', { name: 'Delete page?' }),
  ).toBeVisible();

  // Confirm the deletion.
  await confirmOk.click();
  await expect(confirmOk).toBeHidden();

  // The deleted tab is gone; only the first (default) page remains.
  await expect(
    page.locator(`[data-testid="page-tab-${secondId}"]`),
  ).toHaveCount(0);
  await expect(page.locator('[data-testid^="page-tab-"]')).toHaveCount(1);

  // Active page fell back to the surviving default page (deletePage → switchPage).
  const survivor = page.locator(`[data-testid="page-tab-${firstId}"]`);
  await expect(survivor).toBeVisible();
  await expect(survivor).toHaveAttribute('aria-selected', 'true');
});

// ──────────────────────────────────────────────────────────────────────────────
// PG-3: The default (first) page has no delete affordance.
// ──────────────────────────────────────────────────────────────────────────────
test('PG-3: the default (first) page exposes no delete control', async ({
  page,
}) => {
  await gotoFresh(page);

  const firstTab = page.locator('[data-testid^="page-tab-"]').first();
  const firstId = await pageIdOf(firstTab);

  // PageTabs only renders page-delete-<id> when !page.isDefault — the migrated
  // default page IS default, so it has no × button (even after we add a page that does).
  await expect(
    page.locator(`[data-testid="page-delete-${firstId}"]`),
  ).toHaveCount(0);

  // Add a second page: it MUST carry a delete control — proving the absence above
  // is the default-page rule, not page-delete simply never rendering anywhere.
  await page.locator('[data-testid="page-add"]').click();
  const tabs = page.locator('[data-testid^="page-tab-"]');
  await expect(tabs).toHaveCount(2);
  const secondId = await pageIdOf(tabs.nth(1));
  await expect(
    page.locator(`[data-testid="page-delete-${secondId}"]`),
  ).toBeVisible();

  // The default page STILL has no delete control.
  await expect(
    page.locator(`[data-testid="page-delete-${firstId}"]`),
  ).toHaveCount(0);
});

// ──────────────────────────────────────────────────────────────────────────────
// PG-4: A page metadata edit (rename) marks the item dirty → persists on Save.
//
// Signed-out the header indicator can't show "dirty" (it's pinned to "local"), so
// we observe the dirty flag through the channel it actually gates: persistence. A
// manual Save writes the renamed page title into the item's localStorage record;
// reloading and re-reading proves the metadata edit was captured as an unsaved
// change that Save then flushed.
// ──────────────────────────────────────────────────────────────────────────────
test('PG-4: renaming a page marks the item dirty so Save persists the new title', async ({
  page,
}) => {
  // Reading localStorage + driving the in-app Save path is a local-build concern;
  // on the staging gate (PW_BASE_URL) skip rather than assert against a live deploy.
  test.skip(
    !!process.env.PW_BASE_URL,
    'localStorage persistence read needs the local build',
  );

  await gotoFresh(page);

  const firstTab = page.locator('[data-testid^="page-tab-"]').first();
  const id = await pageIdOf(firstTab);

  // Baseline: nothing in localStorage carries our soon-to-be title yet.
  const UNIQUE_TITLE = `RenamedPage_${Date.now()}`;
  const hasTitle = () =>
    page.evaluate((title) => {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k === 'code') continue; // last-code slot, not the item record
        const raw = localStorage.getItem(k);
        if (raw && raw.includes(title)) return true;
      }
      return false;
    }, UNIQUE_TITLE);
  expect(await hasTitle()).toBe(false);

  // Rename the default page — a metadata edit that ONLY sets dirty=true (renamePage
  // does not bump unsavedCount), so any persistence of it is driven purely by dirty.
  await firstTab.dblclick();
  const renameInput = page.locator(`[data-testid="page-rename-${id}"]`);
  await expect(renameInput).toBeVisible();
  await renameInput.fill(UNIQUE_TITLE);
  await renameInput.press('Enter');
  await expect(page.locator(`[data-testid="page-tab-${id}"]`)).toContainText(
    UNIQUE_TITLE,
  );

  // Trigger Save (header menu → Save). Because the rename marked the item dirty,
  // Save writes the current item — including the renamed page — to localStorage.
  await page.locator('[data-testid="header-menu"]').click();
  await page.locator('[data-testid="header-save"]').click();
  // First signed-out Save pops the one-time "Saved on this device" notice; dismiss it.
  const noticeCancel = page.locator('[data-testid="confirm-cancel"]');
  if (await noticeCancel.isVisible().catch(() => false)) {
    await noticeCancel.click();
    await expect(noticeCancel).toBeHidden();
  }

  // The renamed page title now lives in the persisted item record. Poll: the save()
  // local write is async (itemService.setItem awaits localStore.set).
  await expect.poll(hasTitle, { timeout: 5_000 }).toBe(true);
});
