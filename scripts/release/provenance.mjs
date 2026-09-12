import assert from 'node:assert/strict';

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
