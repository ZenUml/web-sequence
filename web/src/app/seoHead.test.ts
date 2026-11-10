// Search engines index app.zenuml.com. Google Search Console reported 559
// "Duplicate without user-selected canonical" URLs (share links such as
// /?code={...}) and Bing reported pages without a meta description.
// These checks keep the static HTML entry points search-friendly.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = resolve(__dirname, '..', '..');
const repoRoot = resolve(webRoot, '..');

function head(file: string): string {
  const html = readFileSync(file, 'utf8');
  return html.slice(0, html.indexOf('</head>'));
}

function canonical(h: string): string | undefined {
  return h.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
}

function description(h: string): string {
  return h.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/)?.[1] ?? '';
}

describe('static HTML head', () => {
  it.each([
    ['web/index.html', resolve(webRoot, 'index.html'), 'https://app.zenuml.com/'],
    ['help.html', resolve(repoRoot, 'help.html'), 'https://app.zenuml.com/help.html'],
  ])('%s has a canonical URL and a meta description', (_name, file, url) => {
    const h = head(file);
    expect(canonical(h)).toBe(url);
    expect(description(h).length).toBeGreaterThanOrEqual(50);
  });
});

describe('firebase hosting redirects', () => {
  it('sends the legacy add-on help page to /help.html with a 301', () => {
    const cfg = JSON.parse(readFileSync(resolve(repoRoot, 'firebase.json'), 'utf8'));
    expect(cfg.hosting.redirects).toContainEqual({
      source: '/ZenUML_Sequence_Diagram_addon_help.html',
      destination: '/help.html',
      type: 301,
    });
  });
});
