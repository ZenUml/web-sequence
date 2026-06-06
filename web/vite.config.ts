import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

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
    return source === '@zenuml/core/dist/zenuml?url' ? '\0zenuml-core-asset-url' : null;
  },
  load(this: any, id: string) {
    if (id !== '\0zenuml-core-asset-url') return null;
    const filePath = resolve(__dirname, 'node_modules/@zenuml/core/dist/zenuml.js');
    if (zenumlShimIsBuild) {
      const ref = this.emitFile({ type: 'asset', name: 'zenuml.js', source: readFileSync(filePath) });
      return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
    }
    return `export default ${JSON.stringify('/@fs' + filePath)};`;
  },
};

const FN = 'http://127.0.0.1:5002/staging-zenuml-27954/us-central1';
const proxy = (fn: string) => ({ target: FN, changeOrigin: true, rewrite: () => `/${fn}` });

export default defineConfig({
  plugins: [zenumlAssetUrlShim, react()],
  // Conventional layout: root = web/ (this dir), index.html at web/index.html,
  // source under web/src, build output to web/dist. (Differs from the legacy
  // app's root:'src' quirk — this is a clean self-contained project.)
  publicDir: 'public',
  build: { outDir: 'dist', emptyOutDir: true, assetsDir: 'assets' },
  define: { __COMMITHASH__: JSON.stringify(getCommitHash()) },
  css: { postcss: './postcss.config.js' },
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/create-share': proxy('create_share'),
      '/get-shared-item': proxy('get_shared_item'),
      '/sync-diagram': proxy('sync_diagram'),
      '/authenticate': proxy('authenticate'),
      '/track': proxy('track'),
      '/info': proxy('info'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
} as any);
