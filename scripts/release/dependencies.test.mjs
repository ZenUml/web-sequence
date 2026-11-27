import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const repository = new URL('../../', import.meta.url);

// GHSA-xq3m-2v4x-88gg: schema-controlled code generation was fixed in
// protobufjs 6.11.6, 7.5.5 and 8.0.1. Check before installing or deploying.
function isPatched(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (major === 6) return minor > 11 || (minor === 11 && patch >= 6);
  if (major === 7) return minor > 5 || (minor === 5 && patch >= 5);
  if (major === 8) return minor > 0 || patch >= 1;
  return major > 8;
}

for (const directory of ['', 'functions/']) {
  test(`${directory || 'root/'} protobufjs overrides agree for pnpm 10 and 11`, () => {
    const manifest = JSON.parse(
      readFileSync(new URL(`${directory}package.json`, repository), 'utf8'),
    );
    const workspace = readFileSync(
      new URL(`${directory}pnpm-workspace.yaml`, repository),
      'utf8',
    );
    const overrides = Object.fromEntries(
      [
        ...workspace.matchAll(
          /^  ['"]?(protobufjs@[^'":\n]+)['"]?: ([^\n]+)$/gm,
        ),
      ].map((match) => [match[1], match[2].replace(/['"]/g, '').trim()]),
    );
    const expected = Object.fromEntries(
      Object.entries(manifest.pnpm.overrides).filter(([name]) =>
        name.startsWith('protobufjs@'),
      ),
    );
    assert.ok(Object.keys(expected).length > 0);
    assert.deepEqual(overrides, expected);
  });
}

for (const path of [
  'pnpm-lock.yaml',
  'functions/pnpm-lock.yaml',
  'web/pnpm-lock.yaml',
  'yarn.lock',
  'scripts/filestore/package-lock.json',
]) {
  // The legacy Yarn/filestore locks may be removed independently of this fix.
  const file = new URL(path, repository);
  const legacy = path === 'yarn.lock' || path.startsWith('scripts/filestore/');
  if (legacy && !existsSync(file)) continue;
  test(`${path} excludes protobufjs versions affected by GHSA-xq3m-2v4x-88gg`, () => {
    const content = readFileSync(file, 'utf8');
    let versions;
    if (path.endsWith('package-lock.json')) {
      versions = Object.entries(JSON.parse(content).packages)
        .filter(([name]) => name.endsWith('node_modules/protobufjs'))
        .map(([, value]) => value.version);
    } else if (path.endsWith('yarn.lock')) {
      versions = [
        ...content.matchAll(/^protobufjs@[^\n]+:\r?\n\s+version "([^"]+)"/gm),
      ].map((match) => match[1]);
    } else {
      versions = [...content.matchAll(/^  protobufjs@([^:\s(]+):$/gm)].map(
        (match) => match[1],
      );
    }
    assert.ok(
      versions.length > 0,
      `No protobufjs versions found in ${path}; update the lockfile check if its format changed`,
    );
    for (const version of new Set(versions)) {
      assert.match(
        version,
        /^\d+\.\d+\.\d+$/,
        'Expected a stable protobufjs version',
      );
      assert.ok(
        isPatched(version),
        `${path} resolves vulnerable protobufjs ${version}`,
      );
      // Active 7.x installs also include the later security fixes. The unused
      // Yarn lock is kept at its existing versions pending its separate removal.
      const [major, minor, patch] = version.split('.').map(Number);
      if (major === 7 && path !== 'yarn.lock') {
        assert.ok(
          minor > 6 || (minor === 6 && patch >= 6),
          `${path} must retain the later protobufjs 7.6.6 security fixes`,
        );
      }
    }
  });
}
