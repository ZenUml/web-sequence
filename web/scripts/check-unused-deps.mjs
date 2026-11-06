#!/usr/bin/env node
// Unused-dependency guard for web/ (#869). Fails when web/package.json declares a
// package that no source file imports. Zero-dependency on purpose: a text scan of
// import/require specifiers is enough for this codebase, and it avoids adding a
// knip/depcheck toolchain of its own.
//
// Usage: node scripts/check-unused-deps.mjs   (exit 1 + list when anything is unused)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = resolve(fileURLToPath(import.meta.url), '../..');

// Directories and top-level files whose imports count as "use".
const SCAN_DIRS = ['src', 'scripts', 'e2e', 'extension-src', '.storybook'];
const SCAN_FILES = [
  'vite.config.ts', 'playwright.config.ts', 'postcss.config.js', 'tailwind.config.js', 'index.html',
];
const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.html', '.css', '.scss']);

// Packages used without an import specifier: CLIs run from package.json scripts,
// test/build tooling resolved by name from config, and peer deps of tools.
export const ALLOW = [
  '@lezer/generator', // build:grammar CLI
  '@vitest/coverage-v8', // `vitest --coverage` provider, resolved by vitest
  'autoprefixer', // postcss.config.js plugin key
  'eslint', // lint CLI
  'postcss', // read by Vite
  'storybook', // storybook CLI
  'typescript', // tsc CLI (typecheck)
];

export function isReferenced(name, source) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  // A quote, the package name, then the closing quote or a subpath slash.
  return new RegExp(`['"\`]${escaped}(['"\`]|/)`).test(source);
}

export function findUnusedDeps({ pkg, sources, allow }) {
  const declared = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ];
  const allowed = new Set(allow);
  return declared
    .filter((name) => !name.startsWith('@types/') && !allowed.has(name))
    .filter((name) => !sources.some((src) => isReferenced(name, src)))
    .sort();
}

// This guard and its test quote package names as data; scanning them would let a
// re-added unused package satisfy itself.
const SELF = new Set([
  join(WEB_ROOT, 'scripts/check-unused-deps.mjs'),
  join(WEB_ROOT, 'scripts/check-unused-deps.test.mjs'),
]);

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (SCAN_EXT.has(extname(path)) && !SELF.has(path)) out.push(readFileSync(path, 'utf8'));
  }
  return out;
}

export function checkRepo(root = WEB_ROOT, pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))) {
  const sources = [];
  for (const dir of SCAN_DIRS) {
    try { walk(join(root, dir), sources); } catch { /* directory absent */ }
  }
  for (const file of SCAN_FILES) {
    try { sources.push(readFileSync(join(root, file), 'utf8')); } catch { /* file absent */ }
  }
  return findUnusedDeps({ pkg, sources, allow: ALLOW });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const unused = checkRepo();
  if (unused.length) {
    console.error(`web/package.json declares ${unused.length} unused package(s):\n  ${unused.join('\n  ')}`);
    console.error('Remove them (pnpm remove --ignore-workspace ...) or add them to ALLOW with a reason.');
    process.exit(1);
  }
  console.log('check-unused-deps: every declared package is referenced.');
}
