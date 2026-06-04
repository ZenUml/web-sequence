import { test, expect } from '@playwright/test';

// Regression guard for a deploy-only class of bug: the @zenuml/core UMD bundle
// was referenced from a Vite dev-only `/@fs/<abs path>` URL (see the
// zenuml-core-asset-url-shim in vite.config.js). That URL works under `pnpm dev`
// (the dev server serves /@fs/) but 404s in any deployed/static build, so the
// diagram silently fails to render in production while every dev-server test
// stays green.
//
// This suite must run against the STATIC production build, not the dev server:
//
//   pnpm build && PW_PROD_BUILD=1 pnpm exec playwright test production-build
//
// PW_PROD_BUILD=1 makes playwright.config serve `dist/` with a plain static
// server, which 404s /@fs/ paths exactly like Firebase Hosting.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('loginAndsaveMessageSeen', 'true');
  });
});

test('built app requests no dev-only /@fs/ asset path', async ({ page }) => {
  const fsFailures = [];
  page.on('response', (r) => {
    if (r.url().includes('/@fs/') && r.status() >= 400) {
      fsFailures.push(`${r.status()} ${r.url()}`);
    }
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes('/@fs/')) fsFailures.push(`failed ${r.url()}`);
  });

  await page.goto('/');
  // Give the preview iframe time to request its bundle.
  await page.waitForTimeout(3000);

  expect(
    fsFailures,
    `Built app must not depend on dev-only /@fs/ paths (they 404 once deployed):\n${fsFailures.join('\n')}`,
  ).toEqual([]);
});

test('built app renders the @zenuml/core diagram (SVG)', async ({ page }) => {
  await page.goto('/');
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            !!document.getElementById('demo-frame')?.contentDocument?.querySelector('svg'),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
});

test('built app loads the @zenuml/core UMD bundle into the iframe', async ({ page }) => {
  await page.goto('/');
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => typeof document.getElementById('demo-frame')?.contentWindow?.zenuml,
        ),
      { timeout: 15_000 },
    )
    .not.toBe('undefined');
});
