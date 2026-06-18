// Library / Hub actions E2E (signed-out / local flows only).
//
// Covers the per-card kebab actions and grid-level affordances on the HomeView
// hub (reached at '/?view=diagrams' under editor-as-landing, 2026-06-13):
//
//   LIB-1  kebab → Duplicate  → returning to the hub shows a second "(Forked) …" card
//   LIB-2  kebab → Delete     → the card disappears from the grid
//   LIB-3  kebab → Export HTML → triggers a *.html download (local-build only)
//   LIB-4  sort Recent ↔ Title → reorders the grid
//   LIB-5  a card shows its DSL preview + title + last-updated date
//   LIB-6  hub "New" CTA       → opens a blank editor
//   LIB-8  empty hub           → "No diagrams yet" + New / Browse-templates CTAs
//
// Selectors are REAL (grepped from web/src/components/home/{HomeView,DiagramCard}.tsx
// and web/src/ui/{Menu,Select}.tsx):
//   - Cards:        [data-testid^="home-card-"] (DiagramCard root; the only testid).
//   - Kebab menu:   a Radix DropdownMenu — trigger is the per-card button
//                   aria-label="Diagram options"; items carry NO testid, so we
//                   target them by their visible text (Duplicate / Delete /
//                   "Export as HTML"), the stable contract.
//   - Sort:         Radix Select [data-testid="home-sort"]; options render as
//                   role=option named "Recent"/"Title" (Recent = updated desc).
//   - Empty state:  [data-testid="home-empty"], home-empty-new, home-empty-templates.
//   - New CTA:      [data-testid="home-new"] (split-button primary).
//
// Seeding mirrors library.spec.js exactly: seed items in the EDITOR (bare '/' boots
// it; openEditor), then read the library back via a FULL navigation to
// '/?view=diagrams' (gotoHome) so a fresh useItems mount re-reads localItems.
//
// handleForkItem (AppRoot) loads + forks (title → "(Forked) …", dirty) and switches
// to the editor — a fork is UNOWNED until explicitly saved, so LIB-1 must Save the
// fork in the editor before it appears as a second hub card. handleDeleteItem runs
// itemService.removeItem immediately with NO confirm dialog for home cards (the
// ConfirmDialogs in the tree are for folders/pages/editor); LIB-2 still handles a
// confirm conditionally per the plan's "with confirm if any".

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor, gotoHome } from './helpers/hub';

const selectAll = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';

// Deployed sites load third-party analytics/CDN scripts that throw uncaught errors
// we don't own; treat those as noise (copied verbatim from smoke/library specs).
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

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });
  // M04: seed onboarding/pledge flags before any navigation so their Radix overlays
  // don't trap focus and intercept the header/card clicks these tests drive.
  await suppressOneTimeModals(page);
});

// ── Local helpers (inlined; library.spec.js owns the shared copies — do not import
//    from a sibling spec, and do NOT edit helpers/*.js which other agents touch). ──

function editorLocator(page) {
  return page.locator('[data-testid="dsl-editor"] .cm-content');
}

/** Navigate to the EDITOR with a clean localStorage slate. */
async function gotoFresh(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openEditor(page);
}

/** Type a replacement DSL into the CM6 editor (select-all → Delete → type). */
async function typeDsl(page, dsl, { timeout = 15_000 } = {}) {
  const editor = editorLocator(page);
  await expect(editor).toBeVisible({ timeout });
  await editor.click();
  await page.keyboard.press(selectAll);
  await page.keyboard.press('Delete');
  await editor.pressSequentially(dsl);
}

/** Set the diagram title via the header title field (used to identify rows). */
async function setTitle(page, title) {
  const titleInput = page.locator('[data-testid="header-title"]');
  await expect(titleInput).toBeVisible();
  await titleInput.click();
  await page.keyboard.press(selectAll);
  await page.keyboard.press('Delete');
  await titleInput.pressSequentially(title);
  await expect(titleInput).toHaveValue(title);
}

/**
 * The FIRST signed-out Save opens a one-time "Saved on this device" notice (a Radix
 * Dialog whose overlay intercepts the next click). Dismiss it via "Not now"
 * (confirm-cancel). gotoFresh clears localStorage so the first save in every test
 * shows it with certainty — await it deterministically when {expected:true}.
 */
async function dismissSaveNoticeIfPresent(page, { expected = false } = {}) {
  const cancel = page.locator('[data-testid="confirm-cancel"]');
  if (expected) {
    await expect(cancel).toBeVisible();
  } else if (!(await cancel.isVisible().catch(() => false))) {
    return;
  }
  await cancel.click();
  await expect(cancel).toBeHidden();
}

/** Seed one local item: set a distinctive title + DSL, then Save (header menu). */
async function seedItem(page, { title, dsl, firstSave = false }) {
  await setTitle(page, title);
  await typeDsl(page, dsl);
  await expect(editorLocator(page)).toContainText(dsl.split('\n')[0]);
  await page.locator('[data-testid="header-menu"]').click();
  await page.locator('[data-testid="header-save"]').click();
  await dismissSaveNoticeIfPresent(page, { expected: firstSave });
}

/** Start a NEW blank diagram in the editor (header menu → New).
 *
 * Determinism guards (LIB-4 flake fix): a prior signed-out Save can leave the
 * "Saved on this device" notice (a Radix Dialog with a fixed inset-0 overlay) on
 * screen; its overlay intercepts the header-menu click and the whole open/click
 * dance times out (~30s). So (1) first ensure that notice is fully dismissed and
 * its overlay hidden, then (2) after opening the header menu, WAIT for the Radix
 * dropdown's "New" item to actually be visible before clicking it — clicking
 * header-new blindly races the dropdown's open animation. */
async function newInEditor(page) {
  // (1) Make sure no leftover "Saved on this device" notice overlay can swallow
  // the menu click; wait for its cancel button (and thus the overlay) to be gone.
  await dismissSaveNoticeIfPresent(page);
  const saveNoticeCancel = page.locator('[data-testid="confirm-cancel"]');
  await expect(saveNoticeCancel).toBeHidden();

  // (2) Open the header menu and gate on the "New" item being visible before click.
  await page.locator('[data-testid="header-menu"]').click();
  const newItem = page.locator('[data-testid="header-new"]');
  await expect(newItem).toBeVisible();
  await newItem.click();
  await expect(editorLocator(page)).toBeVisible();
}

/**
 * Open a card's kebab menu and click an item by its visible text. The kebab trigger
 * is opacity-0 until group-hover but is always in the DOM; hover first so it's
 * interactable, then open via its aria-label and select the labelled MenuItem.
 */
async function openCardMenu(card, page, itemText) {
  await card.hover();
  await card.getByRole('button', { name: 'Diagram options' }).click();
  // Radix DropdownMenu items render with role=menuitem in a portal.
  await page.getByRole('menuitem', { name: itemText, exact: true }).click();
}

// ──────────────────────────────────────────────────────────────────────────────
// LIB-8: Empty hub shows the "No diagrams yet" empty state + both CTAs.
// (Ordered first because it asserts on a clean slate with zero items.)
// ──────────────────────────────────────────────────────────────────────────────
test('LIB-8: empty hub shows "No diagrams yet" with New + Browse-templates CTAs', async ({
  page,
}) => {
  // Clean localStorage → zero items → empty state. Go to the editor first only to
  // clear storage from a same-origin page, then navigate to the hub.
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await gotoHome(page);

  const empty = page.locator('[data-testid="home-empty"]');
  await expect(empty).toBeVisible();
  await expect(
    empty.getByText('No diagrams yet', { exact: true }),
  ).toBeVisible();

  // Both first-run CTAs are present and labelled.
  await expect(page.locator('[data-testid="home-empty-new"]')).toBeVisible();
  await expect(
    page.locator('[data-testid="home-empty-templates"]'),
  ).toBeVisible();
  await expect(page.locator('[data-testid="home-empty-new"]')).toHaveText(
    'New diagram',
  );
  await expect(page.locator('[data-testid="home-empty-templates"]')).toHaveText(
    'Browse templates',
  );

  // No grid renders while empty (proves the empty branch, not a hidden grid).
  await expect(page.locator('[data-testid="home-grid"]')).toHaveCount(0);

  // The empty-state New CTA actually opens the editor (blank diagram).
  await page.locator('[data-testid="home-empty-new"]').click();
  await expect(editorLocator(page)).toBeVisible({ timeout: 15_000 });
});

// ──────────────────────────────────────────────────────────────────────────────
// LIB-6: The hub "New" CTA opens a blank editor.
// ──────────────────────────────────────────────────────────────────────────────
test('LIB-6: hub "New" CTA opens a blank editor', async ({ page }) => {
  // Seed one item so the populated hub (with the split New button) renders — the
  // empty state has its OWN New CTA (covered by LIB-8); this asserts the header one.
  await gotoFresh(page);
  await seedItem(page, {
    title: 'SeedForNew',
    dsl: 'NewA\nNewB\nNewA->NewB: seed',
    firstSave: true,
  });
  await gotoHome(page);
  await expect(page.locator('[data-testid="home-grid"]')).toBeVisible();

  // Click the hub's primary New button → editor opens on a blank diagram.
  await page.locator('[data-testid="home-new"]').click();
  const editor = editorLocator(page);
  await expect(editor).toBeVisible({ timeout: 15_000 });
  // handleNewDiagramFromHome loads js:'' (blank) → the CM6 surface is empty.
  await expect(editor).toHaveText('');
  // The URL reflects the new diagram (?id=…) and is NOT the hub view.
  await expect(page).toHaveURL(/[?&]id=/);
  await expect(page.locator('[data-testid="home-view"]')).toHaveCount(0);
});

// ──────────────────────────────────────────────────────────────────────────────
// LIB-5: A card shows DSL preview + title + last-updated date.
// ──────────────────────────────────────────────────────────────────────────────
test('LIB-5: a card shows DSL preview + title + last-updated', async ({
  page,
}) => {
  await gotoFresh(page);

  const title = 'PreviewCard';
  const dsl =
    'PreviewActor\nPreviewTarget\nPreviewActor->PreviewTarget: previewMessage';
  await seedItem(page, { title, dsl, firstSave: true });

  await gotoHome(page);
  await expect(page.locator('[data-testid="home-grid"]')).toBeVisible();

  // Locate this item's card (the only one in a fresh library).
  const card = page.locator('[data-testid^="home-card-"]');
  await expect(card).toHaveCount(1);

  // Title is shown on the card.
  await expect(card.getByText(title, { exact: true })).toBeVisible();

  // DSL preview: the card renders a <pre> snippet of item.js — assert distinctive
  // tokens from the seeded DSL appear in the card body (preview is whole-DSL,
  // ≤240 chars; our DSL is well under that so the message line is included).
  await expect(card).toContainText('PreviewActor');
  await expect(card).toContainText('previewMessage');

  // Last-updated: DiagramCard formats updatedOn as a localized short date via
  // new Date(updatedOn).toLocaleDateString(undefined, {month:'short', day:'numeric'}).
  // Compute the EXPECTED string INSIDE the browser (not in Node) so it uses the same
  // runtime locale the component does — Node and Chromium default to different
  // locales (Node here renders "18 June", Chromium "Jun 18"), which would make a
  // Node-side toLocaleDateString a false mismatch. This stays a real assertion: it
  // proves the card surfaces the seeded item's updatedOn as today's localized date.
  const expectedDate = await page.evaluate(() =>
    new Date().toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  );
  await expect(card.getByText(expectedDate, { exact: true })).toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// LIB-1: kebab → Duplicate yields a second "(Forked) …" card on the hub.
// ──────────────────────────────────────────────────────────────────────────────
test('LIB-1: card kebab Duplicate adds a second row', async ({ page }) => {
  await gotoFresh(page);

  const title = 'DupSource';
  await seedItem(page, {
    title,
    dsl: 'DupA\nDupB\nDupA->DupB: original',
    firstSave: true,
  });

  await gotoHome(page);
  await expect(page.locator('[data-testid="home-grid"]')).toBeVisible();
  await expect(page.locator('[data-testid^="home-card-"]')).toHaveCount(1);

  // Open the card kebab → Duplicate. handleForkItem (AppRoot) forks the held item in
  // the editor store — title → "(Forked) <title>", a NEW id, dirty:true — and calls
  // setActivePanel('editor'). Crucially it does NOT navigate the URL, so the view is
  // still governed by ?view=diagrams (isHomeMode stays true): we remain on the hub.
  // The fork is unowned-until-saved, but autoSave defaults ON (settingsStore) and
  // AppRoot's top-level useAutoSave persists any dirty item on its interval, which
  // routes through itemService.setItem → localItems (a local write). useItems
  // (signed-out) subscribes to localItems, so the new "(Forked) …" card appears in
  // THIS hub grid in place — no remount, no editor visit. We assert that observable
  // outcome with a generous poll covering the autosave interval.
  const card = page.locator('[data-testid^="home-card-"]').first();
  await openCardMenu(card, page, 'Duplicate');

  // Still on the hub (Duplicate does not leave ?view=diagrams).
  await expect(page.locator('[data-testid="home-view"]')).toBeVisible();

  // The fork lands as a second card once autosave persists it (≤ autosave interval).
  await expect(
    page.getByText(`(Forked) ${title}`, { exact: true }),
  ).toBeVisible({ timeout: 25_000 });
  await expect(page.locator('[data-testid^="home-card-"]')).toHaveCount(2);
  // The original survives alongside the fork.
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// LIB-2: kebab → Delete removes the card (confirm if prompted).
// ──────────────────────────────────────────────────────────────────────────────
test('LIB-2: card kebab Delete removes the row', async ({ page }) => {
  await gotoFresh(page);

  // Seed TWO items so deleting one leaves a visible survivor (proves a targeted
  // removal, not a wholesale clear).
  await seedItem(page, {
    title: 'DeleteMe',
    dsl: 'DelA\nDelB\nDelA->DelB: gone',
    firstSave: true,
  });
  await newInEditor(page);
  await seedItem(page, {
    title: 'KeepMe',
    dsl: 'KeepA\nKeepB\nKeepA->KeepB: stays',
  });

  await gotoHome(page);
  await expect(page.locator('[data-testid="home-grid"]')).toBeVisible();
  await expect(page.locator('[data-testid^="home-card-"]')).toHaveCount(2);

  // Open the DeleteMe card's kebab → Delete. The home card Delete runs
  // itemService.removeItem immediately (no ConfirmDialog wraps it), but handle a
  // confirm conditionally per the plan in case one is added later.
  const deleteCard = page
    .locator('[data-testid^="home-card-"]')
    .filter({ hasText: 'DeleteMe' });
  await expect(deleteCard).toHaveCount(1);
  await openCardMenu(deleteCard, page, 'Delete');

  // If a confirmation dialog appears, accept it (confirm-confirm); otherwise no-op.
  const confirmBtn = page.locator('[data-testid="confirm-confirm"]');
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
  }

  // The DeleteMe card is gone; KeepMe survives; the grid shrinks to one card.
  await expect(page.getByText('DeleteMe', { exact: true })).toHaveCount(0);
  await expect(page.getByText('KeepMe', { exact: true })).toBeVisible();
  await expect(page.locator('[data-testid^="home-card-"]')).toHaveCount(1);
});

// ──────────────────────────────────────────────────────────────────────────────
// LIB-3: kebab → Export as HTML triggers a *.html download.
// File downloads only work against a local build/dev server — self-skip on the
// remote staging gate (same guard shape as production-build.spec.js).
// ──────────────────────────────────────────────────────────────────────────────
test('LIB-3: card kebab Export as HTML downloads a *.html file', async ({
  page,
}) => {
  test.skip(
    !!process.env.PW_BASE_URL,
    'file-download assertion requires the local dev/build server',
  );

  await gotoFresh(page);
  await seedItem(page, {
    title: 'ExportHtmlCard',
    dsl: 'HtmlA\nHtmlB\nHtmlA->HtmlB: exportHtml',
    firstSave: true,
  });

  await gotoHome(page);
  await expect(page.locator('[data-testid="home-grid"]')).toBeVisible();
  const card = page.locator('[data-testid^="home-card-"]').first();

  // handleExportHtml builds a standalone HTML doc and downloadText(`<safe>.html`, …);
  // "ExportHtmlCard" → safe slug "exporthtmlcard.html". Assert the download fires
  // with a *.html filename.
  await card.hover();
  await card.getByRole('button', { name: 'Diagram options' }).click();
  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
  await page
    .getByRole('menuitem', { name: 'Export as HTML', exact: true })
    .click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/\.html$/);
  expect(download.suggestedFilename()).toBe('exporthtmlcard.html');
});

// ──────────────────────────────────────────────────────────────────────────────
// LIB-4: sort toggle Recent ↔ Title reorders the grid.
// ──────────────────────────────────────────────────────────────────────────────
test('LIB-4: sort toggle Recent ↔ Title reorders the grid', async ({
  page,
}) => {
  await gotoFresh(page);

  // Seed three items where save order (→ updatedOn) is the REVERSE of A–Z title
  // order, so the two sorts produce visibly different sequences:
  //   save order (newest first under "Recent"): Zeta, Mu, Alpha
  //   title A–Z (under "Title"):                Alpha, Mu, Zeta
  await seedItem(page, {
    title: 'Alpha',
    dsl: 'AlA\nAlB\nAlA->AlB: a',
    firstSave: true,
  });
  await newInEditor(page);
  await seedItem(page, { title: 'Mu', dsl: 'MuA\nMuB\nMuA->MuB: m' });
  await newInEditor(page);
  await seedItem(page, { title: 'Zeta', dsl: 'ZeA\nZeB\nZeA->ZeB: z' });

  await gotoHome(page);
  await expect(page.locator('[data-testid="home-grid"]')).toBeVisible();
  await expect(page.locator('[data-testid^="home-card-"]')).toHaveCount(3);

  // Read the on-card titles in DOM order. Each card's title is the first footer
  // span; scope to the cards and map the visible title text.
  async function cardTitlesInOrder() {
    const cards = page.locator('[data-testid^="home-card-"]');
    const n = await cards.count();
    const titles = [];
    for (let i = 0; i < n; i++) {
      // The card's accessible "Open <title>" button label carries the exact title;
      // read it to avoid coupling to the preview/date spans.
      const label = await cards
        .nth(i)
        .getByRole('button', { name: /^Open / })
        .getAttribute('aria-label');
      titles.push(label.replace(/^Open /, ''));
    }
    return titles;
  }

  // Default sort is "Recent" (updated desc) → newest save first.
  expect(await cardTitlesInOrder()).toEqual(['Zeta', 'Mu', 'Alpha']);

  // Toggle the sort Select to "Title" → alphabetical A–Z.
  await page.locator('[data-testid="home-sort"]').click();
  await page.getByRole('option', { name: 'Title', exact: true }).click();
  await expect
    .poll(async () => await cardTitlesInOrder())
    .toEqual(['Alpha', 'Mu', 'Zeta']);

  // Toggle back to "Recent" → the updated-desc order returns (proves it's a real
  // re-sort, not a one-way change).
  await page.locator('[data-testid="home-sort"]').click();
  await page.getByRole('option', { name: 'Recent', exact: true }).click();
  await expect
    .poll(async () => await cardTitlesInOrder())
    .toEqual(['Zeta', 'Mu', 'Alpha']);
});
