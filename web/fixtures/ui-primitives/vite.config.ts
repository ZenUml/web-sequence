import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(dir, '../..');

// Isolated from the app dev server (port 3000) and the user's preview (port 4411).
// Cache stays in the worktree, not in node_modules.
export default defineConfig({
  root: dir,
  cacheDir: resolve(webRoot, '.cache/ui-primitives-vite'),
  plugins: [react()],
  css: { postcss: resolve(webRoot, 'postcss.config.js') },
  server: {
    host: '127.0.0.1',
    port: 4473,
    strictPort: true,
  },
});
