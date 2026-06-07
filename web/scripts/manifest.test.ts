import { describe, it, expect } from 'vitest';
import manifest from '../extension-src/manifest.json';
import { APP_VERSION } from '../src/config/constants';

describe('extension manifest (MV3)', () => {
  it('is manifest v3 with storage-only permission', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(['storage']);
  });

  it('declares the background service worker, action, options page, and icons', () => {
    expect(manifest.background.service_worker).toBe('eventPage.js');
    expect(manifest.action).toBeDefined();
    expect(manifest.options_ui.page).toBe('options.html');
    expect(manifest.icons).toBeDefined();
  });

  it('source version matches APP_VERSION (build script re-stamps the copy)', () => {
    expect(manifest.version).toBe(APP_VERSION);
  });

  // The Chrome Web Store compares versions as dot-separated INTEGER tuples and
  // rejects any upload whose version is not strictly greater than the published
  // one. The legacy extension published 2026.6.4 (static/manifest.json), so the
  // rewrite's APP_VERSION must be a strictly-greater tuple or `yarn pub` fails.
  it('APP_VERSION is strictly greater than the published store version 2026.6.4', () => {
    const PUBLISHED = [2026, 6, 4];
    const current = APP_VERSION.split('.').map(Number);
    expect(current.every((n) => Number.isInteger(n))).toBe(true);
    const cmp = (a: number[], b: number[]): number => {
      const len = Math.max(a.length, b.length);
      for (let i = 0; i < len; i++) {
        const d = (a[i] ?? 0) - (b[i] ?? 0);
        if (d !== 0) return d < 0 ? -1 : 1;
      }
      return 0;
    };
    expect(cmp(current, PUBLISHED)).toBe(1);
  });

  it('action icons and top-level icons reference the build-copied icon files', () => {
    const iconFiles = ['icon-16.png', 'icon-48.png', 'favicon-128x128.png'];
    expect(Object.values(manifest.icons)).toEqual(iconFiles);
    expect(Object.values(manifest.action.default_icon)).toEqual(iconFiles);
  });
});
