import { describe, it, expect } from 'vitest';
import { assetsInlineLimit } from './assetInlining';

// CSP-CRITICAL guard (roadmap §9 M05 finding #1, data-URL regression branch).
//
// The bootstrap is loaded via `<script src=...>` from a `?url` import. Vite inlines
// assets below `build.assetsInlineLimit` (default 4 KB) as `data:` URLs — and a
// `data:` script URL is NOT `'self'` under the packaged MV3 extension's
// `script-src 'self'` CSP, so an inlined bootstrap is CSP-blocked exactly like the
// old inline <script> block and the preview stays blank. The `no inline <script>`
// test in previewHtml.test.ts does NOT catch this (a data-URL still has `src=`),
// so this test pins the policy that forces the bootstrap to emit as a REAL
// same-origin `./assets/*.js` file. Reverting the carve-out → this fails.
describe('assetsInlineLimit (vite build inlining policy)', () => {
  it('forces the preview bootstrap to emit as a real asset (never an inlined data: URL)', () => {
    expect(assetsInlineLimit('assets/previewBootstrap.runtime-abc123.js')).toBe(false);
    expect(assetsInlineLimit('/abs/path/src/preview/previewBootstrap.runtime.js')).toBe(false);
  });

  it('leaves other assets to Vite default behavior (undefined)', () => {
    expect(assetsInlineLimit('assets/some-icon-abc.png')).toBeUndefined();
    expect(assetsInlineLimit('assets/zenuml-abc.js')).toBeUndefined();
  });
});
