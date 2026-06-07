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
  // M05 embed: suppress @zenuml/core's interactive chrome (info/tip button, theme
  // settings, numbering checkbox, version, zoom controls, brand watermark, privacy
  // shield) when the preview is rendered inside an `?embed` host. We do this WITHOUT
  // patching @zenuml/core by display:none-ing its own DOM hooks from inside the
  // isolated srcdoc iframe.
  embed?: boolean;
}

// Embed-only chrome suppression. Targets @zenuml/core's rendered DOM hooks:
//   .footer        — info/tip button, theme settings, numbering checkbox, version
//                    string, zoom controls (+/100%/−), and the "ZenUML.com" brand
//                    watermark are ALL children of this one container.
//   .header .hide-export — the privacy/shield icon lives in the header's right slot
//                    and carries `hide-export`; the title (no `hide-export`) is left
//                    untouched so an embedded diagram still shows its title.
// `!important` wins unconditionally against core's utility classes. Baked into the
// srcdoc (not pushed via updateCss) so there is no chrome flash on first paint and
// the user-CSS rail (`#zenumlstyle`) stays clean.
export const EMBED_CHROME_SUPPRESS_CSS =
  '.footer{display:none !important}.header .hide-export{display:none !important}';

export function getCompleteHtml(parts: PreviewParts = {}): string {
  const embedStyle = parts.embed
    ? `<style id="zenuml-embed-suppress">${EMBED_CHROME_SUPPRESS_CSS}</style>`
    : '';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style id="zenumlstyle"></style>
${embedStyle}</head>
<body>
${MOUNT_HTML}
<script src="${zenumlUrl}"></script>
<script src="${bootstrapUrl}"></script>
</body>
</html>`;
}
