import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A job without timeout-minutes runs up to GitHub's 360-minute default. On
// 2026-10-30 "Build and local E2E" hung in "Complete job" for 80 minutes after
// its last step, and the whole time was billed.
function jobTimeouts(workflowPath) {
  const lines = readFileSync(resolve(workflowPath), 'utf8').split('\n');
  const start = lines.findIndex((line) => line === 'jobs:');
  assert.notEqual(start, -1, `${workflowPath} has no top-level jobs: block`);
  const jobs = {};
  let current;
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const job = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (job) {
      current = job[1];
      jobs[current] = undefined;
      continue;
    }
    const timeout = line.match(/^ {4}timeout-minutes:\s*(\d+)\s*$/);
    if (current && timeout) jobs[current] = Number(timeout[1]);
  }
  return jobs;
}

for (const workflow of ['deploy-staging', 'deploy-prod', 'rollback-prod', 'remove-old-artifacts']) {
  test(`every ${workflow} job sets a timeout of at most 30 minutes`, () => {
    const jobs = jobTimeouts(`.github/workflows/${workflow}.yml`);
    assert.ok(Object.keys(jobs).length > 0, 'no jobs found');
    for (const [job, minutes] of Object.entries(jobs)) {
      assert.ok(Number.isInteger(minutes) && minutes > 0, `job "${job}" has no positive timeout-minutes`);
      assert.ok(minutes <= 30, `job "${job}" timeout-minutes ${minutes} is above 30`);
    }
  });
}

test('each Playwright browser installation has a timeout of at most 20 minutes', () => {
  const workflow = readFileSync(resolve('.github/workflows/deploy-staging.yml'), 'utf8');
  const installs = workflow.split(/^      - /m).filter((step) => /run: pnpm exec playwright install\b/.test(step));
  assert.equal(installs.length, 2, 'expected local and staging browser installation steps');
  for (const step of installs) {
    const minutes = Number(step.match(/^        timeout-minutes: (\d+)$/m)?.[1]);
    assert.ok(Number.isInteger(minutes) && minutes > 0 && minutes <= 20,
      `Playwright installation has no positive timeout-minutes of at most 20: ${step.split('\n')[0]}`);
  }
});
