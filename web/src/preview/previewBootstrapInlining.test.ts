import { describe, it, expect } from 'vitest';
import viteConfig from '../../vite.config';

// CSP-CRITICAL guard (roadmap §9 M05 finding #1, data-URL regression branch).
//
// The bootstrap is loaded via `<script src=...>` from a `?url` import. Vite inlines
// assets below `build.assetsInlineLimit` (default 4 KB) as `data:` URLs — and a
// `data:` script URL is NOT `'self'` under the packaged MV3 extension's
// `script-src 'self'` CSP, so an inlined bootstrap is CSP-blocked exactly like the
// old inline <script> block and the preview stays blank. The `no inline <script>`
// test in previewHtml.test.ts does NOT catch this (a data-URL still has `src=`),
// so this test pins the build-config decision that forces the bootstrap to emit as
// a REAL same-origin `./assets/*.js` file. Reverting the assetsInlineLimit callback
// (or removing the bootstrap carve-out) → this fails.
describe('vite build inlining policy', () => {
  // The exported config is a UserConfig object (defineConfig returns it as-is here).
  const build = (viteConfig as { build?: { assetsInlineLimit?: unknown } }).build;

  it('uses an assetsInlineLimit callback (not the default numeric threshold)', () => {
    expect(typeof build?.assetsInlineLimit).toBe('function');
  });

  it('forces the preview bootstrap to emit as a real asset (never an inlined data: URL)', () => {
    const fn = build!.assetsInlineLimit as (path: string) => boolean | undefined;
    // The bootstrap MUST NOT be inlined.
    expect(fn('assets/previewBootstrap.runtime-abc123.js')).toBe(false);
    expect(fn('/abs/path/src/preview/previewBootstrap.runtime.js')).toBe(false);
    // Other assets keep the default behavior (undefined → Vite decides).
    expect(fn('assets/some-icon-abc.png')).toBeUndefined();
  });
});
