// Residual infra-gated case(s) that the emulator alone does NOT unlock. The bulk of
// the AUTH / CLOUD / PADDLE gap buckets are now LIVE emulator-backed tests in
// e2e/tests/cloud.spec.js (run via the `cloud` Playwright project). What remains here
// is blocked by a MISSING PRODUCT AFFORDANCE, not by missing infrastructure — flipping
// it to a real test would require a UI that does not exist, so it stays test.fixme
// with the exact blocker documented (never faked).

import { test, expect } from '@playwright/test';
import { signInViaEmulator, gotoFresh, gotoHome } from './helpers/cloud';

// ════════════════════════════════════════════════════════════════════════════
// §5 Folders — FLD-2
// ════════════════════════════════════════════════════════════════════════════
//
// BLOCKER (UI gap, NOT emulator): "move a diagram into a folder" has no affordance
// in the editor-as-landing hub. The hub's HomeView renders diagrams as `DiagramCard`
// (web/src/components/home/DiagramCard.tsx) whose ONLY testid is `home-card-{id}` —
// it exposes Open / Delete / Fork / Export, but NO "Move to folder" menu. The only
// move-to-folder UI in the codebase is `lib-move-{itemId}-{folderId}` in
// web/src/components/library/LibraryItemRow.tsx (the LibraryPanel LIST view), which
// the editor-as-landing hub does not mount. So there is no clickable path from a
// HomeView card to a folder, and the per-card kebab move-menu the original sketch
// assumed does not exist.
//
// To un-fixme: add a "Move to folder" action to DiagramCard (wiring HomeView's
// existing `onMoveItem` prop, which is declared but currently unused — see
// HomeView.tsx:58 `onMoveItem?(...)`) with a `home-card-move-{id}-{folderId}` testid,
// then drive: seed item + folder → open the card menu → click the folder target →
// assert the Work count increments to 1 and folder-unfiled decrements. The Firestore
// side-effect (item.folderId updated) is probeable today via e2e/cloud/firestoreEmu.mjs;
// only the click target is missing.
test.fixme(
  'FLD-2 — needs: DiagramCard "Move to folder" affordance (UI gap, not emulator) — move a diagram into a folder; counts update; Unfiled decrements',
  async ({ page }) => {
    await gotoFresh(page);
    await signInViaEmulator(page);
    await gotoHome(page);
    // No move-to-folder control exists on the HomeView card today; this body is the
    // shape it should take once DiagramCard gains the affordance.
    await expect(page.locator('[data-testid^="home-card-"]').first()).toBeVisible();
    // await page.locator('[data-testid="home-card-<id>-menu"]').click();
    // await page.locator('[data-testid="home-card-move-<id>-<folderId>"]').click();
    // → assert folder count 1, Unfiled count decremented.
  },
);
