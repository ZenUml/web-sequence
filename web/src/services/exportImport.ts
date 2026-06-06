import { migrateToPages } from '../domain/item';
import type { Item } from '../domain/types';

export function exportAllItemsJson(items: Item[]): string {
  return JSON.stringify({ items }, null, 2);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Accepts: Item[] | { items: Item[] } | { items: Record<string,Item> } | a single Item.
export function parseImportJson(text: string): Item[] {
  const raw = JSON.parse(text); // throws on invalid JSON — intentional
  let list: unknown[];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === 'object' && 'items' in raw) {
    const items = (raw as { items: unknown }).items;
    list = Array.isArray(items) ? items : Object.values(items as Record<string, unknown>);
  } else {
    list = [raw];
  }
  return list
    .filter((x): x is Item => !!x && typeof x === 'object')
    .map((it) => migrateToPages(it as Item));
}

// Produces a self-contained HTML file embedding the diagram DSL (REQ-LIB-8).
//
// NOTE: The live app preview (previewHtml.ts / previewBootstrap.ts) uses a
// bundled @zenuml/core asset injected via <script src="…?url"> inside an
// srcdoc iframe with a postMessage render protocol — that approach requires a
// running asset server and is NOT suitable for a portable standalone file.
// Legacy src/utils.js getCompleteHtml() similarly references a bundled local
// zenumlUrl asset.
//
// For a truly self-contained export we load @zenuml/core from jsDelivr CDN and
// instantiate it directly (no postMessage). The CDN bootstrap below mirrors
// previewBootstrap.ts: mount-point id, `new window.zenuml.default(…)`, and
// `app.render(code)`. Parity-check: confirm the published CDN build exports a
// `default` constructor and renders via `.render(code)` (same as previewBootstrap).
export function buildStandaloneHtml(item: Item): string {
  const title = escapeHtml(item.title || 'ZenUML Diagram');
  const dsl = escapeHtml(item.js || '');
  const css = item.css || '';

  // Mount structure mirrors previewHtml.ts MOUNT_HTML (id="mounting-point").
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style id="zenumlstyle">${css}</style>
</head>
<body>
<main id="demo"><div id="diagram"><div id="mounting-point"><seq-diagram></seq-diagram></div></div></main>
<pre id="zenuml-dsl" style="display:none">${dsl}</pre>
<script src="https://cdn.jsdelivr.net/npm/@zenuml/core/dist/zenuml.js"></script>
<script>
window.addEventListener('load', function () {
  try {
    var code = document.getElementById('zenuml-dsl').textContent;
    var app = new window.zenuml.default('#mounting-point');
    app.render(code, { enableMultiTheme: false, theme: 'theme-default' });
  } catch (e) {
    document.body.insertAdjacentHTML('beforeend',
      '<pre style="color:red">ZenUML render error: ' + e.message + '</pre>');
  }
});
</script>
</body>
</html>`;
}
