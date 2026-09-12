import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyRun, verifyManifest, verifyMarker } from './provenance.mjs';

const sha = 'a'.repeat(40);
const run = { id: 123, run_attempt: 1, event: 'push', head_branch: 'master', head_sha: sha, path: '.github/workflows/deploy-staging.yml', conclusion: 'success' };
const jobs = [{ name: 'E2E gate (staging)', conclusion: 'success' }];
const manifest = { schema: 1, sha, runId: '123', attempt: '1', sha256: 'b'.repeat(64) };

test('accepts only a successful master staging run for this exact release tag and commit', () => {
  assert.doesNotThrow(() => verifyRun(run, jobs, 'release-123-1', sha));
  for (const change of [{ event: 'pull_request' }, { head_branch: 'feature' }, { head_sha: 'c'.repeat(40) }, { conclusion: 'failure' }, { path: '.github/workflows/other.yml' }, { run_attempt: 2 }]) {
    assert.throws(() => verifyRun({ ...run, ...change }, jobs, 'release-123-1', sha));
  }
  assert.throws(() => verifyRun(run, [], 'release-123-1', sha));
  assert.throws(() => verifyRun(run, [{ ...jobs[0], conclusion: 'skipped' }], 'release-123-1', sha));
  assert.throws(() => verifyRun(run, jobs, 'release-999-1', sha));
  assert.throws(() => verifyRun(run, jobs, 'release-123-1\n', sha));
});

test('rejects swapped or corrupted release bundles and mismatched provenance', () => {
  assert.doesNotThrow(() => verifyManifest(manifest, run, manifest.sha256));
  for (const change of [{ schema: 2 }, { sha: 'c'.repeat(40) }, { runId: '124' }, { attempt: '2' }, { sha256: 'bad' }]) {
    assert.throws(() => verifyManifest({ ...manifest, ...change }, run, manifest.sha256));
  }
  assert.throws(() => verifyManifest(manifest, run, 'd'.repeat(64)));
});

test('rejects a live site belonging to a different commit or deployment attempt', () => {
  const marker = { sha, runId: '123', attempt: '1' };
  assert.doesNotThrow(() => verifyMarker(marker, marker));
  assert.throws(() => verifyMarker({ ...marker, sha: 'c'.repeat(40) }, marker));
  assert.throws(() => verifyMarker({ ...marker, attempt: '2' }, marker));
  assert.throws(() => verifyMarker({}, marker));
});
