import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readStoredAppearance } from './appearance';

const webRoot = resolve(import.meta.dirname, '../..');
const html = readFileSync(resolve(webRoot, 'index.html'), 'utf8');
const css = readFileSync(resolve(webRoot, 'public/first-paint.css'), 'utf8');
const bootstrap = readFileSync(resolve(webRoot, 'public/first-paint.js'), 'utf8');

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.appearance;
});

describe('first paint appearance', () => {
  it('loads render-blocking CSS and a CSP-safe classic script in the head before the app module', () => {
    expect(html).toMatch(/<link[^>]+href="%BASE_URL%first-paint\.css"[^>]*>/);
    expect(html).toMatch(/<script src="%BASE_URL%first-paint\.js"><\/script>/);
    expect(html.indexOf('first-paint.js')).toBeLessThan(html.indexOf('first-paint.css'));
    expect(html.indexOf('first-paint.js')).toBeLessThan(html.indexOf('</head>'));
    expect(html.indexOf('first-paint.js')).toBeLessThan(html.indexOf('src="/src/main.tsx"'));
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
  });

  it.each([
    [JSON.stringify('dark'), 'dark'],
    [JSON.stringify('light'), 'light'],
    [null, 'light'],
    ['"system"', 'light'],
    ['{bad json', 'light'],
  ] as const)('sets the same appearance as the settings reader for %s', (stored, expected) => {
    if (stored !== null) window.localStorage.setItem('appearance', stored);
    new Function('window', 'document', bootstrap)(window, document);
    expect(document.documentElement.dataset.appearance).toBe(expected);
    expect(readStoredAppearance()).toBe(expected);
  });

  it('covers the initial html, body and app canvas in both appearances', () => {
    expect(css).toMatch(/html,\s*body,\s*#app\s*\{[^}]*background[^}]*#eff6fb/s);
    expect(css).toMatch(/:root\[data-appearance=['"]dark['"]\][^{]*\{[^}]*background[^}]*#303944/s);
    expect(css).toMatch(/color-scheme:\s*dark/);
  });
});
