// M04 Task 17 — Modal inventory + settings + pricing E2E (signed-out / local).
//
// What this covers WITHOUT the Firebase emulator:
//   1. Settings modal: open via the header overflow menu, change a Select setting
//      (font size), assert it persists in the control, close on Escape.
//   2. Create-New modal: pick a curated template → the editor loads its DSL.
//   3. Cheat-Sheet + Keyboard-Shortcuts + Help modals: open + assert content.
//   4. Pricing modal (web host → payment flag ON): open + toggle monthly/yearly.
//
// DEFERRED to the staging gate (need Firebase auth/emulator): Paddle checkout,
// subscription load, and the cloud plan-limit. Same auth note as library/persistence
// specs. The webServer (playwright.config.js) already boots `pnpm -C web dev`.

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor } from './helpers/hub';

const THIRD_PARTY_ERROR_SOURCES = [
  'userscript.js', 'gtm.js', 'googletagmanager', 'google-analytics',
  'analytics.js', 'clarity.js', 'clarity.ms', 'paddle.js', 'cdn.paddle.com',
  'zaraz', 'cloudflareinsights',
];
function isThirdPartyError(err) {
  const haystack = `${err?.message || ''}\n${err?.stack || ''}`;
  return THIRD_PARTY_ERROR_SOURCES.some((src) => haystack.includes(src));
}

async function gotoFresh(page) {
  // Seed the one-time-modal flags via an init script (before any goto) so
  // Onboarding/Support-pledge don't intercept the header clicks these tests drive.
  await suppressOneTimeModals(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  // Hub (PRs #800/#801): '/' renders the HomeView library; all the modal triggers
  // these tests drive live in the EDITOR's header menu — click through the hub's
  // New CTA to reach it.
  await openEditor(page);
}

/** Open an item in the header overflow menu by its trigger testid. */
async function openViaHeaderMenu(page, triggerTestId) {
  await page.locator('[data-testid="header-menu"]').click();
  await page.locator(`[data-testid="${triggerTestId}"]`).click();
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => { if (!isThirdPartyError(err)) throw err; });
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 1: Settings modal opens, a Select setting changes, Escape closes it.
// ──────────────────────────────────────────────────────────────────────────────
test('Settings modal: change font size and close on Escape', async ({ page }) => {
  await gotoFresh(page);
  await openViaHeaderMenu(page, 'header-settings');

  const modal = page.locator('[data-testid="settings-modal"]');
  await expect(modal).toBeVisible();

  // Change the font-size Select: open the trigger, pick 12.
  await page.locator('[data-testid="setting-fontSize"]').click();
  await page.getByRole('option', { name: '12', exact: true }).click();
  // The trigger now reflects the chosen value.
  await expect(page.locator('[data-testid="setting-fontSize"]')).toContainText('12');

  // Escape closes the modal.
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 2: Create-New modal → pick a template → the editor loads its DSL.
// ──────────────────────────────────────────────────────────────────────────────
test('Create-New modal: selecting a template loads its DSL into the editor', async ({ page }) => {
  await gotoFresh(page);
  await openViaHeaderMenu(page, 'header-create-new');

  const modal = page.locator('[data-testid="create-new-modal"]');
  await expect(modal).toBeVisible();

  // Pick the "basic" template (ported verbatim from legacy template-basic.json).
  await page.locator('[data-testid="create-template-basic"]').click();
  await expect(modal).toBeHidden();

  // The editor now shows the template's DSL (non-empty). The basic template's js is
  // a sequence diagram — assert the editor is non-empty after load.
  const editor = page.locator('[data-testid="dsl-editor"] .cm-content');
  await expect(editor).toBeVisible();
  await expect(editor).not.toHaveText('');
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 3: Cheat-Sheet + Keyboard-Shortcuts + Help modals render their content.
// ──────────────────────────────────────────────────────────────────────────────
test('Help modal opens from the header menu and shows the version', async ({ page }) => {
  await gotoFresh(page);
  await openViaHeaderMenu(page, 'header-help');
  await expect(page.locator('[data-testid="help-modal"]')).toBeVisible();
  await expect(page.locator('[data-testid="help-version"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="help-modal"]')).toBeHidden();
});

test('Cheat-Sheet modal opens from the header menu and shows DSL examples', async ({ page }) => {
  await gotoFresh(page);
  await openViaHeaderMenu(page, 'header-cheatsheet');
  const modal = page.locator('[data-testid="cheatsheet-modal"]');
  await expect(modal).toBeVisible();
  // The cheat sheet shows the async-message DSL example.
  await expect(modal).toContainText('->');
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
});

test('Keyboard-Shortcuts modal opens via the header menu AND via Ctrl/Cmd+Shift+?', async ({ page }) => {
  await gotoFresh(page);

  // Via the header overflow menu.
  await openViaHeaderMenu(page, 'header-shortcuts');
  const modal = page.locator('[data-testid="shortcuts-modal"]');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Ctrl');
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();

  // REQ-KB-1: the keybinding itself opens it. '?' is Shift+'/'.
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+Shift+?`);
  await expect(modal).toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 4: Pricing modal opens (web host → payment ON) and the period toggles.
// ──────────────────────────────────────────────────────────────────────────────
test('Pricing modal: open and toggle monthly/yearly', async ({ page }) => {
  await gotoFresh(page);
  await openViaHeaderMenu(page, 'header-pricing');

  const modal = page.locator('[data-testid="pricing-modal"]');
  await expect(modal).toBeVisible();

  // Toggle to yearly, then back to monthly — both controls exist and respond.
  await page.locator('[data-testid="pricing-period-yearly"]').click();
  await page.locator('[data-testid="pricing-period-monthly"]').click();

  // The Plus upgrade affordance is present (the recommended tier).
  await expect(page.locator('[data-testid="pricing-upgrade-plus"]')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
});
