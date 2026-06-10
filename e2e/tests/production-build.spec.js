import { test, expect } from '@playwright/test';
import { existsSync, readdirSync } from 'fs';

// These tests check the LOCAL web/dist build and hit localhost:PREVIEW_PORT directly.
// They must not run when PW_BASE_URL targets a remote host (staging/prod gate).
test.beforeEach(() => {
  test.skip(!!process.env.PW_BASE_URL, 'production-build checks require a local web/dist build');
});
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { PREVIEW_PORT } from '../../playwright.config.js';
import { openEditor } from './helpers/hub.js';

// Production-build asset proof (M00 shim build-path). Runs against the STATIC
// built output (web/dist) served by `vite preview` on PREVIEW_PORT — NOT the dev
// server. The dev server transparently serves Vite /@fs/<abs> URLs, which hides
// the deploy-only bug where the @zenuml/core asset shim bakes a dev-only /@fs/
// path: that URL works under `pnpm dev` but 404s once served statically (Firebase
// Hosting / vite preview). So this spec verifies the BUILT bundle:
//   (a) a hashed assets/zenuml-*.js exists on disk,
//   (b) loading the built app renders the diagram (SVG) from that bundle,
//   (c) no request goes to a dev-only /@fs/ URL, and the core asset returned 200.
//
// Requires `pnpm -C web build` first (the webServer preview entry serves web/dist).

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_ASSETS = resolve(__dirname, '../../web/dist/assets');
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}/`;

test('built dist contains a hashed @zenuml/core asset on disk', async () => {
  expect(
    existsSync(DIST_ASSETS),
    `web/dist/assets is missing — run "pnpm -C web build" before this spec.\n${DIST_ASSETS}`,
  ).toBe(true);
  const zenumlAssets = readdirSync(DIST_ASSETS).filter((f) => /^zenuml-.*\.js$/.test(f));
  expect(
    zenumlAssets.length,
    `Expected a hashed assets/zenuml-*.js in the build output (the shim's emitFile).\nFound: ${readdirSync(DIST_ASSETS).join(', ')}`,
  ).toBeGreaterThan(0);
});

test('built app renders the diagram with no dev-only /@fs/ URL and a 200 core asset', async ({
  page,
}) => {
  const fsRequests = [];
  let coreAssetStatus = null;

  page.on('request', (r) => {
    if (r.url().includes('/@fs/')) fsRequests.push(r.url());
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes('/@fs/')) fsRequests.push(`failed ${r.url()}`);
  });
  page.on('response', (r) => {
    if (/\/assets\/zenuml-.*\.js$/.test(r.url())) coreAssetStatus = r.status();
  });

  // Hub routing: "/" shows the HomeView (library) when no diagram id is in the
  // URL. openEditor (shared helper) clicks through the New CTA so the editor +
  // preview-iframe are present. The request/response listeners above are attached
  // BEFORE this navigation, so the asset assertions still see every request.
  await openEditor(page, { url: PREVIEW_URL });

  // The diagram must render from the BUILT bundle.
  const mount = page
    .frameLocator('[data-testid="preview-iframe"]')
    .locator('#mounting-point svg')
    .first();
  await expect(mount).toBeVisible({ timeout: 15_000 });

  // No dev-only /@fs/ asset URL may be requested (those 404 once deployed).
  expect(
    fsRequests,
    `Built app must not depend on dev-only /@fs/ URLs (they 404 when served statically):\n${fsRequests.join('\n')}`,
  ).toEqual([]);

  // The @zenuml/core asset must have been served successfully (200), proving the
  // built bundle references the emitted hashed asset rather than a broken path.
  expect(coreAssetStatus, 'Expected the zenuml-*.js core asset to be requested').not.toBeNull();
  expect(coreAssetStatus).toBe(200);
});
