import zenumlUrl from '@zenuml/core/dist/zenuml?url';
import { PREVIEW_BOOTSTRAP } from './previewBootstrap';

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
<script>
${PREVIEW_BOOTSTRAP}
</script>
</body>
</html>`;
}
