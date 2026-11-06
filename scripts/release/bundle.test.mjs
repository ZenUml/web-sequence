import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { verifyManifest, verifyMarker } from './provenance.mjs';

test('bundle preserves deployable bytes, stamps identity and excludes credentials/dependencies', () => {
  const root = mkdtempSync(join(tmpdir(), 'release-bundle-test-'));
  try {
    for (const dir of ['web/dist', 'functions/node_modules']) mkdirSync(join(root, dir), { recursive: true });
    for (const [path, content] of Object.entries({
      'web/dist/index.html': '<h1>built once</h1>',
      'functions/index.js': 'exports.handler = true;',
      'functions/pnpm-lock.yaml': 'lockfileVersion: 9',
      'functions/.env.local': 'secret',
      'functions/node_modules/dependency': 'omit',
      'firebase.json': '{"hosting":{"public":"web/dist"}}',
      '.firebaserc': '{}', 'firestore.rules': 'rules', 'firestore.indexes.json': '{}', 'extension.zip': 'zip',
    })) writeFileSync(join(root, path), content);
    const sha = 'a'.repeat(40);
    execFileSync(process.execPath, [resolve('scripts/release/bundle.mjs')], {
      cwd: root, env: { ...process.env, GITHUB_SHA: sha, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1' },
    });
    const bundle = join(root, 'release-bundle/deploy.tar.gz');
    const manifest = JSON.parse(readFileSync(join(root, 'release-bundle/manifest.json')));
    verifyManifest(manifest, { head_sha: sha, id: 123, run_attempt: 1 }, createHash('sha256').update(readFileSync(bundle)).digest('hex'));
    const destination = join(root, 'restored'); mkdirSync(destination);
    execFileSync('tar', ['-xzf', bundle, '-C', destination]);
    assert.equal(readFileSync(join(destination, 'web/dist/index.html'), 'utf8'), '<h1>built once</h1>');
    assert.equal(readFileSync(join(destination, 'functions/index.js'), 'utf8'), 'exports.handler = true;');
    verifyMarker(JSON.parse(readFileSync(join(destination, 'web/dist/release.json'))), manifest);
    const listing = execFileSync('tar', ['-tzf', bundle], { encoding: 'utf8' });
    assert(!listing.includes('.env.local'));
    assert(!listing.includes('node_modules'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
