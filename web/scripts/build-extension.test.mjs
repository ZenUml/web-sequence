import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  assembleExtension, relativizeAssetRefs, stampManifestVersion,
} from './build-extension.mjs';
import { APP_VERSION } from '../src/config/constants.ts';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const EXT_SRC = resolve(__dirname, '../extension-src'); // the REAL extension assets

let tmp, distDir, iconsDir, outDir;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'ext-build-'));
  distDir = join(tmp, 'dist');
  iconsDir = join(tmp, 'icons');
  outDir = join(tmp, 'extension');
  mkdirSync(join(distDir, 'assets'), { recursive: true });
  mkdirSync(iconsDir, { recursive: true });
  // A fake built SPA with an ABSOLUTE asset ref (so relativize has something to fix).
  writeFileSync(
    join(distDir, 'index.html'),
    '<!doctype html><html><head><script type="module" src="/assets/main.js"></script>'
    + '<link rel="stylesheet" href="/assets/main.css"></head><body></body></html>',
  );
  writeFileSync(join(distDir, 'assets', 'main.js'), 'console.log(1)');
  // Fake icons matching the manifest's references.
  for (const icon of ['icon-16.png', 'icon-48.png', 'favicon-128x128.png']) {
    writeFileSync(join(iconsDir, icon), 'PNG');
  }
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('stampManifestVersion', () => {
  it('overwrites the version without mutating the input', () => {
    const input = { name: 'X', version: '0.0.0', permissions: ['storage'] };
    const out = stampManifestVersion(input, '9.9.9');
    expect(out.version).toBe('9.9.9');
    expect(input.version).toBe('0.0.0'); // pure: input untouched
    expect(out.permissions).toEqual(['storage']);
  });
});

describe('relativizeAssetRefs', () => {
  it('rewrites absolute /assets/ refs to ./assets/ (chrome-extension:// safety)', () => {
    const html = '<script src="/assets/a.js"></script><link href="/assets/a.css">';
    const out = relativizeAssetRefs(html);
    expect(out).toContain('src="./assets/a.js"');
    expect(out).toContain('href="./assets/a.css"');
    expect(out).not.toMatch(/(src|href)="\/assets\//);
  });
});

describe('assembleExtension', () => {
  it('produces a complete, version-stamped, relative-asset extension package', () => {
    const files = assembleExtension({
      distDir, extSrcDir: EXT_SRC, iconsDir, outDir, version: APP_VERSION,
    });

    // All required top-level files present.
    for (const f of [
      'manifest.json', 'eventPage.js', 'options.html', 'options.js', 'index.html',
      'icon-16.png', 'icon-48.png', 'favicon-128x128.png',
    ]) {
      expect(files).toContain(f);
    }

    // The manifest version is stamped from APP_VERSION (single source of truth).
    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8'));
    expect(manifest.version).toBe(APP_VERSION);
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background.service_worker).toBe('eventPage.js');

    // MV3 loads a service worker WITHOUT background.type as a CLASSIC script, and a
    // classic script with a top-level `export` is a parse-time SyntaxError that kills
    // worker registration. eventPage.js keeps ESM exports (deliberately, so the unit
    // test can drive its handlers — same reasoning as options.html's type="module").
    // So the invariant that must hold in the ASSEMBLED package: if the worker source
    // has a top-level `export`, the manifest MUST declare the worker as a module.
    const workerSrc = readFileSync(join(outDir, 'eventPage.js'), 'utf8');
    const hasTopLevelExport = /^export\s/m.test(workerSrc);
    if (hasTopLevelExport) {
      expect(manifest.background.type).toBe('module');
    }

    // The packaged index.html uses RELATIVE asset refs (loads under chrome-extension://).
    const indexHtml = readFileSync(join(outDir, 'index.html'), 'utf8');
    expect(indexHtml).toContain('./assets/main.js');
    expect(indexHtml).not.toMatch(/(src|href)="\/assets\//); // no leading-slash refs

    // The SPA bundle itself is copied through.
    expect(readFileSync(join(outDir, 'assets', 'main.js'), 'utf8')).toBe('console.log(1)');
  });

  it('throws if a manifest-referenced icon is missing (no silent partial package)', () => {
    rmSync(join(iconsDir, 'icon-16.png'));
    expect(() =>
      assembleExtension({ distDir, extSrcDir: EXT_SRC, iconsDir, outDir, version: APP_VERSION }),
    ).toThrow(/missing icon/);
  });

  it('throws if the built dist is missing (fail fast, no empty zip)', () => {
    expect(() =>
      assembleExtension({ distDir: join(tmp, 'nope'), extSrcDir: EXT_SRC, iconsDir, outDir, version: APP_VERSION }),
    ).toThrow(/distDir missing/);
  });
});
