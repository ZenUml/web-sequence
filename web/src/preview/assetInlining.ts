// CSP-CRITICAL (roadmap §9 M05 finding #1): the preview-iframe bootstrap is loaded
// via `<script src=...>` from a `?url` import. Vite inlines assets below
// `build.assetsInlineLimit` (default 4 KB) as `data:` URLs — but a `data:` script
// URL is NOT `'self'` under the packaged MV3 extension's `script-src 'self'` CSP, so
// an inlined bootstrap is CSP-blocked exactly like the old inline <script> block and
// the preview stays blank. This callback forces the bootstrap to emit as a REAL
// same-origin `./assets/*.js` file; everything else keeps Vite's default behavior.
//
// Lives in src/ (not vite.config.ts) so it is unit-testable without importing the
// Vite config (which sits in a separate tsconfig project). Used by vite.config.ts.
export function assetsInlineLimit(filePath: string): boolean | undefined {
  return filePath.includes('previewBootstrap.runtime') ? false : undefined;
}
