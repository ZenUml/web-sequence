// Cloud (emulator-backed) E2E helpers. These compose the page-driving shape of the
// signed-out specs (openEditor/gotoHome/typeDsl) with the deterministic emulator
// sign-in + Firestore seed/probe seams. They run ONLY under the `cloud` Playwright
// project, whose webServer boots the dev server with VITE_USE_EMULATOR=1 (so
// firebase.ts wires the Auth/Firestore emulators and exposes window.__e2eSignIn).
//
// Sign-in model (see web/src/services/firebase.ts): under the emulator, login() and
// window.__e2eSignIn() both call signInWithCustomToken with an UNSIGNED custom token
// minted for a deterministic uid. The Auth emulator does not verify the signature,
// so no firebase-admin / service-account key is needed in the browser. The uid is
// derived from the email (or passed explicitly) so seeded Firestore docs
// (users/{uid}, items.createdBy, user_subscriptions/user-{uid}) line up with the
// signed-in session.

import { expect } from '@playwright/test';
import { suppressOneTimeModals } from './onetime';
import { openEditor, gotoHome } from './hub';
export { gotoHome };

const selectAll = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';

/** Editor CM6 content surface. */
export function editorLocator(page) {
  return page.locator('[data-testid="dsl-editor"] .cm-content');
}

// Mirror of firebase.ts uidFor(): keep the test's notion of a uid identical to the
// app's so seeded docs and the signed-in session agree.
export function uidForEmail(email) {
  return 'e2e-' + email.replace(/[^a-z0-9]/gi, '-').toLowerCase();
}

/**
 * Sign a deterministic user into the emulator via the dev-only window.__e2eSignIn
 * hook (wraps signInWithCustomToken). Resolves once ProfileMenu mounts — its trigger
 * only renders after onAuthStateChanged fires the signed-in user.
 *
 * Returns the resolved uid so callers can seed/probe Firestore for that account.
 */
export async function signInViaEmulator(page, { uid, email = 'e2e@test.local' } = {}) {
  await expect
    .poll(async () => page.evaluate(() => typeof window.__e2eSignIn === 'function'), {
      timeout: 15_000,
    })
    .toBe(true);
  await page.evaluate(
    async ({ uid, email }) => { await window.__e2eSignIn({ uid, email }); },
    { uid, email },
  );
  await expect(page.locator('[data-testid="profile-trigger"]')).toBeVisible({
    timeout: 15_000,
  });
  return uid ?? uidForEmail(email);
}

/** Boot the editor with a clean slate + one-time modals suppressed. */
export async function gotoFresh(page) {
  await suppressOneTimeModals(page);
  await openEditor(page);
  await page.evaluate(() => localStorage.clear());
}

/** Type a replacement DSL into the editor (select-all → Delete → type). */
export async function typeDsl(page, dsl) {
  const editor = editorLocator(page);
  await expect(editor).toBeVisible({ timeout: 15_000 });
  await editor.click();
  await page.keyboard.press(selectAll);
  await page.keyboard.press('Delete');
  await editor.pressSequentially(dsl);
}

/** Open the app menu and click Save; the menu lives behind header-menu. */
export async function saveViaMenu(page) {
  await page.locator('[data-testid="header-menu"]').click();
  await page.locator('[data-testid="header-save"]').click();
}
