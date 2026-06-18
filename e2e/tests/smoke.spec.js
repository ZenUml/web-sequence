import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor } from './helpers/hub';

// Smoke: the NEW app (web/) loads, the editor + preview shells are present, and
// the preview iframe's srcdoc carries the @zenuml/core mount point. This proves
// the app boots and the iframe scaffolding is in place — the dsl-spot-check spec
// proves the editor -> postMessage -> @zenuml/core render path renders an SVG.
//
// Editor-as-landing (2026-06-13): bare '/' boots the EDITOR (resume last-code,
// else seed a sample diagram); the HomeView library is opt-in at '/?view=diagrams'.
// openEditor lands on the editor surface either way (a no-op click-through on '/').

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
  // Editor-as-landing: bare '/' boots the editor; openEditor lands on it directly.
  await openEditor(page);
});

test("'/' boots the editor; '/?view=diagrams' renders the HomeView hub @smoke", async ({
  page,
}) => {
  // Editor-as-landing (2026-06-13): bare '/' is the EDITOR surface (the beforeEach
  // already landed there). Assert the editor renders at '/', and that the hub is
  // reachable via the opt-in ?view=diagrams param.
  await page.goto('/');
  await expect(page.locator('[data-testid="dsl-editor"]')).toBeVisible();
  await expect(page.locator('[data-testid="home-view"]')).toHaveCount(0);

  // The hub library is opt-in via ?view=diagrams.
  await page.goto('/?view=diagrams');
  await expect(page.locator('[data-testid="home-view"]')).toBeVisible();
});

test('app loads with editor and preview iframe @smoke', async ({ page }) => {
  await expect(page.locator('[data-testid="dsl-editor"]')).toBeVisible();
  await expect(page.locator('[data-testid="preview-iframe"]')).toBeVisible();
});

test('preview iframe carries the @zenuml/core mounting point @smoke', async ({
  page,
}) => {
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
