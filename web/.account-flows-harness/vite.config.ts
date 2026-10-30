// Private harness config for the account-flows worker. NOT product config.
// - cacheDir / build.outDir live under this folder so the shared (symlinked)
//   node_modules/.vite cache used by other worktrees is never written.
// - Dev port 4517 (strict) — never 4411.
// - Drops the build-only copy-legacy-static-pages plugin (it hardcodes web/dist).
import { mergeConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { realpathSync } from 'fs';
import base from '../vite.config';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
// node_modules is a symlink into another worktree; allow its realpath (read-only).
const depsReal = realpathSync(resolve(webRoot, 'node_modules'));

const plugins = ((base as any).plugins ?? []).filter(
  (p: any) => p && p.name !== 'copy-legacy-static-pages',
);

export default mergeConfig(
  { ...(base as any), plugins },
  {
    root: webRoot,
    cacheDir: resolve(here, '.cache/vite'),
    build: { outDir: resolve(here, '.out/dist'), emptyOutDir: true },
    server: { port: 4517, strictPort: true, host: '127.0.0.1', proxy: {}, fs: { allow: [webRoot, depsReal] } },
    test: { root: webRoot },
  },
);
