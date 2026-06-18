// Templates E2E (signed-out / local). Covers the "Create New" template picker:
//   TPL-1  "Browse templates" opens the full CreateNewModal picker grid.
//   TPL-2  for EACH card (Blank + every real template) selecting it loads that
//          template's DSL into the editor and OPENS it (navigates to /?id=).
//   TPL-3  each card shows a styled schematic preview (the CSS thumbnail).
//
// The picker is reached via the HUB's "Browse templates" affordance: bare '/' boots
// the editor under editor-as-landing, so we navigate to the HomeView library
// ('/?view=diagrams') with an EMPTY local index → its empty-state offers the
// `home-empty-templates` button (and a "From template…" menu item) wired to
// openModal('createNew'). Selecting a card in that hub-rendered CreateNewModal goes
// through handleCreateAndOpen (AppRoot.tsx) which creates the item AND navigates to
// '/?id=<newId>' — landing the user in the editor with the template's DSL loaded.
//
// Card → template inventory (web/src/domain/templates.ts):
//   create-blank                       → Blank (empty js)
//   create-template-basic              → "Basic"          js: A.method() { if(condition) … }
//   create-template-black-white        → "Black & White"  js: Client->SGW."Get order by id" …
//   create-template-blue               → "Blue"           js: Client->SGW."Get order by id" …
//   create-template-starUMLTheme       → "starUML Theme"  js: A.do() { if (condition1) … }
// (blue & black-white intentionally share identical JS — they differ only in CSS
// theme — so the DSL-load assertion for both keys on the shared Client->SGW token.)

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';

// Deployed sites (staging/prod, reached via PW_BASE_URL) load third-party
// analytics/CDN scripts that throw uncaught errors we don't own; treat those as
// noise (copied verbatim from smoke.spec.js).
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

const HOME_VIEW = '[data-testid="home-view"]';
const EDITOR_CONTENT = '[data-testid="dsl-editor"] .cm-content';

/**
 * Navigate to the HUB (HomeView library) with a CLEAN local slate, so its
 * empty-state renders the `home-empty-templates` "Browse templates" button.
 * Inlined here (per the no-shared-edit rule); mirrors library.spec.js gotoFresh
 * but lands on the hub instead of the editor — we want the empty library state.
 */
async function gotoHubFresh(page) {
  await suppressOneTimeModals(page); // keep onboarding/pledge from trapping focus
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  // Full navigation to the opt-in hub URL; useItems re-reads the (now empty) index.
  await page.goto('/?view=diagrams');
  await expect(page.locator(HOME_VIEW)).toBeVisible({ timeout: 15_000 });
}

/** Open the CreateNewModal picker via the hub's empty-state "Browse templates". */
async function openPicker(page) {
  const browse = page.locator('[data-testid="home-empty-templates"]');
  await expect(browse).toBeVisible();
  await browse.click();
  const modal = page.locator('[data-testid="create-new-modal"]');
  await expect(modal).toBeVisible();
  return modal;
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// TPL-1: "Browse templates" opens the full CreateNewModal picker grid.
// ──────────────────────────────────────────────────────────────────────────────
test('TPL-1: "Browse templates" opens the full template picker grid', async ({
  page,
}) => {
  await gotoHubFresh(page);
  const modal = await openPicker(page);

  // The picker is the full grid: a Blank card, the two labelled sections
  // (Start / Styles), and every real template card. Assert the grid is fully
  // populated — not a partial/empty modal.
  await expect(modal).toContainText('Start');
  await expect(modal).toContainText('Styles');

  await expect(page.locator('[data-testid="create-blank"]')).toBeVisible();
  for (const id of ['basic', 'black-white', 'blue', 'starUMLTheme']) {
    await expect(
      page.locator(`[data-testid="create-template-${id}"]`),
    ).toBeVisible();
  }

  // Every selectable card is a real <button> (the grid is interactive, not a
  // static preview). Blank + 4 templates = 5 cards.
  const cards = modal.locator(
    'button[data-testid="create-blank"], button[data-testid^="create-template-"]',
  );
  await expect(cards).toHaveCount(5);
});

// ──────────────────────────────────────────────────────────────────────────────
// TPL-2: each card loads its template's DSL into the editor AND opens it.
//
// One sub-test per card (honors the explicit "EACH template card" scope). Each
// re-opens the picker fresh, clicks the card, and asserts: the modal closes, the
// URL gains ?id=<newId> (the item was created AND opened), and the editor surface
// shows that template's DSL (a token unique enough to prove it's THIS template,
// not the default starter). Blank asserts an EMPTY editor (no template DSL).
// ──────────────────────────────────────────────────────────────────────────────
const TEMPLATE_CASES = [
  // [card testid, a token that appears in the editor after loading this template]
  ['create-template-basic', 'A.method()'],
  ['create-template-black-white', 'Client->SGW'],
  ['create-template-blue', 'Client->SGW'],
  ['create-template-starUMLTheme', 'A.do()'],
];

for (const [cardTestId, dslToken] of TEMPLATE_CASES) {
  test(`TPL-2: selecting ${cardTestId} loads its DSL into the editor and opens it`, async ({
    page,
  }) => {
    await gotoHubFresh(page);
    await openPicker(page);

    await page.locator(`[data-testid="${cardTestId}"]`).click();

    // The picker closes on selection (choose() → onOpenChange(false)).
    await expect(page.locator('[data-testid="create-new-modal"]')).toBeHidden();

    // handleCreateAndOpen navigates to '/?id=<newId>' — the diagram is OPENED,
    // not just created. Prove the editor surface is now showing.
    const editor = page.locator(EDITOR_CONTENT);
    await expect(editor).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/[?&]id=/, { timeout: 15_000 });
    // The hub library is gone (we left it for the editor).
    await expect(page.locator(HOME_VIEW)).toHaveCount(0);

    // The editor shows THIS template's DSL — a token unique enough to distinguish
    // it from the default starter (which is 'Alice -> Bob: Hello').
    await expect(editor).toContainText(dslToken, { timeout: 15_000 });
    await expect(editor).not.toContainText('Alice -> Bob: Hello');
  });
}

test('TPL-2: selecting Blank opens an empty editor (no template DSL)', async ({
  page,
}) => {
  await gotoHubFresh(page);
  await openPicker(page);

  await page.locator('[data-testid="create-blank"]').click();

  await expect(page.locator('[data-testid="create-new-modal"]')).toBeHidden();

  // Blank also navigates to '/?id=<newId>' (blankTemplate() → handleCreateAndOpen)
  // and opens the editor — but with EMPTY content (no fabricated DSL).
  const editor = page.locator(EDITOR_CONTENT);
  await expect(editor).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/[?&]id=/, { timeout: 15_000 });
  await expect(page.locator(HOME_VIEW)).toHaveCount(0);

  // Blank carries no template DSL and is not the styled-template content.
  await expect(editor).not.toContainText('A.method()');
  await expect(editor).not.toContainText('Client->SGW');
  await expect(editor).not.toContainText('A.do()');
});

// ──────────────────────────────────────────────────────────────────────────────
// TPL-3: each card shows a styled schematic preview.
//
// The CreateNewModal paints a CSS schematic per card (CreateNewModal.tsx Thumb /
// BlankThumb): two participant boxes joined by tinted message lines for templates,
// a dashed "+" canvas for Blank. The thumbnails are aria-hidden decorations, so we
// assert the schematic ELEMENT is present + visible inside each card, and that the
// themed-template thumbs carry their per-template tint as an INLINE border-color
// style (proving the preview is STYLED to the template, not a bare placeholder).
// ──────────────────────────────────────────────────────────────────────────────
test('TPL-3: each card shows a styled schematic preview', async ({ page }) => {
  await gotoHubFresh(page);
  const modal = await openPicker(page);

  // Blank's preview is the dashed-border "+" canvas (BlankThumb): an aria-hidden
  // decorative div inside the card, plus the visible "+" glyph.
  const blankCard = modal.locator('[data-testid="create-blank"]');
  const blankThumb = blankCard.locator('div[aria-hidden="true"]').first();
  await expect(blankThumb).toBeVisible();
  await expect(blankThumb).toContainText('+');

  // Every themed template card shows the participant/message schematic, tinted to
  // the template theme. THUMB_TINTS (CreateNewModal.tsx) sets each card's participant
  // box border-color inline to the template's box tint — assert that specific color
  // is present (proves the preview is STYLED per-template, not a generic stub).
  const expectedBoxTint = {
    basic: 'rgb(138, 147, 161)', // #8A93A1
    'black-white': 'rgb(0, 0, 0)', // #000000
    blue: 'rgb(47, 107, 255)', // #2F6BFF
    starUMLTheme: 'rgb(227, 201, 143)', // #e3c98f
  };

  for (const [id, tint] of Object.entries(expectedBoxTint)) {
    const card = modal.locator(`[data-testid="create-template-${id}"]`);
    // The schematic container (aria-hidden Thumb) is present and visible.
    const thumb = card.locator('div[aria-hidden="true"]').first();
    await expect(thumb).toBeVisible();

    // The two tinted participant boxes carry the template's box tint inline.
    const tintedBoxes = card.locator(
      `span[style*="border-color: ${tint}"], span[style*="borderColor: ${tint}"]`,
    );
    await expect(tintedBoxes.first()).toBeVisible();
    // Two participant boxes per schematic (left + right).
    await expect(tintedBoxes).toHaveCount(2);
  }
});
