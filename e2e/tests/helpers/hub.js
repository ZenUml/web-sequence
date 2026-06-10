// Shared E2E helpers for the Hub UI (PRs #800/#801; f023f89 "no-rail layout").
//
// Since the hub landed, bare '/' no longer boots the editor: it renders the
// HomeView library page (data-testid="home-view"), and the editor is reached by
// clicking "New diagram" (home-empty-new — empty-library CTA) or the header New
// button (home-new). The Sidebar icon rail was removed app-wide (f023f89), so
// nothing navigates via sidebar-* anymore. Editor URLs (/?id= or ?code=/?embed)
// still render their surface directly without passing through the hub.
//
// Every spec that needs the editor goes through openEditor(); specs that need
// the library grid go through gotoHome(). Keeping the click-through in ONE place
// means the next hub-routing change is a one-file fix.

import { expect } from '@playwright/test';

const HOME_VIEW = '[data-testid="home-view"]';
const EDITOR_SURFACE = '[data-testid="dsl-editor"] .cm-content';

/**
 * Navigate to `url` (default '/') and end up in the editor.
 *
 * - If the URL renders the HomeView hub, click through its New CTA
 *   (home-empty-new when the library is empty, else home-new).
 * - If the URL renders the editor directly (e.g. '/?id=…' or '/?code=…'),
 *   just wait for the editor surface.
 *
 * React renders after the 'load' event page.goto resolves on, so we first wait
 * for WHICHEVER surface this URL produces (home-view or the CM6 editor) before
 * deciding — a bare isVisible() right after goto races the first render.
 */
export async function openEditor(page, { url = '/' } = {}) {
  await page.goto(url);
  const homeView = page.locator(HOME_VIEW);
  const editorSurface = page.locator(EDITOR_SURFACE);
  await expect(homeView.or(editorSurface).first()).toBeVisible({ timeout: 15_000 });
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
 * Navigate to the HomeView library page ('/').
 *
 * A FULL navigation (not client-side breadcrumb) so the signed-out useItems
 * mount re-reads the localItems index from a clean slate — robust regardless of
 * whether the in-page subscription has caught up.
 */
export async function gotoHome(page) {
  await page.goto('/');
  await expect(page.locator(HOME_VIEW)).toBeVisible({ timeout: 15_000 });
}
