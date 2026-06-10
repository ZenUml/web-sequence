import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor } from './helpers/hub';

// Smoke: the NEW app (web/) loads, the editor + preview shells are present, and
// the preview iframe's srcdoc carries the @zenuml/core mount point. This proves
// the app boots and the iframe scaffolding is in place — the dsl-spot-check spec
// proves the editor -> postMessage -> @zenuml/core render path renders an SVG.
//
// Hub (PRs #800/#801): '/' renders the HomeView library, not the editor — the
// editor smokes click through the hub's New CTA via openEditor().

// Deployed sites (staging/prod, reached via PW_BASE_URL) load third-party
// analytics/CDN scripts (GTM, Cloudflare Zaraz, Clarity, Paddle) that throw
// their own uncaught errors we neither own nor can fix. Treat those as noise;
// genuine app errors still fail the test. Locally there are no such scripts.
const THIRD_PARTY_ERROR_SOURCES = [
  'userscript.js', // Cloudflare Zaraz wraps third-party tools in userscript.js
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
  // Fail the test on genuine uncaught app errors, except known third-party noise.
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });
  await suppressOneTimeModals(page); // M04: keep onboarding/pledge from trapping focus
  // Hub: '/' is the HomeView library; reach the editor through the New CTA.
  await openEditor(page);
});

test("'/' renders the HomeView hub library @smoke", async ({ page }) => {
  // Hub (PRs #800/#801): bare '/' is the library page. Re-navigate there (the
  // beforeEach clicked through into the editor) and assert the hub surface.
  await page.goto('/');
  await expect(page.locator('[data-testid="home-view"]')).toBeVisible();
});

test('app loads with editor and preview iframe @smoke', async ({ page }) => {
  await expect(page.locator('[data-testid="dsl-editor"]')).toBeVisible();
  await expect(page.locator('[data-testid="preview-iframe"]')).toBeVisible();
});

test('preview iframe carries the @zenuml/core mounting point @smoke', async ({ page }) => {
  // CodeMirror 6 editable surface is mounted and editable. Hub (PRs #800/#801):
  // the hub's New CTA seeds a BLANK diagram by design (handleNewDiagramFromHome
  // loads js: ''), so the old "shows non-empty default text" assertion no longer
  // matches the product — the DEFAULT_STARTER text now only appears via the
  // in-editor New action (covered by persistence.spec.js test 3).
  const editorContent = page.locator('[data-testid="dsl-editor"] .cm-content');
  await expect(editorContent).toBeVisible();
  await expect(editorContent).toHaveAttribute('contenteditable', 'true');

  // The preview is a srcdoc iframe; #mounting-point is the fixed scaffold that
  // @zenuml/core renders into. Assert it is ATTACHED (an empty mount div can be
  // zero-size before the SVG lands, so visibility would flake here).
  const mount = page
    .frameLocator('[data-testid="preview-iframe"]')
    .locator('#mounting-point');
  await expect(mount).toBeAttached({ timeout: 15_000 });
});
