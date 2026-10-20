// Library / Hub actions E2E (signed-out / local flows only).
//
// Covers the per-card actions and grid-level affordances on the HomeView
// hub (reached at '/?view=diagrams' under editor-as-landing, 2026-06-13):
//
//   LIB-1  Fork → editor → save → second "(Forked) …" card
//   LIB-2  Delete → confirmation → the card disappears from the grid
//   LIB-3  Export all JSON remains available from the hub
//   LIB-4  sort Last modified ↔ Name A–Z → reorders the grid
//   LIB-5  a card shows its DSL preview + title + last-updated date
//   LIB-6  hub "New" CTA       → opens a blank editor
//   LIB-8  empty hub           → "No diagrams yet" + New / Browse-templates CTAs
//
// Selectors are REAL (grepped from web/src/components/home/{HomeView,DiagramCard}.tsx
// and web/src/ui/{Menu,Select}.tsx):
//   - Cards:        [data-testid^="home-card-"] (DiagramCard root; the only testid).
//   - Per-card actions: direct Fork/Delete buttons with item-specific aria labels.
//   - Sort:         direct buttons [data-testid="home-sort-updated"] and
//                   [data-testid="home-sort-title"].
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
  await page.keyboard.press('ControlOrMeta+s'); // manual save (⌘S; the logo menu is gone)
  await dismissSaveNoticeIfPresent(page, { expected: firstSave });
}

/** Start a NEW blank diagram in the editor (toolbar New).
 *
 * Determinism guard (LIB-4 flake fix): a prior signed-out Save can leave the
 * "Saved on this device" notice (a Radix Dialog with a fixed inset-0 overlay) on
 * screen; its overlay intercepts the New click. So first ensure that notice is
 * fully dismissed and its overlay hidden. */
async function newInEditor(page) {
  await dismissSaveNoticeIfPresent(page);
  const saveNoticeCancel = page.locator('[data-testid="confirm-cancel"]');
  await expect(saveNoticeCancel).toBeHidden();

  await page.locator('[data-testid="header-new"]').click();
  await expect(editorLocator(page)).toBeVisible();
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
// LIB-5: A card shows its thumbnail + title + last-updated date.
// ──────────────────────────────────────────────────────────────────────────────
test('LIB-5: a card shows diagram thumbnail + title + last-updated', async ({
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

  // The diagram is rendered in an isolated iframe thumbnail; verify the preview
  // surface itself is present rather than expecting hidden DSL source in the card.
  await expect(card.locator('[data-testid^="home-thumb-"]')).toBeVisible();

  // DiagramCard formats the edit date with the en-GB locale; compute it in-browser
  // from the same current date value for a stable check.
  const expectedDate = await page.evaluate(() =>
    new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    }),
  );
  await expect(card.getByText(expectedDate, { exact: true })).toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// LIB-1: Fork opens the editor; saving it adds a second "(Forked) …" card.
// ──────────────────────────────────────────────────────────────────────────────
test('LIB-1: Fork then save adds a second row', async ({ page }) => {
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

  const card = page.locator('[data-testid^="home-card-"]').first();
  await card.getByRole('button', { name: `Fork ${title}` }).click();
  await expect(editorLocator(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="header-title"]')).toHaveValue(`(Forked) ${title}`);
  await page.keyboard.press('ControlOrMeta+s');
  await dismissSaveNoticeIfPresent(page);
  await gotoHome(page);
  await expect(page.getByText(`(Forked) ${title}`, { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid^="home-card-"]')).toHaveCount(2);
  // The original survives alongside the fork.
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// LIB-2: Delete confirms and removes only the selected card.
// ──────────────────────────────────────────────────────────────────────────────
test('LIB-2: card Delete removes the row after confirmation', async ({ page }) => {
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

  const deleteCard = page
    .locator('[data-testid^="home-card-"]')
    .filter({ hasText: 'DeleteMe' });
  await expect(deleteCard).toHaveCount(1);
  await deleteCard.getByRole('button', { name: 'Delete DeleteMe' }).click();
  const confirm = page.getByRole('dialog').filter({ hasText: 'Delete this diagram?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Delete' }).click();

  // The DeleteMe card is gone; KeepMe survives; the grid shrinks to one card.
  await expect(page.getByText('DeleteMe', { exact: true })).toHaveCount(0);
  await expect(page.getByText('KeepMe', { exact: true })).toBeVisible();
  await expect(page.locator('[data-testid^="home-card-"]')).toHaveCount(1);
});

// ──────────────────────────────────────────────────────────────────────────────
// LIB-3: Export all remains available from the populated hub.
// ──────────────────────────────────────────────────────────────────────────────
test('LIB-3: Export all downloads the supported JSON backup', async ({
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
  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
  await page.locator('[data-testid="lib-export-all"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('zenuml-diagrams.json');
});

// ──────────────────────────────────────────────────────────────────────────────
// LIB-4: sort buttons Last modified ↔ Name A–Z reorder the grid.
// ──────────────────────────────────────────────────────────────────────────────
test('LIB-4: sort toggle Last modified ↔ Name A–Z reorders the grid', async ({
  page,
}) => {
  await gotoFresh(page);

  // Seed three items where save order (→ updatedOn) is the REVERSE of A–Z title
  // order, so the two sorts produce visibly different sequences:
  //   save order (newest first): Zeta, Mu, Alpha
  //   title A–Z:                 Alpha, Mu, Zeta
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

  // Default sort is "Last modified" (updated desc) → newest save first.
  expect(await cardTitlesInOrder()).toEqual(['Zeta', 'Mu', 'Alpha']);

  // Toggle to alphabetical A–Z.
  await page.locator('[data-testid="home-sort-title"]').click();
  await expect
    .poll(async () => await cardTitlesInOrder())
    .toEqual(['Alpha', 'Mu', 'Zeta']);

  // Toggle back to "Last modified" → the updated-desc order returns (proves it's a real
  // re-sort, not a one-way change).
  await page.locator('[data-testid="home-sort-updated"]').click();
  await expect
    .poll(async () => await cardTitlesInOrder())
    .toEqual(['Zeta', 'Mu', 'Alpha']);
});
