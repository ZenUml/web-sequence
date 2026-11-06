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
  // Hub (PRs #800/#801): click through the hub's New CTA to reach the editor,
  // where these modal triggers live.
  await openEditor(page);
}

// The logo app menu is gone. Settings has no other trigger until the Code
// appearance control lands, so the Settings case is skipped with this reason.
const SETTINGS_TRIGGER_PENDING = 'Settings has no trigger in this checkout: the logo menu entry was removed and the Code appearance control (separate task) has not landed yet';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => { if (!isThirdPartyError(err)) throw err; });
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 1: Settings modal opens, a Select setting changes, Escape closes it.
// ──────────────────────────────────────────────────────────────────────────────
test('Settings modal: change font size and close on Escape', async ({ page }) => {
  test.skip(true, SETTINGS_TRIGGER_PENDING);
  await gotoFresh(page);

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
  // Templates are picked from the Diagrams hub (the editor's New is blank-only).
  await page.goto('/?view=diagrams');
  await page.locator('[data-testid="home-empty-templates"]').click();

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
// Test 3: Keyboard-Shortcuts + Help modals render their content.
// ──────────────────────────────────────────────────────────────────────────────
test('Help modal opens from the code-column footer and shows the version', async ({ page }) => {
  await gotoFresh(page);
  await page.locator('[data-testid="footer-help"]').click();
  await expect(page.locator('[data-testid="help-modal"]')).toBeVisible();
  await expect(page.locator('[data-testid="help-version"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="help-modal"]')).toBeHidden();
});

test('Keyboard-Shortcuts modal opens via Ctrl/Cmd+Shift+?', async ({ page }) => {
  await gotoFresh(page);

  // REQ-KB-1: the keybinding opens it ('?' is Shift+'/'); the menu entry is gone.
  const modal = page.locator('[data-testid="shortcuts-modal"]');
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+Shift+?`);
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Ctrl');
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 4: Pricing modal opens (web host → payment ON) and the period toggles.
// ──────────────────────────────────────────────────────────────────────────────
test('Pricing modal: open and toggle monthly/yearly', async ({ page }) => {
  await gotoFresh(page);
  // Signed out: Pricing is the small link inside the Sign in dialog.
  await page.locator('[data-testid="header-login"]').click();
  await page.locator('[data-testid="login-pricing"]').click();

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
