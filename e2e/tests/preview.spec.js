// Preview controls E2E (signed-out / local flows only) — E2E_GAP_TEST_PLAN PRV-*.
//
// The preview/renderer side of the editor is the dark `ink` pane on the right.
// Its surfaces (selectors verified against the components, not invented):
//   - RendererHeader (web/src/components/preview/RendererHeader.tsx): the zoom
//     label ("100%") + the Present button (data-testid="renderer-present").
//   - PreviewFrame (web/src/preview/PreviewFrame.tsx): the srcdoc iframe
//     (data-testid="preview-iframe") whose #mounting-point holds the rendered SVG.
//   - Console (web/src/preview/Console.tsx): the docked debug band
//     (data-testid="console") with console-toggle / console-status / console-count /
//     console-eval / console-clear. Always rendered when NOT fullscreen (collapsed
//     to h-8 when closed); HIDDEN in Present/fullscreen mode.
//   - Present/fullscreen (AppRoot.tsx ~1315): toggleFullscreen makes the preview
//     `fixed inset-0 z-50`, swaps RendererHeader for an Exit button
//     (data-testid="preview-fullscreen"), and stops rendering the Console.
//
// What each test asserts is an OBSERVABLE outcome (a re-render, a visible/hidden
// surface, a count change, an echoed value) — never a trivially-true check.
//
// Editor-as-landing (2026-06-13): bare '/' boots the EDITOR directly; openEditor
// lands on the CM6 surface. The preview iframe + console band live in that editor.

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor } from './helpers/hub';

const selectAll = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';

// Deployed sites (staging/prod, reached via PW_BASE_URL) load third-party
// analytics/CDN scripts that throw uncaught errors we don't own; treat those as
// noise so this spec stays usable against the live staging E2E gate.
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

function editorLocator(page) {
  return page.locator('[data-testid="dsl-editor"] .cm-content');
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

/** The rendered diagram's #mounting-point inside the preview iframe. */
function mountLocator(page) {
  return page
    .frameLocator('[data-testid="preview-iframe"]')
    .locator('#mounting-point');
}

/**
 * Wait until the preview iframe is fully READY — i.e. the @zenuml/core bundle has
 * loaded, posted `ready`, and rendered an <svg>. Only AFTER `ready` does the iframe
 * bootstrap register its message listener, so evalConsole round-trips would
 * otherwise time out (PreviewFrame.evalConsole resolves "timeout" after 5s if the
 * frame never answers). Gating eval-based tests on a visible SVG removes that race.
 */
async function waitPreviewReady(page) {
  await expect(mountLocator(page).locator('svg').first()).toBeVisible({
    timeout: 20_000,
  });
}

/** Open an item in the header overflow menu by its trigger testid. */
async function openViaHeaderMenu(page, triggerTestId) {
  await page.locator('[data-testid="header-menu"]').click();
  await page.locator(`[data-testid="${triggerTestId}"]`).click();
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });
  await suppressOneTimeModals(page); // M04: keep onboarding/pledge from trapping focus
  // Start from a clean slate so the seeded sample (and console state) is deterministic.
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openEditor(page);
});

// ──────────────────────────────────────────────────────────────────────────────
// PRV-1: Present/fullscreen toggle expands the diagram and hides editor + console;
//        Exit restores.
// ──────────────────────────────────────────────────────────────────────────────
test('PRV-1: Present toggles a fullscreen surface that hides the editor + console; Exit restores', async ({
  page,
}) => {
  // Baseline: the editor region, the renderer header's Present button, and the
  // docked console band are all present in normal (non-fullscreen) mode.
  await expect(page.locator('[data-testid="editor-region"]')).toBeVisible();
  await expect(page.locator('[data-testid="renderer-present"]')).toBeVisible();
  await expect(page.locator('[data-testid="console"]')).toBeVisible();
  // The diagram has rendered into the iframe before we present (so "expands the
  // diagram" is meaningful, not an empty fullscreen box).
  await expect(mountLocator(page).locator('svg').first()).toBeVisible({
    timeout: 15_000,
  });

  // Enter Present (fullscreen).
  await page.locator('[data-testid="renderer-present"]').click();

  // The preview becomes a fixed inset-0 overlay: the Exit affordance appears, the
  // RendererHeader (Present button) is gone, and the Console is NOT rendered.
  const exitBtn = page.locator('[data-testid="preview-fullscreen"]');
  await expect(exitBtn).toBeVisible();
  await expect(page.locator('[data-testid="renderer-present"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="console"]')).toHaveCount(0);
  // The fullscreen overlay covers the viewport (editor sits behind it). The diagram
  // still renders inside the iframe in the expanded surface.
  await expect(mountLocator(page).locator('svg').first()).toBeVisible({
    timeout: 15_000,
  });

  // Exit restores the normal split: Present button + console band return, Exit gone.
  await exitBtn.click();
  await expect(exitBtn).toHaveCount(0);
  await expect(page.locator('[data-testid="renderer-present"]')).toBeVisible();
  await expect(page.locator('[data-testid="console"]')).toBeVisible();
  await expect(page.locator('[data-testid="editor-region"]')).toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// PRV-2: Debug console opens/closes and shows render output ("No issues" / entries).
// ──────────────────────────────────────────────────────────────────────────────
test('PRV-2: Console toggles open/closed and shows a clean-render status', async ({
  page,
}) => {
  const consoleBand = page.locator('[data-testid="console"]');
  await expect(consoleBand).toBeVisible();

  // The status pill reflects render output. A clean sample render reads "No issues"
  // (Console.tsx: clean ⇒ data-clean="true", label "No issues").
  const status = page.locator('[data-testid="console-status"]');
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute('data-clean', 'true', {
    timeout: 15_000,
  });
  await expect(status).toHaveText('No issues');

  // Closed by default: the eval input is only rendered when the console is open.
  const evalInput = page.locator('[data-testid="console-eval"]');
  await expect(evalInput).toHaveCount(0);
  await expect(page.locator('[data-testid="console-toggle"]')).toHaveAttribute(
    'aria-expanded',
    'false',
  );

  // Open it → the eval input appears and aria-expanded flips to true.
  await page.locator('[data-testid="console-toggle"]').click();
  await expect(evalInput).toBeVisible();
  await expect(page.locator('[data-testid="console-toggle"]')).toHaveAttribute(
    'aria-expanded',
    'true',
  );

  // Close it → the eval input is removed again.
  await page.locator('[data-testid="console-toggle"]').click();
  await expect(evalInput).toHaveCount(0);
  await expect(page.locator('[data-testid="console-toggle"]')).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// PRV-3: Ctrl+L clears the console.
// ──────────────────────────────────────────────────────────────────────────────
test('PRV-3: Ctrl+L clears accumulated console entries', async ({ page }) => {
  // Produce entries deterministically by evaluating expressions through the console
  // (each eval echoes its result back as a new entry — see PRV-4). Two evals ⇒ the
  // count grows above zero, giving Ctrl+L something real to clear.
  // Wait for the iframe to be ready first so eval round-trips actually answer.
  await waitPreviewReady(page);
  await page.locator('[data-testid="console-toggle"]').click();
  const evalInput = page.locator('[data-testid="console-eval"]');
  await expect(evalInput).toBeVisible();

  const count = page.locator('[data-testid="console-count"]');
  await evalInput.fill('1 + 1');
  await evalInput.press('Enter');
  await expect(count).toHaveText('1', { timeout: 10_000 });
  await evalInput.fill('2 + 2');
  await evalInput.press('Enter');
  await expect(count).toHaveText('2', { timeout: 10_000 });

  // Ctrl+L (the §11 global shortcut: e.key === 'l' && e.ctrlKey) clears entries.
  // The handler keys on ctrlKey on every platform, so press Control+l on macOS too.
  await page.keyboard.press('Control+l');
  await expect(count).toHaveText('0', { timeout: 10_000 });
});

// ──────────────────────────────────────────────────────────────────────────────
// PRV-4: Console eval runs JS against the preview iframe and echoes a result.
// ──────────────────────────────────────────────────────────────────────────────
test('PRV-4: console eval runs JS in the preview iframe and echoes the result', async ({
  page,
}) => {
  // The iframe bootstrap evaluates the expression with eval() in the srcdoc frame
  // and posts back String(result) (previewBootstrap.runtime.js). That round-trip
  // exercises the srcdoc iframe's script execution; gate it off the staging gate so
  // it self-skips when targeting a remote host (mirrors production-build.spec.js).
  test.skip(
    !!process.env.PW_BASE_URL,
    'console eval runs JS against the local srcdoc iframe; not run on the staging gate',
  );

  // Gate on a rendered SVG: the iframe registers its evalConsole listener only
  // after `ready` fires, so without this the round-trip resolves "timeout" (5s).
  await waitPreviewReady(page);

  await page.locator('[data-testid="console-toggle"]').click();
  const evalInput = page.locator('[data-testid="console-eval"]');
  await expect(evalInput).toBeVisible();

  // Evaluate an arithmetic expression whose result is distinctive and could not be
  // pre-existing console noise (clean sample render starts at "No issues").
  await evalInput.fill('21 * 2');
  await evalInput.press('Enter');

  // The echoed result is appended to the console log AND increments the count.
  // eval() runs in the iframe and posts back String(result) = "42".
  const consoleBand = page.locator('[data-testid="console"]');
  await expect(consoleBand).toContainText('42', { timeout: 10_000 });
  await expect(page.locator('[data-testid="console-count"]')).toHaveText('1', {
    timeout: 10_000,
  });

  // A second expression evaluates against the SAME iframe global scope: assign a
  // var, then read it back — proving eval persists in the frame's window, not a
  // throwaway sandbox per call.
  await evalInput.fill('window.__prvProbe = 7, window.__prvProbe + 1');
  await evalInput.press('Enter');
  await expect(consoleBand).toContainText('8', { timeout: 10_000 });
});

// ──────────────────────────────────────────────────────────────────────────────
// PRV-6: With auto-preview OFF, editing the DSL does NOT re-render until a manual
//        refresh (toggling auto-preview back ON re-fires the render — the only
//        manual re-render trigger in the no-rail UI).
// ──────────────────────────────────────────────────────────────────────────────
// PRODUCT BUG (fixme until wired): this test is a FALSE-GREEN. `settings.autoPreview`
// is never passed to PreviewFrame — the two call sites in AppRoot.tsx (~918 and ~1350)
// omit `autoPreview={settings.autoPreview}`, so PreviewFrame falls back to its default
// `autoPreview=true` (PreviewFrame.tsx:47) and ALWAYS re-renders on the 500ms debounce.
// The Settings toggle is therefore a dead control for rendering: it flips the stored
// setting but never gates the preview. The old assertions happened to pass only because
// they fired inside the debounce window (before the always-on re-render landed) — they
// would pass identically with auto-preview ON, so they prove nothing.
// To enable this test:
//   1. Wire the prop: pass `autoPreview={settings.autoPreview}` to PreviewFrame at
//      AppRoot.tsx ~918 and ~1350 so the toggle actually gates rendering.
//   2. Make the staleness assertion debounce-proof: after editing with auto-preview
//      OFF, wait > PREVIEW_DEBOUNCE (the 500ms PreviewFrame debounce) BEFORE asserting
//      the preview is NOT re-rendered, so a real always-on render would be caught.
test.fixme(
  'PRV-6: with auto-preview OFF, editing does not re-render until auto-preview is re-enabled',
  async ({ page }) => {
    // The render path depends on the iframe's srcdoc evaluating @zenuml/core; assert
    // it against the local app (it works the same against any host the app serves,
    // but the render timing is most stable locally — keep parity with smoke/dsl specs
    // which run on both, so no skip needed here).

    // Step 1 — establish a known baseline render with a distinctive participant.
    const BASELINE = 'PrvBaseline\nUser\nUser->PrvBaseline: before';
    await typeDsl(page, BASELINE);
    await expect(mountLocator(page)).toContainText('PrvBaseline', {
      timeout: 15_000,
    });

    // Step 2 — turn Auto-preview OFF via Settings (the Radix Switch toggles to
    // unchecked). This stops PreviewFrame's debounced re-render effect.
    await openViaHeaderMenu(page, 'header-settings');
    await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible();
    const autoPreviewSwitch = page.locator(
      '[data-testid="setting-autoPreview"]',
    );
    await expect(autoPreviewSwitch).toHaveAttribute('aria-checked', 'true');
    await autoPreviewSwitch.click();
    await expect(autoPreviewSwitch).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="settings-modal"]')).toBeHidden();

    // Step 3 — edit the DSL to a NEW distinctive participant. With auto-preview off,
    // the preview must stay STALE: still showing the baseline, never the new token.
    const EDITED = 'PrvUpdated\nUser\nUser->PrvUpdated: after';
    await typeDsl(page, EDITED);
    await expect(editorLocator(page)).toContainText('PrvUpdated');

    // Give the debounce window time to fire IF it were going to (it must not). Then
    // assert the preview is unchanged: baseline still rendered, new token absent.
    await expect(mountLocator(page)).toContainText('PrvBaseline');
    await expect(mountLocator(page)).not.toContainText('PrvUpdated');

    // Step 4 — manual refresh: re-enable Auto-preview. The PreviewFrame effect's dep
    // array includes `autoPreview`, so flipping it back ON re-posts the render and
    // the preview catches up to the edited DSL.
    await openViaHeaderMenu(page, 'header-settings');
    await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible();
    await autoPreviewSwitch.click();
    await expect(autoPreviewSwitch).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="settings-modal"]')).toBeHidden();

    await expect(mountLocator(page)).toContainText('PrvUpdated', {
      timeout: 15_000,
    });
    await expect(mountLocator(page)).not.toContainText('PrvBaseline', {
      timeout: 15_000,
    });
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// PRV-8: The renderer header shows a 100% zoom indicator.
// ──────────────────────────────────────────────────────────────────────────────
test('PRV-8: the renderer header shows a 100% zoom indicator', async ({
  page,
}) => {
  // RendererHeader renders the zoom label (default "100%") in its right control
  // cluster, immediately before the Present button. There is no testid on the span,
  // so target it structurally: the renderer header is the bar that contains the
  // Present button; the 100% label is the sibling text in that same bar.
  const present = page.locator('[data-testid="renderer-present"]');
  await expect(present).toBeVisible();

  // The zoom label lives in the same header bar (.pv-tools cluster) as Present.
  const header = page
    .locator('[data-testid="renderer-present"]')
    .locator('xpath=ancestor::div[contains(@class,"border-b")][1]');
  await expect(header).toContainText('100%');
});
