import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig, type Plugin } from 'vite';
import base from '../../vite.config';

const dir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(dir, '../..');

// Verification build only. Drops the legacy static-page plugin because that
// plugin always writes web/dist, which is outside this isolated outDir.
const plugins = ((base.plugins ?? []) as Plugin[]).filter(
  (plugin) => plugin?.name !== 'copy-legacy-static-pages',
);

export default mergeConfig(
  base,
  defineConfig({
    root: webRoot,
    cacheDir: resolve(webRoot, '.cache/ui-primitives-app-vite'),
    plugins,
    build: {
      outDir: resolve(webRoot, '.cache/ui-primitives-dist'),
      emptyOutDir: true,
    },
  }),
);
