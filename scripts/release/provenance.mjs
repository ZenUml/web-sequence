import assert from 'node:assert/strict';

export function verifyRun(run, jobs, tag, sha) {
  assert.match(tag, /^release-[1-9][0-9]*-[1-9][0-9]*$/);
  assert.equal(tag, `release-${run.id}-${run.run_attempt}`);
  assert.equal(run.event, 'push');
  assert.equal(run.head_branch, 'master');
  assert.equal(run.path, '.github/workflows/deploy-staging.yml');
  assert.equal(run.head_sha, sha);
  assert.equal(run.conclusion, 'success');
  assert(jobs.some(job => job.name === 'E2E gate (staging)' && job.conclusion === 'success'), 'Missing successful staging gate');
}

export function verifyManifest(manifest, run, digest) {
  assert.equal(manifest.schema, 1);
  assert.equal(manifest.sha, run.head_sha);
  assert.equal(manifest.runId, String(run.id));
  assert.equal(manifest.attempt, String(run.run_attempt));
  assert.match(manifest.sha256, /^[a-f0-9]{64}$/);
  assert.equal(manifest.sha256, digest);
}

export function verifyMarker(actual, expected) {
  for (const key of ['sha', 'runId', 'attempt']) {
    assert.equal(typeof expected[key], 'string');
    assert(expected[key].length > 0);
    assert.equal(actual[key], expected[key], `Deployed ${key} does not match validated artifact`);
  }
}
