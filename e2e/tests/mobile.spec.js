// Mobile / responsive E2E (signed-out / local flows only).
//
// The rewrite renders a DIFFERENT layout below the Tailwind `md` breakpoint
// (web/src/hooks/useMediaQuery.ts → useIsMobile = max-width:767px):
//   - Layout.tsx drops split.js and shows a single pane with a segmented
//     Edit | Preview control (layout-tab-edit / layout-tab-preview); the inactive
//     pane (editor-region / preview-region) is hidden via Tailwind `hidden`.
//   - AppRoot passes svgMode={isMobile && !fullscreen} to PreviewFrame, so the
//     mobile non-fullscreen preview renders @zenuml/core's NATIVE vector SVG into
//     a #svg-mount container (fit-to-width, width:100%) instead of the fixed-px
//     HTML diagram in #mounting-point (which overflows a phone viewport).
//   - The header action buttons (Share / Present) collapse to icon-only below md:
//     their label <span class="hidden md:inline"> is display:none while the glyph
//     and aria-label persist (ShareButton.tsx / AppHeader.tsx).
//   - The DialogContent shell + Settings modal cap height at the viewport
//     (max-h-85vh + an inner overflow-y-auto scroll surface), so a tall modal
//     stays contained on a small screen.
//
// Covers the gap-plan MOBILE cases: PRV-5, MOB-1, MOB-3, MOB-4. Pure browser /
// no backend — runs in the staging gate signed-out. We force a phone viewport
// (~390x844) with page.setViewportSize so useIsMobile resolves true.

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor } from './helpers/hub';

// Deployed sites (staging/prod via PW_BASE_URL) load third-party analytics/CDN
// scripts that throw uncaught errors we don't own; treat those as noise. Genuine
// app errors still fail the test. (Copied verbatim from smoke.spec.js.)
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

// Phone portrait — below the md (767px) breakpoint so useIsMobile() resolves true.
const PHONE = { width: 390, height: 844 };

const selectAll = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';

const EDITOR_SURFACE = '[data-testid="dsl-editor"] .cm-content';

/**
 * Set the phone viewport BEFORE the first navigation, suppress the one-time
 * modals, then land on the editor. Setting the viewport first means useIsMobile()
 * reads `matches: true` on its initial render — the layout boots mobile, with no
 * desktop→mobile re-layout flash to race.
 */
async function gotoEditorMobile(page) {
  await page.setViewportSize(PHONE);
  await suppressOneTimeModals(page);
  await openEditor(page);
}

/** Type a replacement DSL into the CM6 editor (select-all → Delete → type). */
async function typeDsl(page, dsl, { timeout = 15_000 } = {}) {
  const editor = page.locator(EDITOR_SURFACE);
  await expect(editor).toBeVisible({ timeout });
  await editor.click();
  await page.keyboard.press(selectAll);
  await page.keyboard.press('Delete');
  await editor.pressSequentially(dsl);
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// MOB-1: the segmented control toggles Editor ↔ Preview panes.
// ──────────────────────────────────────────────────────────────────────────────
test('MOB-1: the segmented control toggles between the Editor and Preview panes', async ({
  page,
}) => {
  await gotoEditorMobile(page);

  const editTab = page.locator('[data-testid="layout-tab-edit"]');
  const previewTab = page.locator('[data-testid="layout-tab-preview"]');
  const editorRegion = page.locator('[data-testid="editor-region"]');
  const previewRegion = page.locator('[data-testid="preview-region"]');

  // The segmented control exists ONLY in the mobile single-pane layout — its
  // presence proves we booted the mobile layout (desktop has no such tabs).
  await expect(editTab).toBeVisible();
  await expect(previewTab).toBeVisible();

  // Default tab is Edit: the editor pane is shown, the preview pane is hidden
  // (Layout applies Tailwind `hidden` → display:none on the inactive pane, which
  // Playwright treats as not visible).
  await expect(editTab).toHaveAttribute('aria-pressed', 'true');
  await expect(previewTab).toHaveAttribute('aria-pressed', 'false');
  await expect(editorRegion).toBeVisible();
  await expect(previewRegion).toBeHidden();
  // The CM6 editing surface lives inside the visible editor pane.
  await expect(page.locator(EDITOR_SURFACE)).toBeVisible();

  // Switch to Preview: the panes swap visibility and the pressed state flips.
  await previewTab.click();
  await expect(previewTab).toHaveAttribute('aria-pressed', 'true');
  await expect(editTab).toHaveAttribute('aria-pressed', 'false');
  await expect(previewRegion).toBeVisible();
  await expect(editorRegion).toBeHidden();
  // The preview iframe is in the now-visible preview pane.
  await expect(page.locator('[data-testid="preview-iframe"]')).toBeVisible();
  // The editor surface is in the hidden pane, so it is not visible now.
  await expect(page.locator(EDITOR_SURFACE)).toBeHidden();

  // Switch back to Edit: visibility returns to the initial state (toggle is reversible).
  await editTab.click();
  await expect(editTab).toHaveAttribute('aria-pressed', 'true');
  await expect(editorRegion).toBeVisible();
  await expect(previewRegion).toBeHidden();
  await expect(page.locator(EDITOR_SURFACE)).toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// PRV-5: mobile non-fullscreen preview renders the NATIVE vector SVG (fit-to-width)
// into #svg-mount, NOT the fixed-px HTML diagram in #mounting-point.
//
// Local-build only: the SVG render path runs @zenuml/core's renderToSvg INSIDE the
// srcdoc iframe and asserts on injected DOM in that iframe. That requires the live
// bundle + cross-frame DOM access — both available against the local dev/preview
// server but not guaranteed (or worth the flake) against a remote staging origin.
// ──────────────────────────────────────────────────────────────────────────────
test('PRV-5: mobile non-fullscreen preview renders native SVG (fit-to-width), not fixed-px HTML', async ({
  page,
}) => {
  test.skip(
    !!process.env.PW_BASE_URL,
    'PRV-5 inspects @zenuml/core renderToSvg output inside the srcdoc iframe — local build only',
  );

  await gotoEditorMobile(page);

  // Drive a distinctive diagram so the render is deterministic, then switch to the
  // Preview pane (mobile single-pane: the preview must be the active tab to view it).
  await typeDsl(page, 'MobAlice\nMobBob\nMobAlice->MobBob: SvgRenderTest');
  await page.locator('[data-testid="layout-tab-preview"]').click();

  const frame = page.frameLocator('[data-testid="preview-iframe"]');

  // The native SVG lands inside the dynamically-created #svg-mount container
  // (bootstrap showSvgMount), as a real <svg> element. Target the DIRECT child
  // root <svg> — `#svg-mount svg` (descendant) also matches the nested inner
  // <svg> arrow-heads @zenuml/core emits, tripping Playwright strict mode
  // non-deterministically as the inner SVGs commit. `> svg` is exactly the
  // top-level injected root the bootstrap sizes to width:100%.
  const svg = frame.locator('#svg-mount > svg');
  await expect(svg).toBeVisible({ timeout: 20_000 });

  // Fit-to-width: the bootstrap strips the intrinsic width/height attrs and sets
  // style width:100% so the viewBox drives the aspect ratio. Assert both the inline
  // style and the COMPUTED width that fills the iframe's content box (no fixed px).
  await expect(svg).toHaveAttribute('style', /width:\s*100%/);
  const widthMatchesContainer = await svg.evaluate((el) => {
    const svgW = el.getBoundingClientRect().width;
    const parentW = el.parentElement
      ? el.parentElement.getBoundingClientRect().width
      : 0;
    // Fit-to-width: the SVG spans essentially the full width of its #svg-mount
    // parent (allow a small rounding/scrollbar slack), proving it is not a
    // fixed-px HTML layout narrower/wider than the phone viewport.
    return parentW > 0 && Math.abs(svgW - parentW) <= 2;
  });
  expect(widthMatchesContainer).toBe(true);

  // The fixed-px HTML diagram mount (#mounting-point) is HIDDEN in SVG mode
  // (showSvgMount sets it display:none) — proving HTML layout is not the surface.
  const htmlMountDisplay = await frame
    .locator('#mounting-point')
    .evaluate((el) => getComputedStyle(el).display);
  expect(htmlMountDisplay).toBe('none');
});

// ──────────────────────────────────────────────────────────────────────────────
// MOB-3: action buttons (Share / Present) are icon-only on mobile (label hidden).
// ──────────────────────────────────────────────────────────────────────────────
test('MOB-3: Share and Present action buttons are icon-only on mobile (text label hidden)', async ({
  page,
}) => {
  await gotoEditorMobile(page);

  // Both action buttons render their glyph + a label <span class="hidden md:inline">.
  // Below md the label is display:none; the button itself stays visible and keeps
  // its accessible name via aria-label.
  const shareBtn = page.locator('[data-testid="share-button"]');
  const presentBtn = page.locator('[data-testid="header-present"]');
  await expect(shareBtn).toBeVisible();
  await expect(presentBtn).toBeVisible();

  // The accessible name persists even though the visible text is hidden.
  await expect(shareBtn).toHaveAttribute('aria-label', 'Share');
  await expect(presentBtn).toHaveAttribute('aria-label', 'Present');

  // Icon-only: the "Share"/"Present" label span carries `hidden md:inline`, which
  // is display:none at this width. Playwright's text query only returns VISIBLE
  // text, so the visible text inside each button is empty on mobile.
  await expect(shareBtn.locator('span.hidden.md\\:inline')).toBeHidden();
  await expect(presentBtn.locator('span.hidden.md\\:inline')).toBeHidden();
  // The visible-text accessor returns '' because only the hidden label carries text.
  expect((await shareBtn.innerText()).trim()).toBe('');
  expect((await presentBtn.innerText()).trim()).toBe('');

  // The decorative glyph (an <svg>) IS rendered inside each button — icon-only,
  // not a blank control.
  await expect(shareBtn.locator('svg').first()).toBeVisible();
  await expect(presentBtn.locator('svg').first()).toBeVisible();

  // Cross-check the same labels DO show at desktop width — proves the hiding is a
  // responsive (md+) behavior, not that the label is always absent.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(presentBtn.locator('span.hidden.md\\:inline')).toBeVisible();
  await expect(presentBtn).toContainText('Present');
  await expect(shareBtn.locator('span.hidden.md\\:inline')).toBeVisible();
  await expect(shareBtn).toContainText('Share');
});

// ──────────────────────────────────────────────────────────────────────────────
// MOB-4: a tall modal fits the phone viewport and scrolls (no overflow past it).
//
// The Settings modal is the tallest (18 control rows). Its DialogContent caps at
// max-h-85vh + overflow-hidden, and an inner settings-scroll surface is
// overflow-y-auto — so on a short phone the modal's box stays within the viewport
// and the rows scroll inside it (rather than the modal growing past the screen).
// ──────────────────────────────────────────────────────────────────────────────
test('MOB-4: a tall modal fits the viewport and scrolls internally on mobile', async ({
  page,
}) => {
  await gotoEditorMobile(page);

  // Open Settings via the header overflow menu (same path as modals.spec.js).
  await page.locator('[data-testid="header-menu"]').click();
  await page.locator('[data-testid="header-settings"]').click();

  await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible();

  // The VISIBLE modal box is the Radix DialogContent ([role="dialog"]), which is
  // capped at max-h-85vh + overflow-hidden — that capped box is what must fit the
  // screen. (The settings-modal testid is the UNBOUNDED inner content wrapper that
  // the scroll surface clips; measuring it would wrongly report the full row stack.)
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  const box = await modal.boundingBox();
  expect(box).not.toBeNull();
  expect(box.y).toBeGreaterThanOrEqual(-1); // top is on-screen (small AA slack)
  // Bottom does not run past the viewport — the modal is contained (85vh of 844 ≈
  // 718px tall, centered → bottom well within 844). A naive uncapped modal would
  // overflow here, which is exactly what this case guards against.
  expect(box.y + box.height).toBeLessThanOrEqual(PHONE.height + 1);
  // And it IS shorter than the viewport (the cap actually took effect on a phone).
  expect(box.height).toBeLessThan(PHONE.height);

  // The inner rows are the scroll surface: settings-scroll is overflow-y-auto and
  // its content overflows its capped height on a short phone, so it is scrollable.
  const scroll = page.locator('[data-testid="settings-scroll"]');
  await expect(scroll).toBeVisible();

  const metrics = await scroll.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    overflowY: getComputedStyle(el).overflowY,
  }));
  // The scroll container is the overflow owner and its content is taller than its
  // visible box — i.e. there ARE rows below the fold to scroll to.
  expect(metrics.overflowY).toBe('auto');
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

  // Actually scroll it and assert scrollTop advances — the rows move INSIDE the
  // modal (the modal box itself is fixed), confirming internal scroll, not overflow.
  const scrolledTo = await scroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight; // scroll to the bottom
    return el.scrollTop;
  });
  expect(scrolledTo).toBeGreaterThan(0);

  // After scrolling the rows, the modal box is STILL within the viewport (the
  // overflow was absorbed internally, not by the modal growing off-screen).
  const boxAfter = await modal.boundingBox();
  expect(boxAfter.y + boxAfter.height).toBeLessThanOrEqual(PHONE.height + 1);
});
