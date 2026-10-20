// Emulator-backed cloud E2E — the AUTH / CLOUD / PADDLE gap cases from
// e2e/E2E_GAP_TEST_PLAN.md, now LIVE against the Firebase Emulator Suite.
//
// HOW THIS RUNS (see playwright.config.js `cloud` project + e2e/EMULATOR_SETUP.md):
//   - The cloud webServer boots `firebase emulators:exec --only auth,firestore,
//     functions` (firebase-tools v13 from functions/node_modules — the global v9
//     CLI's pkg'd Node is too old to parse firebase-admin@11's optional chaining)
//     wrapping `VITE_USE_EMULATOR=1 pnpm -C web dev`.
//   - web/src/services/firebase.ts (gated on VITE_USE_EMULATOR) repoints the SDK at
//     the Auth (:9099) + Firestore (:8080) emulators and exposes window.__e2eSignIn,
//     which signs in a deterministic uid via an UNSIGNED custom token (the emulator
//     doesn't verify the signature) — no popup, no firebase-admin in the browser.
//   - cloudFunctions.ts uses same-origin relative fetch ('/create-share' …); the
//     existing web/vite.config.ts proxy forwards those to the functions emulator.
//   - Firestore side-effects are seeded/probed over the emulator's REST API with the
//     `Authorization: Bearer owner` admin backdoor (e2e/cloud/firestoreEmu.mjs).
//
// Every data-testid here was read out of the live components (verified, not guessed).
// globalSetup wipes Auth+Firestore before the run so each spec starts clean.

import { test, expect } from '@playwright/test';
import {
  signInViaEmulator,
  gotoFresh,
  gotoHome,
  typeDsl,
  editorLocator,
  saveViaShortcut,
  uidForEmail,
} from './helpers/cloud';
import { suppressOneTimeModals } from './helpers/onetime';
import {
  setDoc,
  getDoc,
  queryItemsByOwner,
} from '../cloud/firestoreEmu.mjs';

// A minimal cloud item doc owned by `uid`. The web client reads items/{id} where
// createdBy === uid (itemService) and the functions read the same doc.
function seedItem(uid, id, extra = {}) {
  return setDoc(`items/${id}`, {
    id,
    title: extra.title ?? 'Seeded',
    js: extra.js ?? 'A->B: seeded',
    css: '',
    html: '',
    htmlMode: 'html',
    cssMode: 'css',
    jsMode: 'sequence',
    createdBy: uid,
    updatedOn: Date.now(),
    isShared: extra.isShared ?? false,
    shareToken: extra.shareToken ?? '',
    folderId: extra.folderId ?? null,
    pages: [],
    currentPageId: '',
    ...extra.fields,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// §9 Authentication  (AUTH-1..6)
// ════════════════════════════════════════════════════════════════════════════

test('AUTH-1 — login modal lists the supported Google and GitHub providers', async ({ page }) => {
  await gotoFresh(page);
  await page.locator('[data-testid="header-login"]').click();
  for (const id of ['google', 'github']) {
    await expect(page.locator(`[data-testid="login-${id}"]`)).toBeVisible();
  }
  await expect(page.locator('[data-testid="login-facebook"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="login-twitter"]')).toHaveCount(0);
});

test('AUTH-2 — sign-in → profile menu shows the plan row (free)', async ({ page }) => {
  await gotoFresh(page);
  await signInViaEmulator(page, { uid: 'auth2', email: 'auth2@test.local' });
  await page.locator('[data-testid="profile-trigger"]').click();
  // Free user: profile-upgrade is the plan affordance (profile-plan only shows for
  // subscribed users — paymentEnabled && subscribed). Assert the upgrade row.
  await expect(page.locator('[data-testid="profile-upgrade"]')).toBeVisible();
});

test('AUTH-3 — last-used provider re-surfaces with a "Last used" chip', async ({ page }) => {
  await gotoFresh(page);
  await page.locator('[data-testid="header-login"]').click();
  // Under the emulator, clicking a provider button signs in via custom token (no popup).
  await page.locator('[data-testid="login-github"]').click();
  await expect(page.locator('[data-testid="profile-trigger"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid="profile-trigger"]').click();
  await page.locator('[data-testid="profile-logout"]').click();
  // RELOAD: AppRoot reads lastAuthProvider from localStorage ONCE at mount
  // (useEffect([], …) — see AppRoot.tsx:205-208), so the chip surfaces on the NEXT
  // visit, not within the same session. That IS the product behavior (sign in, leave,
  // come back → "Last used"), so re-load to re-read the persisted provider.
  await page.goto('/');
  await page.locator('[data-testid="header-login"]').click();
  await expect(page.locator('[data-testid="login-github-lastused"]')).toBeVisible({ timeout: 15_000 });
});

test('AUTH-4 — auth error surfaces in the modal alert', async ({ page }) => {
  await gotoFresh(page);
  await page.locator('[data-testid="header-login"]').click();
  // Arm a one-shot forced error: the next provider click rejects with this code,
  // which useAuth surfaces into the login-error notice.
  await page.evaluate(() => window.__e2eForceAuthError('auth/popup-closed-by-user'));
  await page.locator('[data-testid="login-google"]').click();
  await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
});

test('AUTH-5 — login modal auto-dismisses once auth resolves', async ({ page }) => {
  await gotoFresh(page);
  await page.locator('[data-testid="header-login"]').click();
  await expect(page.locator('[data-testid="login-google"]')).toBeVisible();
  await signInViaEmulator(page);
  await expect(page.locator('[data-testid="login-google"]')).toBeHidden();
});

test('AUTH-6 — sign-out hides profile menu, restores "Sign in"', async ({ page }) => {
  await gotoFresh(page);
  await signInViaEmulator(page);
  await page.locator('[data-testid="profile-trigger"]').click();
  await page.locator('[data-testid="profile-logout"]').click();
  await expect(page.locator('[data-testid="profile-trigger"]')).toBeHidden();
  await expect(page.locator('[data-testid="header-login"]')).toBeVisible();
});

// ════════════════════════════════════════════════════════════════════════════
// §10 Import-on-login  (IOL-1..3)
// ════════════════════════════════════════════════════════════════════════════

test('IOL-1 — first sign-in with local diagrams offers AskToImportModal', async ({ page }) => {
  await gotoFresh(page);
  await typeDsl(page, 'A\nB\nA->B: local');
  await saveViaShortcut(page);
  // First signed-out save shows a one-time notice; dismiss it if present.
  await page.locator('[data-testid="confirm-cancel"]').click().catch(() => {});
  await signInViaEmulator(page);
  await expect(page.locator('[data-testid="import-confirm"]')).toBeVisible({ timeout: 15_000 });
});

test('IOL-2 — accepting import uploads locals to the cloud account', async ({ page }) => {
  const email = 'iol2@test.local';
  const uid = uidForEmail(email);
  await gotoFresh(page);
  await typeDsl(page, 'A\nB\nA->B: local');
  await saveViaShortcut(page);
  await page.locator('[data-testid="confirm-cancel"]').click().catch(() => {});
  await signInViaEmulator(page, { email });
  await page.locator('[data-testid="import-confirm"]').click();
  // Firestore side-effect: the local item is uploaded under this account.
  await expect.poll(async () => (await queryItemsByOwner(uid)).length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);
});

test('IOL-3 — declining keeps locals untouched, no cloud write', async ({ page }) => {
  const email = 'iol3@test.local';
  const uid = uidForEmail(email);
  await gotoFresh(page);
  await typeDsl(page, 'A\nB\nA->B: local');
  await saveViaShortcut(page);
  await page.locator('[data-testid="confirm-cancel"]').click().catch(() => {});
  await signInViaEmulator(page, { email });
  await page.locator('[data-testid="import-dismiss"]').click();
  // Give any (erroneous) upload a moment, then assert NO items were written.
  await page.waitForTimeout(1500);
  expect((await queryItemsByOwner(uid)).length).toBe(0);
});

test('IOL-4 — import batch over the free cap stays local and can be retried', async ({ page }, testInfo) => {
  const email = 'iol4-quota@test.local';
  const uid = uidForEmail(email);
  await setDoc(`users/${uid}`, { items: { ownedA: true, ownedB: true, ownedC: true } });
  await gotoFresh(page);
  await typeDsl(page, 'A\nB\nA->B: local quota item');
  await saveViaShortcut(page);
  await page.locator('[data-testid="confirm-cancel"]').click().catch(() => {});
  await signInViaEmulator(page, { email });
  await expect(page.locator('[data-testid="import-confirm"]')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1_500); // subscription read must resolve before the cap decision
  await page.locator('[data-testid="import-confirm"]').click();
  await expect(page.locator('[data-testid="import-error"]')).toContainText('exceed your account diagram limit');
  await page.screenshot({ path: testInfo.outputPath('IOL-4-blocked-import.png'), fullPage: true });

  const userDoc = await getDoc(`users/${uid}`);
  expect(Object.keys(userDoc.items).sort()).toEqual(['ownedA', 'ownedB', 'ownedC']);
  const localIndex = await page.evaluate(() => JSON.parse(localStorage.getItem('items') || '{}'));
  expect(Object.keys(localIndex).length).toBeGreaterThan(0);
  expect(await page.evaluate(() => localStorage.getItem('askedToImportCreations'))).toBeNull();
});

test('EXP-1 — PNG and SVG analytics fire only after successful browser downloads', async ({ page }) => {
  const tracked = [];
  await page.route('**/track*', async (route) => {
    const payload = route.request().postDataJSON();
    tracked.push(payload);
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  // Keep analytics local and observable: clear the debug short-circuit only for this
  // page, then intercept every /track request so nothing leaves the loopback app.
  await page.addInitScript(() => { document.cookie = 'wmdebug=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'; });
  await gotoFresh(page);
  await typeDsl(page, 'Alice->Bob: export validation');
  await expect(page.frameLocator('[data-testid="preview-iframe"]').locator('.participant').first()).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-testid="renderer-download"]').click();
  await expect(page.locator('[data-testid="export-download"]')).toBeEnabled({ timeout: 30_000 });

  // Force the browser handoff to fail once. The dialog should remain open and must
  // not emit the success event until a later download succeeds.
  await page.evaluate(() => {
    window.__restoreCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = () => { throw new Error('Browser download unavailable'); };
  });
  await page.locator('[data-testid="export-download"]').click();
  await expect(page.getByRole('alert')).toContainText('Browser download unavailable');
  expect(tracked.filter((event) => event.event === 'downloadPng')).toHaveLength(0);
  await page.evaluate(() => { URL.createObjectURL = window.__restoreCreateObjectURL; });

  let before = tracked.length;
  const pngDownload = page.waitForEvent('download');
  await page.locator('[data-testid="export-download"]').click();
  expect(await (await pngDownload).failure()).toBeNull();
  await expect.poll(() => tracked.slice(before).filter((event) => event.event === 'downloadPng'))
    .toEqual([expect.objectContaining({ category: 'ui' })]);

  await page.locator('[data-testid="renderer-download"]').click();
  await expect(page.locator('[data-testid="export-download"]')).toBeEnabled({ timeout: 30_000 });
  await page.getByRole('combobox', { name: 'Format' }).click();
  await page.getByRole('option', { name: 'SVG image' }).click();
  before = tracked.length;
  const svgDownload = page.waitForEvent('download');
  await page.locator('[data-testid="export-download"]').click();
  expect(await (await svgDownload).failure()).toBeNull();
  await expect.poll(() => tracked.slice(before).filter((event) => event.event === 'downloadSvg'))
    .toEqual([expect.objectContaining({ category: 'ui' })]);
  expect(tracked.some((event) => event.event === 'downloadSvg' && 'diagramCode' in event)).toBe(false);
});

// ════════════════════════════════════════════════════════════════════════════
// §5 Folders  (FLD-1, FLD-3, FLD-4, FLD-5)  — FLD-2 stays fixme (see cloud.fixme.spec.js)
// ════════════════════════════════════════════════════════════════════════════

test('FLD-1 — create folder "Work" appears with count 0', async ({ page }) => {
  await gotoFresh(page);
  await signInViaEmulator(page);
  await gotoHome(page);
  await page.locator('[data-testid="folder-new"]').click();
  await page.locator('[data-testid="folder-new-input"]').fill('Work');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Work', { exact: true })).toBeVisible();
});

test('FLD-3 — rename folder commits the new label', async ({ page }) => {
  const email = 'fld3@test.local';
  const uid = uidForEmail(email);
  // Seed a user doc with one folder so the rename UI has a target on first home load.
  await setDoc(`users/${uid}`, {
    folders: [{ id: 'folder-fld3', name: 'OldName', createdOn: Date.now(), updatedOn: Date.now() }],
  });
  await gotoFresh(page);
  await signInViaEmulator(page, { email });
  await gotoHome(page);
  const folderBtn = page.locator('[data-testid="folder-folder-fld3"]');
  await expect(folderBtn).toBeVisible({ timeout: 15_000 });
  await folderBtn.dblclick(); // double-click starts rename
  const renameInput = page.locator('[data-testid="folder-rename-folder-fld3"]');
  await expect(renameInput).toBeVisible();
  await renameInput.fill('NewName');
  await page.keyboard.press('Enter');
  await expect(page.getByText('NewName', { exact: true })).toBeVisible();
});

test('FLD-4 — delete folder returns its item to Unfiled', async ({ page }) => {
  const email = 'fld4@test.local';
  const uid = uidForEmail(email);
  await setDoc(`users/${uid}`, {
    items: { 'fld4-item': true },
    folders: [{ id: 'folder-fld4', name: 'Doomed', createdOn: Date.now(), updatedOn: Date.now() }],
  });
  await seedItem(uid, 'fld4-item', { title: 'Filed', folderId: 'folder-fld4' });
  await gotoFresh(page);
  await signInViaEmulator(page, { email });
  await gotoHome(page);
  const folderBtn = page.locator('[data-testid="folder-folder-fld4"]');
  await expect(folderBtn).toBeVisible({ timeout: 15_000 });
  // Delete via the row delete button → confirm dialog.
  await page.locator('[data-testid="folder-delete-folder-fld4"]').click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(folderBtn).toBeHidden();
  // The item's folderId is now an orphan → it counts under Unfiled. Assert the
  // Unfiled filter shows it.
  await page.locator('[data-testid="folder-unfiled"]').click();
  await expect(page.locator('[data-testid="home-card-fld4-item"]')).toBeVisible({ timeout: 15_000 });
});

test('FLD-5 — "All" vs "Unfiled" filters the grid', async ({ page }) => {
  const email = 'fld5@test.local';
  const uid = uidForEmail(email);
  await setDoc(`users/${uid}`, {
    items: { 'fld5-unfiled': true, 'fld5-filed': true },
    folders: [{ id: 'folder-fld5', name: 'Box', createdOn: Date.now(), updatedOn: Date.now() }],
  });
  await seedItem(uid, 'fld5-unfiled', { title: 'Loose', folderId: null });
  await seedItem(uid, 'fld5-filed', { title: 'Boxed', folderId: 'folder-fld5' });
  await gotoFresh(page);
  await signInViaEmulator(page, { email });
  await gotoHome(page);
  await page.locator('[data-testid="folder-all"]').click();
  await expect.poll(async () => page.locator('[data-testid^="home-card-"]').count(), {
    timeout: 15_000,
  }).toBe(2);
  await page.locator('[data-testid="folder-unfiled"]').click();
  await expect(page.locator('[data-testid="home-card-fld5-unfiled"]')).toBeVisible();
  await expect(page.locator('[data-testid="home-card-fld5-filed"]')).toBeHidden();
});

// ════════════════════════════════════════════════════════════════════════════
// §11 Sharing  (SHR-1..8)  — functions emulator round-trips create_share/get_shared_item
// ════════════════════════════════════════════════════════════════════════════

test('SHR-1 — Share while signed-out opens the sign-in modal first', async ({ page }) => {
  await gotoFresh(page);
  await page.locator('[data-testid="share-button"]').click();
  await expect(page.locator('[data-testid="login-google"]')).toBeVisible();
});

test('SHR-2 — create share link → URL carries ?id=&share-token=', async ({ page }) => {
  await gotoFresh(page);
  await signInViaEmulator(page);
  await typeDsl(page, 'A\nB\nA->B: share me');
  await saveViaShortcut(page);
  // Wait for the cloud save to settle (savestate leaves dirty/saving).
  await expect(page.locator('[data-testid="header-savestate"]')).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });
  await page.locator('[data-testid="share-button"]').click();
  await page.locator('[data-testid="share-create"]').click();
  const url = page.locator('[data-testid="share-url"]');
  await expect(url).toBeVisible({ timeout: 15_000 });
  await expect(url).toHaveValue(/[?&]id=.+&share-token=.+/);
});

test('SHR-3 — Copy copies the URL and shows "Copied ✓"', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await gotoFresh(page);
  await signInViaEmulator(page);
  await typeDsl(page, 'A\nB\nA->B: copy');
  await saveViaShortcut(page);
  await expect(page.locator('[data-testid="header-savestate"]')).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });
  await page.locator('[data-testid="share-button"]').click();
  await page.locator('[data-testid="share-create"]').click();
  await expect(page.locator('[data-testid="share-url"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid="share-copy"]').click();
  await expect(page.locator('[data-testid="share-copy"]')).toContainText('Copied');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toMatch(/[?&]id=.+&share-token=.+/);
});

test('SHR-4 — Stop-sharing revokes the token (re-visit fails)', async ({ page }) => {
  await gotoFresh(page);
  await signInViaEmulator(page);
  await typeDsl(page, 'A\nB\nA->B: revoke');
  await saveViaShortcut(page);
  await expect(page.locator('[data-testid="header-savestate"]')).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });
  await page.locator('[data-testid="share-button"]').click();
  await page.locator('[data-testid="share-create"]').click();
  const url = await page.locator('[data-testid="share-url"]').inputValue();
  const shareId = new URL(url).searchParams.get('id');
  await page.locator('[data-testid="share-stop"]').click();
  // stopSharing writes isShared:false to items/{id} asynchronously; wait for that
  // side-effect to LAND in Firestore before re-visiting, otherwise the read races the
  // revoke and get_shared_item still returns the item (the revoke is real, just async).
  await expect.poll(async () => {
    const doc = await getDoc(`items/${shareId}`);
    return doc?.isShared;
  }, { timeout: 15_000 }).toBe(false);
  // Now the URL is revoked: re-visiting yields the share-error notice (get_shared_item
  // rejects — isShared flipped false → useBootItem share-error).
  await page.goto(url);
  await expect(page.locator('[data-testid="share-error"]')).toBeVisible({ timeout: 15_000 });
});

test('SHR-5 — opening a share URL renders read-only', async ({ page }) => {
  // Seed a shared item directly, then visit its share URL. useBootItem → getSharedItem
  // (functions emulator) returns isReadOnly:true.
  const ownerUid = 'shr5-owner';
  const id = 'shr5-item';
  const token = 'shr5-token';
  await seedItem(ownerUid, id, { title: 'ReadMe', isShared: true, shareToken: token });
  await page.goto(`/?id=${id}&share-token=${token}`);
  await expect(editorLocator(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="header-savestate"]')).toHaveAttribute('data-state', 'readonly', { timeout: 15_000 });
});

test('SHR-6 — Fork a shared item → owned editable copy (leaves readonly)', async ({ page }) => {
  const ownerUid = 'shr6-owner';
  const id = 'shr6-item';
  const token = 'shr6-token';
  await seedItem(ownerUid, id, { title: 'ForkMe', isShared: true, shareToken: token });
  await gotoFresh(page);
  await signInViaEmulator(page);
  await page.goto(`/?id=${id}&share-token=${token}`);
  await expect(page.locator('[data-testid="header-savestate"]')).toHaveAttribute('data-state', 'readonly', { timeout: 15_000 });
  await page.locator('[data-testid="header-fork"]').click();
  await expect(page.locator('[data-testid="header-savestate"]')).not.toHaveAttribute('data-state', 'readonly', { timeout: 15_000 });
});

test('SHR-7 — bad share link → ShareErrorNotice with "Start fresh"', async ({ page }) => {
  await page.goto('/?id=does-not-exist&share-token=bad');
  await expect(page.locator('[data-testid="share-error"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="share-error-home"]')).toBeVisible();
});

test('SHR-8 — Share button disabled for read-only items', async ({ page }) => {
  const ownerUid = 'shr8-owner';
  const id = 'shr8-item';
  const token = 'shr8-token';
  await seedItem(ownerUid, id, { title: 'NoReshare', isShared: true, shareToken: token });
  await gotoFresh(page);
  await signInViaEmulator(page);
  await page.goto(`/?id=${id}&share-token=${token}`);
  await expect(editorLocator(page)).toBeVisible({ timeout: 15_000 });
  // Read-only diagrams do not offer a share control, so they cannot be re-shared.
  await expect(page.locator('[data-testid="share-button"]')).toHaveCount(0);
});

// ════════════════════════════════════════════════════════════════════════════
// §13 Subscription / pricing  (SUB-2/3/4/5)
// ════════════════════════════════════════════════════════════════════════════

test('SUB-2 — Upgrade (signed-in) opens Paddle checkout for the chosen plan', async ({ page }) => {
  // Install a window.Paddle stub BEFORE app boot so usePaddle.ensurePaddle() skips
  // the CDN inject and uses it (the "Paddle already present" path).
  await page.addInitScript(() => {
    window.__paddleCalls = [];
    window.Paddle = { Setup() {}, Checkout: { open: (opts) => window.__paddleCalls.push(opts) } };
  });
  await gotoFresh(page);
  await signInViaEmulator(page);
  // Open the pricing modal from the account menu and pick the monthly Plus upgrade.
  await page.locator('[data-testid="profile-trigger"]').click();
  await page.locator('[data-testid="profile-pricing"]').click();
  await page.locator('[data-testid="pricing-period-monthly"]').click().catch(() => {});
  await page.locator('[data-testid="pricing-upgrade-plus"]').click();
  await expect.poll(async () => page.evaluate(() => window.__paddleCalls.length), { timeout: 15_000 })
    .toBe(1);
  const passthrough = await page.evaluate(() => JSON.parse(window.__paddleCalls[0].passthrough));
  expect(passthrough.planType).toBe('plus-monthly');
});

// The retired logo menu held Pricing; signed-in users now find it in the account
// menu, which keeps the name/email, plan action and Sign out. Pricing only opens
// the plans dialog (no checkout).
test('SUB-6 — account menu lists Pricing with the plan action and Sign out; Pricing opens plans', async ({ page }) => {
  await page.addInitScript(() => {
    window.__paddleCalls = [];
    window.Paddle = { Setup() {}, Checkout: { open: (opts) => window.__paddleCalls.push(opts) } };
  });
  await gotoFresh(page);
  await signInViaEmulator(page);
  await expect(page.locator('[data-testid="header-login"]')).toHaveCount(0);
  await page.locator('[data-testid="profile-trigger"]').click();
  const items = page.getByRole('menuitem');
  await expect(items).toHaveText(['Pricing', 'Upgrade plan', 'Sign out']);
  await page.locator('[data-testid="profile-pricing"]').click();
  await expect(page.locator('[data-testid="pricing-modal"]')).toBeVisible();
  expect(await page.evaluate(() => window.__paddleCalls.length)).toBe(0);
});

test('SUB-3 — anonymous Upgrade → sign-in → resumes checkout', async ({ page }) => {
  await page.addInitScript(() => {
    window.__paddleCalls = [];
    window.Paddle = { Setup() {}, Checkout: { open: (o) => window.__paddleCalls.push(o) } };
  });
  await gotoFresh(page);
  // Signed out: Pricing is the small link inside the Sign in dialog.
  await page.locator('[data-testid="header-login"]').click();
  await page.locator('[data-testid="login-pricing"]').click();
  // Anonymous Upgrade stashes the plan and opens the login modal first.
  await page.locator('[data-testid="pricing-upgrade-plus"]').click();
  await expect(page.locator('[data-testid="login-google"]')).toBeVisible({ timeout: 15_000 });
  await signInViaEmulator(page);
  // After auth resolves the captured checkout resumes.
  await expect.poll(async () => page.evaluate(() => window.__paddleCalls.length), { timeout: 15_000 })
    .toBe(1);
});

test('SUB-4 — free user over the cap → limit notice + cloud write withheld', async ({ page }) => {
  const email = 'sub4@test.local';
  const uid = uidForEmail(email);
  // Seed the user already AT the cap (4 owned ids → ownedIds.length 4 > free limit 3),
  // so the NEXT save is withheld and the limit notice fires.
  await setDoc(`users/${uid}`, { items: { a: true, b: true, c: true, d: true } });
  await gotoFresh(page);
  await signInViaEmulator(page, { email });
  await typeDsl(page, 'A\nB\nA->B: fifth');
  // save() enforces the cap only once the subscription read has resolved (its race
  // guard fails open while loading). ⌘S fires sooner than the old two menu clicks
  // did, so give the post-sign-in subscription read time to finish first.
  await page.waitForTimeout(2_000);
  await saveViaShortcut(page);
  await expect(page.locator('[data-testid="limit-notice"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="limit-upgrade"]')).toBeVisible();
  // Firestore side-effect: still exactly 4 owned ids — the new item's cloud write was
  // withheld (kept local only).
  const userDoc = await getDoc(`users/${uid}`);
  expect(Object.keys(userDoc.items)).toHaveLength(4);
});

test('SUB-5 — paid user sees the plan row in the profile menu', async ({ page }) => {
  const email = 'sub5@test.local';
  const uid = uidForEmail(email);
  // Seed an ACTIVE plus subscription so the resolved plan is plus.
  await setDoc(`users/${uid}`, { items: {} });
  await setDoc(`user_subscriptions/user-${uid}`, {
    status: 'active',
    passthrough: JSON.stringify({ userId: uid, planType: 'plus-monthly' }),
  });
  await gotoFresh(page);
  await signInViaEmulator(page, { email });
  await page.locator('[data-testid="profile-trigger"]').click();
  // Subscribed → profile-plan (My Plan) is shown instead of profile-upgrade.
  await expect(page.locator('[data-testid="profile-plan"]')).toBeVisible({ timeout: 15_000 });
});

// ════════════════════════════════════════════════════════════════════════════
// §8 Persistence / autosave  (PST-2/3/4)
// ════════════════════════════════════════════════════════════════════════════

test('PST-2 — save indicator transitions dirty → saved (signed-in)', async ({ page }) => {
  await gotoFresh(page);
  await signInViaEmulator(page);
  await typeDsl(page, 'A\nB\nA->B: dirty');
  await expect(page.locator('[data-testid="header-savestate"]')).toHaveAttribute('data-state', 'dirty', { timeout: 15_000 });
  await saveViaShortcut(page);
  await expect(page.locator('[data-testid="header-savestate"]')).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });
});

test('PST-3 — read-only (shared) item: savestate readonly, Fork offered', async ({ page }) => {
  const ownerUid = 'pst3-owner';
  const id = 'pst3-item';
  const token = 'pst3-token';
  await seedItem(ownerUid, id, { title: 'RO', isShared: true, shareToken: token });
  // Suppress the one-time onboarding/pledge modals BEFORE boot — their Radix overlay
  // otherwise intercepts the header-fork check on this bare (non-gotoFresh) goto.
  await suppressOneTimeModals(page);
  await page.goto(`/?id=${id}&share-token=${token}`);
  await expect(editorLocator(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="header-savestate"]')).toHaveAttribute('data-state', 'readonly', { timeout: 15_000 });
  // Fork (header-fork) is the offered escape from read-only. NOTE: header-save
  // (in the app menu) is NOT a disabled control — save() is a no-op for read-only items
  // (AppRoot save(): `if (it.isReadOnly) return`), so we assert Fork is present rather
  // than asserting a disabled Save that the component never renders.
  await expect(page.locator('[data-testid="header-fork"]')).toBeVisible();
});

test('PST-4 — read-only item is NOT written to the last-code slot', async ({ page }) => {
  const ownerUid = 'pst4-owner';
  const id = 'pst4-item';
  const token = 'pst4-token';
  await seedItem(ownerUid, id, { title: 'NoLastCode', js: 'ZZZ_SHARED_ONLY->QQQ: marker', isShared: true, shareToken: token });
  await page.goto(`/?id=${id}&share-token=${token}`);
  await expect(editorLocator(page)).toBeVisible({ timeout: 15_000 });
  await expect(editorLocator(page)).toContainText('ZZZ_SHARED_ONLY', { timeout: 15_000 });
  // Reload bare '/' — editor-as-landing resumes last-code; the read-only shared item
  // must NOT have become the last-code (AppRoot: `if (current && !current.isReadOnly)
  // saveLastCode(current)`).
  await page.goto('/');
  await expect(editorLocator(page)).toBeVisible({ timeout: 15_000 });
  await expect(editorLocator(page)).not.toContainText('ZZZ_SHARED_ONLY');
});

// ════════════════════════════════════════════════════════════════════════════
// §14 Header / title / actions  (HDR-4/6)
// ════════════════════════════════════════════════════════════════════════════

test('HDR-4 — Fork duplicates a shared item into an owned editable copy', async ({ page }) => {
  const ownerUid = 'hdr4-owner';
  const id = 'hdr4-item';
  const token = 'hdr4-token';
  await seedItem(ownerUid, id, { title: 'ForkHdr', isShared: true, shareToken: token });
  await gotoFresh(page);
  await signInViaEmulator(page);
  await page.goto(`/?id=${id}&share-token=${token}`);
  await expect(page.locator('[data-testid="header-savestate"]')).toHaveAttribute('data-state', 'readonly', { timeout: 15_000 });
  await page.locator('[data-testid="header-fork"]').click();
  await expect(page.locator('[data-testid="header-savestate"]')).not.toHaveAttribute('data-state', 'readonly', { timeout: 15_000 });
});

test('HDR-6 — signed-out shows "Sign in"; signed-in shows profile menu', async ({ page }) => {
  await gotoFresh(page);
  await expect(page.locator('[data-testid="header-login"]')).toBeVisible();
  await expect(page.locator('[data-testid="profile-trigger"]')).toBeHidden();
  await signInViaEmulator(page);
  await expect(page.locator('[data-testid="profile-trigger"]')).toBeVisible();
  await expect(page.locator('[data-testid="header-login"]')).toBeHidden();
});

// ════════════════════════════════════════════════════════════════════════════
// §16 Embed (by-reference)  (EMB-1)
// ════════════════════════════════════════════════════════════════════════════

test('EMB-1 — embed by-reference renders the shared diagram', async ({ page }) => {
  const ownerUid = 'emb1-owner';
  const id = 'emb1-item';
  const token = 'emb1-token';
  await seedItem(ownerUid, id, { title: 'Embedded', isShared: true, shareToken: token });
  await page.goto(`/?embed&id=${id}&share-token=${token}`);
  await expect(page.locator('[data-testid="embed-root"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="embed-open-link"]')).toBeVisible();
});

// ════════════════════════════════════════════════════════════════════════════
// §20 Connectivity  (NET-2)  — offline → reconnect sync
// ════════════════════════════════════════════════════════════════════════════

test('NET-2 — reconnect resumes cloud sync without data loss', async ({ page, context }) => {
  const email = 'net2@test.local';
  const uid = uidForEmail(email);
  await gotoFresh(page);
  await signInViaEmulator(page, { email });
  await typeDsl(page, 'A\nB\nA->B: offline edit marker');
  // Capture the item id the editor is on so we can probe its cloud doc post-reconnect.
  await context.setOffline(true);
  await saveViaShortcut(page);
  await context.setOffline(false);
  // After reconnect, Firestore's persistence queue flushes the write. Probe the
  // emulator: the item owned by this uid carries the offline edit.
  await expect.poll(async () => {
    const items = await queryItemsByOwner(uid);
    return items.some((i) => typeof i.js === 'string' && i.js.includes('offline edit marker'));
  }, { timeout: 30_000 }).toBe(true);
});

// ════════════════════════════════════════════════════════════════════════════
// §7 Settings  (SET-7)  — settings persist to cloud
// ════════════════════════════════════════════════════════════════════════════

test('SET-7 — signed-in settings persist to cloud (Firestore probe)', async ({ page }) => {
  const email = 'set7@test.local';
  const uid = uidForEmail(email);
  await gotoFresh(page);
  await signInViaEmulator(page, { email });
  // Toggle a boolean setting (autoSave) in the Settings modal; it writes
  // users/{uid}.settings.autoSave to Firestore for signed-in users.
  test.skip(true, 'Settings has no trigger in this checkout: the logo menu entry was removed and the Code appearance control (separate task) has not landed yet');
  const toggle = page.locator('[data-testid="setting-autoSave"]');
  await expect(toggle).toBeVisible({ timeout: 15_000 });
  // Read the current value, flip it, and assert the cloud doc reflects the new value.
  const before = await getDoc(`users/${uid}`);
  const beforeAutoSave = before?.settings?.autoSave;
  await toggle.click();
  await expect.poll(async () => {
    const doc = await getDoc(`users/${uid}`);
    return doc?.settings?.autoSave;
  }, { timeout: 15_000 }).not.toBe(beforeAutoSave);
});

// ════════════════════════════════════════════════════════════════════════════
// §1 CSS gate  (CSS-5)  — non-plain CSS mode gated behind Plus for free users
// ════════════════════════════════════════════════════════════════════════════

test('CSS-5 — non-plain CSS mode gated behind Plus for free users', async ({ page }) => {
  await gotoFresh(page);
  await signInViaEmulator(page, { email: 'css5@test.local' });
  // Expand the CSS pane to reach the pre-processor mode Select (a Radix Select, NOT
  // a native <select> — drive it by clicking the trigger then the option, the same
  // pattern css-editor.spec.js CSS-2 uses).
  await page.locator('[data-testid="css-panel-strip"]').click();
  const modeSelect = page.locator('[data-testid="css-mode-select"]');
  await expect(modeSelect).toBeVisible({ timeout: 15_000 });
  await modeSelect.click();
  await page.getByRole('option', { name: 'SCSS', exact: true }).click();
  // Free signed-in user → cssGated() opens the pricing modal. (The subscription read
  // resolves to free since no user_subscriptions doc was seeded; the gate's race guard
  // only skips while loading, so a brief poll covers the resolve.)
  await expect(page.locator('[data-testid="pricing-modal"]')).toBeVisible({ timeout: 15_000 });
});

// ════════════════════════════════════════════════════════════════════════════
// §1b Custom CSS — authorized (Plus) user and free-user buffer gate
// ════════════════════════════════════════════════════════════════════════════

/** Seed an active Plus subscription for `email` and sign in as that user. */
async function signInPlus(page, email) {
  const uid = uidForEmail(email);
  await setDoc(`users/${uid}`, { items: {} });
  await setDoc(`user_subscriptions/user-${uid}`, {
    status: 'active',
    passthrough: JSON.stringify({ userId: uid, planType: 'plus-monthly' }),
  });
  await gotoFresh(page);
  await signInViaEmulator(page, { email });
  // The CSS gate does not gate while the subscription is loading; wait until the
  // plan resolves (profile menu shows My Plan) so the test exercises the Plus path.
  await page.locator('[data-testid="profile-trigger"]').click();
  await expect(page.locator('[data-testid="profile-plan"]')).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('Escape');
  return uid;
}

const cssEditor = (page) => page.locator('[data-testid="css-editor"] .cm-content');
const zenumlStyle = (page) =>
  page.frameLocator('[data-testid="preview-iframe"]').locator('#zenumlstyle').textContent();
const participantColor = (page) =>
  page
    .frameLocator('[data-testid="preview-iframe"]')
    .locator('.participant')
    .first()
    .evaluate((el) => getComputedStyle(el).color);

test('CSS-P1 — Plus user: CSS reaches the preview, survives collapse, saves and reloads', async ({ page }) => {
  const uid = await signInPlus(page, 'cssp1@test.local');
  await typeDsl(page, 'Alice->Bob: hi');
  await page.locator('[data-testid="css-panel-strip"]').click();
  await cssEditor(page).click();
  const rule = '.zenuml .participant { color: rgb(200, 0, 0); }';
  await page.keyboard.insertText(rule);

  // No gate for Plus: no sign-in or pricing dialog, buffer holds the rule.
  await expect(page.locator('[data-testid="pricing-modal"]')).toHaveCount(0);
  await expect(cssEditor(page)).toHaveText(rule);
  // Reaches the HTML preview: in the style rail AND applied to rendered participants.
  await expect.poll(() => zenumlStyle(page)).toContain(rule);
  await expect.poll(() => participantColor(page)).toBe('rgb(200, 0, 0)');

  // Collapse then reopen keeps the content (the editor remounts from the store).
  await page.locator('[data-testid="css-panel-collapse"]').click();
  await expect(page.locator('[data-testid="css-panel-strip"]')).toBeVisible();
  await expect.poll(() => participantColor(page)).toBe('rgb(200, 0, 0)');
  await page.locator('[data-testid="css-panel-strip"]').click();
  await expect(cssEditor(page)).toHaveText(rule);

  // Save → the cloud item carries the CSS; reload → buffer + preview restored.
  await saveViaShortcut(page);
  await expect(page.locator('[data-testid="header-savestate"]')).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });
  await expect
    .poll(async () => (await queryItemsByOwner(uid)).map((i) => i.css))
    .toContain(rule);
  await page.reload();
  await expect(page.locator('[data-testid="profile-trigger"]')).toBeVisible({ timeout: 15_000 });
  // Non-empty CSS → the panel opens expanded by default.
  await expect(page.locator('[data-testid="css-panel-expanded"]')).toBeVisible({ timeout: 15_000 });
  await expect(cssEditor(page)).toHaveText(rule);
  await expect.poll(() => participantColor(page)).toBe('rgb(200, 0, 0)');
});

test('CSS-P2 — Plus user: SCSS compiles into the preview; a syntax error is shown, then clears', async ({ page }) => {
  await signInPlus(page, 'cssp2@test.local');
  await typeDsl(page, 'Alice->Bob: hi');
  await page.locator('[data-testid="css-panel-strip"]').click();
  await page.locator('[data-testid="css-mode-select"]').click();
  await page.getByRole('option', { name: 'SCSS', exact: true }).click();
  await expect(page.locator('[data-testid="pricing-modal"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="css-mode-select"]')).toContainText('SCSS');

  await cssEditor(page).click();
  await page.keyboard.insertText('$c: rgb(0, 0, 200);\n.zenuml { .participant { color: $c; } }');
  // Compiled (nested selector flattened, variable resolved) and applied.
  await expect.poll(() => zenumlStyle(page)).toContain('.zenuml .participant');
  await expect.poll(() => participantColor(page)).toBe('rgb(0, 0, 200)');

  // Break the SCSS: a lint error marker appears in the CSS editor with a message.
  await page.keyboard.insertText('\n.broken { color: ');
  const marker = page.locator('[data-testid="css-editor"] .cm-lint-marker-error').first();
  await expect(marker).toBeVisible({ timeout: 15_000 });
  await marker.hover();
  await expect(page.locator('.cm-tooltip-lint').first()).not.toHaveText('');
  // Fix it: the marker clears and the preview applies the compiled CSS again.
  await page.keyboard.insertText('red; }');
  await expect(page.locator('[data-testid="css-editor"] .cm-lint-marker-error')).toHaveCount(0, { timeout: 15_000 });
  await expect.poll(() => zenumlStyle(page)).toContain('.broken');
  await expect.poll(() => participantColor(page)).toBe('rgb(0, 0, 200)');
});

test('CSS-P3 — free signed-in user: typing CSS opens pricing and leaves the buffer empty', async ({ page }) => {
  await gotoFresh(page);
  await signInViaEmulator(page, { email: 'cssp3@test.local' });
  // Wait for the plan to resolve to free (profile-upgrade row) so the gate is active.
  await page.locator('[data-testid="profile-trigger"]').click();
  await expect(page.locator('[data-testid="profile-upgrade"]')).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('Escape');
  await page.locator('[data-testid="css-panel-strip"]').click();
  await cssEditor(page).click();
  await page.keyboard.type('.x{}');
  await expect(page.locator('[data-testid="pricing-modal"]')).toBeVisible({ timeout: 15_000 });
  await expect(cssEditor(page)).toHaveText('');
  await expect.poll(() => zenumlStyle(page)).toBe('');
});
