import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, cpSync, existsSync } from 'fs';
import { assetsInlineLimit } from './src/preview/assetInlining';
import { configDefaults } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

// Resolves `import '@zenuml/core/dist/zenuml?url'` — dev returns /@fs/<abs>,
// build emits a hashed asset (a /@fs/ URL 404s once served statically).
// Verified against the legacy vite.config.js; asset check in Task 14 / M01.
let zenumlShimIsBuild = false;
const zenumlAssetUrlShim = {
  name: 'zenuml-core-asset-url-shim',
  enforce: 'pre' as const,
  configResolved(config: { command: string }) {
    zenumlShimIsBuild = config.command === 'build';
  },
  resolveId(source: string) {
    return source === '@zenuml/core/dist/zenuml?url'
      ? '\0zenuml-core-asset-url'
      : null;
  },
  load(this: any, id: string) {
    if (id !== '\0zenuml-core-asset-url') return null;
    const filePath = resolve(
      __dirname,
      'node_modules/@zenuml/core/dist/zenuml.js',
    );
    if (zenumlShimIsBuild) {
      const ref = this.emitFile({
        type: 'asset',
        name: 'zenuml.js',
        source: readFileSync(filePath),
      });
      return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
    }
    return `export default ${JSON.stringify('/@fs' + filePath)};`;
  },
};

// The M05 cutover repointed Firebase hosting.public from the legacy `app/`
// assembly to `web/dist`. The legacy build copied a handful of static pages into
// app/, served at app.zenuml.com/<page>; the cutover dropped them (now 404):
//   help.html (+ help/ assets) — in-app HelpModal link (www → zenuml.com →
//     app.zenuml.com/help.html) and external bookmarks. help.html references
//     help/stylesheets, help/images, help/javascripts relatively, so the whole
//     help/ dir ships with it.
//   privacy-policy/ (privacy-policy.html) and End-User-License-Agreement/
//     (index.html) — legal pages linked from the Chrome Web Store / Marketplace
//     listings (no in-app link), so they must keep resolving at their prior URLs.
// Copy the repo-root sources into dist at build time (the root files stay the
// single source of truth — no duplication into web/public/). Regression-guarded
// by e2e/tests/production-build.spec.js. Build-only; runs after the bundle is
// written (emptyOutDir has already run, so nothing clobbers these). cpSync copies
// files and directories alike (recursive).
const LEGACY_STATIC_PAGES = [
  'help.html',
  'help',
  'privacy-policy',
  'End-User-License-Agreement',
];
const copyLegacyStaticPages = {
  name: 'copy-legacy-static-pages',
  apply: 'build' as const,
  closeBundle() {
    const repoRoot = resolve(__dirname, '..');
    const outDir = resolve(__dirname, 'dist');
    for (const entry of LEGACY_STATIC_PAGES) {
      const src = resolve(repoRoot, entry);
      if (existsSync(src))
        cpSync(src, resolve(outDir, entry), { recursive: true });
    }
  },
};

const FN = 'http://127.0.0.1:5002/staging-zenuml-27954/us-central1';
// Rewrite path → function id while PRESERVING the query string (and any path
// suffix), matching the legacy vite.config.js `path.replace(...)` rewrites. This
// matters for GET /get-shared-item?id=…&share-token=… — a bare `() => '/fn'`
// would drop the query and break dev share-loading.
const proxy = (path: string, fn: string) => ({
  target: FN,
  changeOrigin: true,
  rewrite: (p: string) => p.replace(path, `/${fn}`),
});

export default defineConfig({
  plugins: [zenumlAssetUrlShim, copyLegacyStaticPages, react()],
  // Conventional layout: root = web/ (this dir), index.html at web/index.html,
  // source under web/src, build output to web/dist. (Differs from the legacy
  // app's root:'src' quirk — this is a clean self-contained project.)
  // publicDir defaults to web/public (created when static assets — favicons,
  // fonts — are migrated from the legacy ../static in a later milestone).
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    // CSP-CRITICAL (roadmap §9 M05 finding #1): keep the preview bootstrap a real
    // emitted asset (never an inlined data: URL) so it is `'self'` under MV3 CSP.
    // Policy + rationale live in src/preview/assetInlining.ts (unit-tested).
    assetsInlineLimit,
  },
  define: { __COMMITHASH__: JSON.stringify(getCommitHash()) },
  css: { postcss: './postcss.config.js' },
  server: {
    host: true,
    port: 3000,
    // Pin the port so Playwright's webServer URL is deterministic — without this,
    // Vite silently falls back to the next free port and the E2E run never finds
    // the dev server at :3000 (see repo-root playwright.config.js).
    strictPort: true,
    proxy: {
      '/create-share': proxy('/create-share', 'create_share'),
      '/get-shared-item': proxy('/get-shared-item', 'get_shared_item'),
      '/sync-diagram': proxy('/sync-diagram', 'sync_diagram'),
      '/authenticate': proxy('/authenticate', 'authenticate'),
      '/track': proxy('/track', 'track'),
      '/info': proxy('/info', 'info'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // The Playwright e2e suite lives under e2e/ and imports '@playwright/test'.
    // Vitest's default include matches **/*.spec.ts, so without this exclude
    // `vitest run` (yarn test) would collect e2e/editor-language.spec.ts and
    // crash on the Playwright import. Spread configDefaults.exclude so we keep
    // node_modules/dist/etc. excluded (replacing it would silently re-enable them).
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
} as any);
