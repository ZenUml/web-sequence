import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';
import base from '../../vite.config';

const dir = dirname(fileURLToPath(import.meta.url));

// Keeps Vitest's optimizer cache out of the shared node_modules/.vite directory.
export default mergeConfig(
  base,
  defineConfig({
    root: resolve(dir, '../..'),
    cacheDir: resolve(dir, '../../.cache/ui-primitives-vitest'),
  }),
);
