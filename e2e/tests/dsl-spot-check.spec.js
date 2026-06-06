import { test, expect } from '@playwright/test';

// DSL spot-check: type DSL into the CodeMirror 6 editor of the NEW app and prove
// the full render path works end to end:
//   editor (.cm-content) -> onChange -> postMessage('render') -> @zenuml/core
//   -> <svg> injected into #mounting-point inside the preview iframe.
//
// We deliberately type tokens that are NOT in the default DSL
// ("A.SyncMessage\nA->B: AsyncMessage", see web/src/app/AppRoot.tsx) so a green
// assertion can only come from OUR typed input being rendered — not from the
// default content that would render with zero typing.

const UNIQUE_PARTICIPANT = 'AcmeService';
const UNIQUE_MESSAGE = 'doSpotCheck';
const DSL = `${UNIQUE_PARTICIPANT}\nUser\nUser->${UNIQUE_PARTICIPANT}: ${UNIQUE_MESSAGE}`;

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

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });
  await page.goto('/');
});

test('typed DSL renders an SVG diagram in the preview iframe', async ({ page }) => {
  const editor = page.locator('[data-testid="dsl-editor"] .cm-content');
  await expect(editor).toBeVisible();

  // CodeMirror 6 is a contenteditable surface: click to focus, select-all, then
  // type. fill() is unreliable on contenteditable, so type the replacement.
  await editor.click();
  const selectAll = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';
  await page.keyboard.press(selectAll);
  await page.keyboard.press('Delete');
  await editor.pressSequentially(DSL);

  // Confirm our text actually landed in the editor before asserting the render —
  // otherwise a typing failure would masquerade as a render failure.
  await expect(editor).toContainText(UNIQUE_PARTICIPANT);
  await expect(editor).toContainText(UNIQUE_MESSAGE);

  const frame = page.frameLocator('[data-testid="preview-iframe"]');

  // @zenuml/core injects an <svg> into #mounting-point after the render message.
  // The static <seq-diagram> tag is in the srcdoc from the start, so asserting on
  // the SVG (not seq-diagram) is what actually proves a render happened.
  await expect(frame.locator('#mounting-point svg').first()).toBeVisible({
    timeout: 15_000,
  });

  // The rendered diagram must reflect OUR typed DSL, not the default content.
  await expect(frame.locator('#mounting-point')).toContainText(UNIQUE_PARTICIPANT, {
    timeout: 15_000,
  });
  await expect(frame.locator('#mounting-point')).toContainText(UNIQUE_MESSAGE, {
    timeout: 15_000,
  });
});
