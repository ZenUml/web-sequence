import zenumlUrl from '@zenuml/core/dist/zenuml?url';
import { PREVIEW_BOOTSTRAP } from './previewBootstrap';

// The fixed ZenUML mount structure (ported from legacy computes.js). The DSL is
// NOT inlined — it arrives via `render` postMessages, so the iframe is built
// once and re-rendered by message.
export const MOUNT_HTML =
  '<main id="demo"><div id="diagram"><div id="mounting-point"><seq-diagram></seq-diagram></div></div></main>';

export interface PreviewParts {
  css?: string;
}

export function getCompleteHtml(parts: PreviewParts): string {
  const css = parts.css ?? '';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style id="zenumlstyle">
${css}
</style>
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
