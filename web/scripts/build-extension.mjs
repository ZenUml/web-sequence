// M05 Task 11 — build the MV3 extension package: web/dist (the EXACT SPA bundle) +
// web/extension-src (manifest, service worker, options page) + legacy static icons →
// web/extension/ → web/extension.zip (the asset CI attaches to a release).
//
// Self-contained in web/ (parity with the legacy gulpfile.cjs `release` zip flow).
// We only READ the legacy ../static icons (NFR-1: never modify legacy assets).
//
// Caveat (load-bearing): Chrome serves the extension from chrome-extension://<id>/, so
// the packaged SPA MUST use RELATIVE asset paths. The build runs `vite build --base ./`
// for the extension variant; assembleExtension additionally rewrites any leftover
// absolute `/assets/` refs in index.html to `./assets/` as a belt-and-braces guard
// (an absolute `/assets/x.js` 404s under chrome-extension://).

import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(WEB_ROOT, '..');

// ─── Pure helpers (unit-tested in build-extension.test.mjs) ───────────────────

/** Return a new manifest object with `version` stamped from the app version constant. */
export function stampManifestVersion(manifestObj, version) {
  return { ...manifestObj, version };
}

/** Rewrite absolute `/assets/...` refs in an index.html string to relative `./assets/...`. */
export function relativizeAssetRefs(html) {
  // Match src="/assets/…" or href="/assets/…" (single or double quotes).
  return html.replace(/(src|href)=(["'])\/assets\//g, '$1=$2./assets/');
}

/**
 * Assemble the extension package into `outDir`:
 *  - copy the built SPA (distDir/**) — index.html relativized
 *  - copy the MV3 static assets (eventPage.js, options.html, options.js) from extSrcDir
 *  - write manifest.json (version-stamped) from extSrcDir/manifest.json
 *  - copy the icons referenced by the manifest from iconsDir
 *
 * Pure-ish: only touches the filesystem dirs it is given (no Vite, no network), so the
 * test exercises it on a fixture. Returns the list of top-level files written.
 */
export function assembleExtension({ distDir, extSrcDir, iconsDir, outDir, version }) {
  if (!existsSync(distDir)) throw new Error(`assembleExtension: distDir missing: ${distDir}`);
  if (!existsSync(extSrcDir)) throw new Error(`assembleExtension: extSrcDir missing: ${extSrcDir}`);

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // 1. Copy the entire built SPA.
  cpSync(distDir, outDir, { recursive: true });

  // 2. Relativize index.html asset refs (guard against an absolute `/assets/` base).
  const indexPath = join(outDir, 'index.html');
  if (existsSync(indexPath)) {
    writeFileSync(indexPath, relativizeAssetRefs(readFileSync(indexPath, 'utf8')));
  }

  // 3. Copy the MV3 runtime assets (NOT the manifest — that is stamped below).
  for (const f of ['eventPage.js', 'options.html', 'options.js']) {
    const src = join(extSrcDir, f);
    if (!existsSync(src)) throw new Error(`assembleExtension: missing extension asset: ${src}`);
    cpSync(src, join(outDir, f));
  }

  // 4. Stamp + write the manifest.
  const manifestSrc = JSON.parse(readFileSync(join(extSrcDir, 'manifest.json'), 'utf8'));
  const manifest = stampManifestVersion(manifestSrc, version);
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  // 5. Copy the icons the manifest references.
  const iconFiles = new Set([
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
  ]);
  for (const icon of iconFiles) {
    const src = join(iconsDir, icon);
    if (!existsSync(src)) throw new Error(`assembleExtension: missing icon: ${src}`);
    cpSync(src, join(outDir, icon));
  }

  return readdirSync(outDir).filter((f) => statSync(join(outDir, f)).isFile());
}

// ─── main() — vite build → assemble → zip (NOT run in unit tests) ─────────────

function readAppVersion() {
  // Single source of truth: web/src/config/constants.ts APP_VERSION (M04 §9: the
  // rewrite owns versioning in M05). Parse it without importing TS.
  const src = readFileSync(join(WEB_ROOT, 'src/config/constants.ts'), 'utf8');
  const m = src.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('build-extension: could not read APP_VERSION from constants.ts');
  return m[1];
}

function main() {
  const version = readAppVersion();
  const distDir = join(WEB_ROOT, 'dist');
  const extSrcDir = join(WEB_ROOT, 'extension-src');
  const iconsDir = join(REPO_ROOT, 'static'); // legacy icons (READ-ONLY)
  const outDir = join(WEB_ROOT, 'extension');
  const zipPath = join(WEB_ROOT, 'extension.zip');

  // 1. Build the SPA with a RELATIVE base so assets resolve under chrome-extension://.
  console.log('[build-extension] vite build --base ./');
  const build = spawnSync('npx', ['vite', 'build', '--base', './'], {
    cwd: WEB_ROOT, stdio: 'inherit', env: process.env,
  });
  if (build.status !== 0) process.exit(build.status ?? 1);

  // 2. Assemble.
  console.log(`[build-extension] assembling → ${outDir} (version ${version})`);
  assembleExtension({ distDir, extSrcDir, iconsDir, outDir, version });

  // 3. Zip (parity with the legacy gulp release zip).
  rmSync(zipPath, { force: true });
  console.log(`[build-extension] zipping → ${zipPath}`);
  const zip = spawnSync('zip', ['-r', '-q', zipPath, '.'], { cwd: outDir, stdio: 'inherit' });
  if (zip.status !== 0) process.exit(zip.status ?? 1);

  console.log(`[build-extension] done: ${zipPath}`);
}

// Only run main() when invoked directly (not when imported by the test).
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
