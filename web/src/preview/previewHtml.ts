import zenumlUrl from '@zenuml/core/dist/zenuml?url';
// CSP-CRITICAL (roadmap §9 M05 finding #1): load the bootstrap as a same-origin
// emitted asset, NEVER as an inline <script> block. Under the packaged MV3
// extension the default extension-page CSP is `script-src 'self'` (MV3 forbids
// 'unsafe-inline'), and a no-sandbox srcDoc iframe inherits the embedder CSP — so
// an inline bootstrap is blocked and the preview stays blank. An external
// <script src=...> on the same `?url` rail as zenumlUrl is `'self'`-compliant in
// both web and extension contexts.
import bootstrapUrl from './previewBootstrap.runtime.js?url';

// The fixed ZenUML mount structure (ported from legacy computes.js). The DSL is
// NOT inlined — it arrives via `render` postMessages, so the iframe is built
// once and re-rendered by message.
export const MOUNT_HTML =
  '<main id="demo"><div id="diagram"><div id="mounting-point"><seq-diagram></seq-diagram></div></div></main>';

export interface PreviewParts {
  // Kept for signature compatibility; the initial document NEVER bakes css.
  // CSS is pushed via `updateCss` postMessages after the iframe is ready, which
  // also eliminates any `</style>` breakout from interpolating user css here.
  css?: string;
}

export function getCompleteHtml(_parts: PreviewParts = {}): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style id="zenumlstyle"></style>
</head>
<body>
${MOUNT_HTML}
<script src="${zenumlUrl}"></script>
<script src="${bootstrapUrl}"></script>
</body>
</html>`;
}
