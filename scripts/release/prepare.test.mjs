import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('a missing release attachment requests a source rebuild, not a deployment rejection', async () => {
  const { prepareRelease } = await import('./download.mjs');
  assert.equal(prepareRelease({ download: () => { throw new Error('asset missing'); } }), false);
});

test('a release attachment restores its frontend without overwriting checked-out functions', async () => {
  const { prepareRelease } = await import('./download.mjs');
  const root = mkdtempSync(join(tmpdir(), 'release-prepare-test-'));
  try {
    mkdirSync(join(root, 'source/web/dist'), { recursive: true });
    mkdirSync(join(root, 'source/functions'), { recursive: true });
    writeFileSync(join(root, 'source/web/dist/index.html'), 'released frontend');
    writeFileSync(join(root, 'source/functions/index.js'), 'archived functions');
    mkdirSync(join(root, 'target/functions'), { recursive: true });
    writeFileSync(join(root, 'target/functions/index.js'), 'tag functions');
    execFileSync('tar', ['-czf', join(root, 'deploy.tar.gz'), '-C', join(root, 'source'), 'web/dist', 'functions']);
    assert.equal(prepareRelease({ download: () => join(root, 'deploy.tar.gz'), destination: join(root, 'target') }), true);
    assert.equal(readFileSync(join(root, 'target/web/dist/index.html'), 'utf8'), 'released frontend');
    assert.equal(readFileSync(join(root, 'target/functions/index.js'), 'utf8'), 'tag functions');
    writeFileSync(join(root, 'empty.tgz'), '');
    assert.equal(prepareRelease({ download: () => join(root, 'empty.tgz') }), false);
    writeFileSync(join(root, 'broken.tgz'), 'not an archive');
    assert.throws(() => prepareRelease({ download: () => join(root, 'broken.tgz'), destination: join(root, 'target') }));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
