import { test, expect } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'fs';

// These tests check the LOCAL web/dist build and hit localhost:PREVIEW_PORT directly.
// They must not run when PW_BASE_URL targets a remote host (staging/prod gate).
test.beforeEach(() => {
  test.skip(
    !!process.env.PW_BASE_URL,
    'production-build checks require a local web/dist build',
  );
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
const DIST = resolve(__dirname, '../../web/dist');
const DIST_ASSETS = resolve(DIST, 'assets');
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}/`;

test('built dist contains a hashed @zenuml/core asset on disk', async () => {
  expect(
    existsSync(DIST_ASSETS),
    `web/dist/assets is missing — run "pnpm -C web build" before this spec.\n${DIST_ASSETS}`,
  ).toBe(true);
  const zenumlAssets = readdirSync(DIST_ASSETS).filter((f) =>
    /^zenuml-.*\.js$/.test(f),
  );
  expect(
    zenumlAssets.length,
    `Expected a hashed assets/zenuml-*.js in the build output (the shim's emitFile).\nFound: ${readdirSync(DIST_ASSETS).join(', ')}`,
  ).toBeGreaterThan(0);
});

// Cutover regression guard (M05): hosting.public → web/dist dropped the legacy
// static pages that the old `app/` assembly served (help.html + help/ assets, and
// the privacy-policy / EULA legal pages). help.html is linked from the in-app
// HelpModal (www → zenuml.com → app.zenuml.com/help.html) and bookmarks; the legal
// pages are linked from the Chrome Web Store / Marketplace listings. All must keep
// 200-ing. The vite copy-legacy-static-pages plugin re-emits them into the build.
test('built dist serves the legacy /help.html page and its assets', async ({
  page,
}) => {
  // (a) help.html + the relatively-referenced help/ assets exist on disk.
  expect(
    existsSync(resolve(DIST, 'help.html')),
    'web/dist/help.html missing — the copy-legacy-static-pages vite plugin regressed (app.zenuml.com/help.html would 404)',
  ).toBe(true);
  for (const asset of [
    'help/stylesheets/screen.css',
    'help/javascripts/all.js',
    'help/images/logo.png',
  ]) {
    expect(
      existsSync(resolve(DIST, asset)),
      `web/dist/${asset} missing — help.html references it relatively`,
    ).toBe(true);
  }

  // (b) it is actually served (200) from the static preview, as Firebase Hosting would.
  const resp = await page.goto(`${PREVIEW_URL}help.html`);
  expect(
    resp?.status(),
    'GET /help.html must return 200 from the built dist',
  ).toBe(200);
  // The slate page's all.js rewrites document.title to "<section> – ZenUML
  // language Reference" on load, so match the stable suffix rather than the exact
  // string.
  await expect(page).toHaveTitle(/ZenUML language Reference$/);
});

// The legal pages (privacy policy + EULA) are linked from external store/
// marketplace listings, so their exact prior URLs must keep resolving. Served at
// their original paths: /privacy-policy/privacy-policy.html (the dir holds no
// index.html) and /End-User-License-Agreement/ (index.html → directory index).
test('built dist serves the legacy privacy-policy and EULA legal pages', async ({
  page,
}) => {
  for (const [file, url, titleRe] of [
    [
      'privacy-policy/privacy-policy.html',
      'privacy-policy/privacy-policy.html',
      /ZenUML Privacy Policy/,
    ],
    [
      'End-User-License-Agreement/index.html',
      'End-User-License-Agreement/',
      /End User License Agreement/i,
    ],
  ]) {
    expect(
      existsSync(resolve(DIST, file)),
      `web/dist/${file} missing — copy-legacy-static-pages regressed (the listing URL would 404)`,
    ).toBe(true);
    const resp = await page.goto(`${PREVIEW_URL}${url}`);
    expect(
      resp?.status(),
      `GET /${url} must return 200 from the built dist`,
    ).toBe(200);
    await expect(page.locator('body')).toContainText(
      titleRe instanceof RegExp ? titleRe : String(titleRe),
    );
  }
});

// Cutover regression guard: the rewrite shipped with NO favicon link (empty tab
// icon, /favicon.ico 404) and no web manifest. This asserts the canonical favicon
// + the PWA manifest and every icon it declares are served 200 from the built dist.
test('built dist serves the favicon and a valid PWA manifest with resolvable icons', async ({
  page,
}) => {
  // index.html must link the favicon + manifest (browsers fetch /favicon.ico
  // otherwise → empty tab icon, the original regression).
  const html = readFileSync(resolve(DIST, 'index.html'), 'utf8');
  expect(html, 'built index.html lost its favicon <link rel="icon">').toMatch(
    /rel="icon"/,
  );
  expect(html, 'built index.html lost its <link rel="manifest">').toMatch(
    /rel="manifest"/,
  );

  // The manifest is served, valid, and every icon it declares resolves 200.
  const manifestResp = await page.goto(`${PREVIEW_URL}manifest.webmanifest`);
  expect(manifestResp?.status(), 'GET /manifest.webmanifest must be 200').toBe(
    200,
  );
  const manifest = JSON.parse(await manifestResp.text());
  expect(manifest.icons.length, 'manifest declares no icons').toBeGreaterThan(
    0,
  );
  // A real installable PWA needs 192 + 512 PNG icons.
  const pngSizes = manifest.icons
    .filter((i) => i.type === 'image/png')
    .map((i) => i.sizes);
  expect(pngSizes).toEqual(expect.arrayContaining(['192x192', '512x512']));

  for (const icon of manifest.icons) {
    const r = await page.goto(`${PREVIEW_URL}${icon.src.replace(/^\//, '')}`);
    expect(r?.status(), `manifest icon ${icon.src} must resolve 200`).toBe(200);
  }
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
  expect(
    coreAssetStatus,
    'Expected the zenuml-*.js core asset to be requested',
  ).not.toBeNull();
  expect(coreAssetStatus).toBe(200);
});
