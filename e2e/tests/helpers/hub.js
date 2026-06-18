// Shared E2E helpers for the Hub UI.
//
// Editor-as-landing (2026-06-13): bare '/' boots the EDITOR again (resume
// last-code, else seed a sample diagram), so '/' renders data-testid="dsl-editor"
// directly. The HomeView library page (data-testid="home-view") is now OPT-IN via
// '/?view=diagrams'. The Sidebar icon rail was removed app-wide (f023f89), so
// nothing navigates via sidebar-* anymore. Editor deep links (/?id= or ?code=/
// ?embed) still render their surface directly.
//
// Every spec that needs the editor goes through openEditor(); specs that need
// the library grid go through gotoHome() — which navigates to '/?view=diagrams'.
// Keeping the routing in ONE place means the next routing change is a one-file fix.

import { expect } from '@playwright/test';

const HOME_VIEW = '[data-testid="home-view"]';
const EDITOR_SURFACE = '[data-testid="dsl-editor"] .cm-content';

// The hub/library is opt-in via this query param under editor-as-landing.
export const HUB_URL = '/?view=diagrams';

/**
 * Navigate to `url` (default '/') and end up in the editor.
 *
 * - If the URL renders the editor directly (the default for bare '/', and for
 *   '/?id=…' or '/?code=…'), just wait for the editor surface.
 * - If the URL renders the HomeView hub ('/?view=diagrams'), click through its
 *   New CTA (home-empty-new when the library is empty, else home-new).
 *
 * React renders after the 'load' event page.goto resolves on, so we first wait
 * for WHICHEVER surface this URL produces (home-view or the CM6 editor) before
 * deciding — a bare isVisible() right after goto races the first render.
 */
export async function openEditor(page, { url = '/' } = {}) {
  await page.goto(url);
  const homeView = page.locator(HOME_VIEW);
  const editorSurface = page.locator(EDITOR_SURFACE);
  await expect(homeView.or(editorSurface).first()).toBeVisible({
    timeout: 15_000,
  });
  if (await homeView.isVisible()) {
    const emptyCta = page.locator('[data-testid="home-empty-new"]');
    if (await emptyCta.isVisible()) {
      await emptyCta.click();
    } else {
      await page.locator('[data-testid="home-new"]').click();
    }
  }
  await expect(editorSurface).toBeVisible({ timeout: 15_000 });
}

/**
 * Navigate to the HomeView library page ('/?view=diagrams').
 *
 * Editor-as-landing: the hub is opt-in via ?view=diagrams; bare '/' now boots
 * the editor, so the library is reached only by this param. A FULL navigation
 * (not a client-side breadcrumb) so the signed-out useItems mount re-reads the
 * localItems index from a clean slate — robust regardless of whether the in-page
 * subscription has caught up.
 */
export async function gotoHome(page) {
  await page.goto(HUB_URL);
  await expect(page.locator(HOME_VIEW)).toBeVisible({ timeout: 15_000 });
}
