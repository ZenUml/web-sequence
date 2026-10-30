// Out-of-tree wrapper: this worktree's web/node_modules is a symlink into the
// editor-core worktree, so Vite's fs guard denies ?url imports. Widen fs.allow only.
import base from '/Users/pengxiao/.codex/worktrees/share-visitor-claude/web-sequence/web/vite.config.ts';
const b: any = base;
export default {
  ...b,
  root: '/Users/pengxiao/.codex/worktrees/share-visitor-claude/web-sequence/web',
  // Task-local cache: node_modules is a symlink into a sibling worktree, so the
  // default node_modules/.vite would write there.
  cacheDir: '/tmp/share-status-cfg/vite-cache',
  server: { ...(b.server ?? {}), fs: { ...(b.server?.fs ?? {}), strict: false, allow: ['/Users/pengxiao/.codex/worktrees'] } },
};
