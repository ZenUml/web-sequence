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

  it('action icons and top-level icons reference the build-copied icon files', () => {
    const iconFiles = ['icon-16.png', 'icon-48.png', 'favicon-128x128.png'];
    expect(Object.values(manifest.icons)).toEqual(iconFiles);
    expect(Object.values(manifest.action.default_icon)).toEqual(iconFiles);
  });
});
