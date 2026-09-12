import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { verifyRun, verifyManifest } from './provenance.mjs';

const tag = process.env.RELEASE_TAG;
if (!/^release-[1-9][0-9]*-[1-9][0-9]*$/.test(tag ?? '') || tag.includes('\n')) throw new Error('Only gated release-<run>-<attempt> tags can deploy');
const repo = process.env.GITHUB_REPOSITORY;
const [, runId, attempt] = tag.split('-');
const gh = args => execFileSync('gh', args, { encoding: 'utf8' });
const run = JSON.parse(gh(['api', `repos/${repo}/actions/runs/${runId}/attempts/${attempt}`]));
const jobs = JSON.parse(gh(['api', `repos/${repo}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`])).jobs;
execFileSync('git', ['fetch', '--no-tags', 'origin', `refs/tags/${tag}`]);
const sha = execFileSync('git', ['rev-parse', 'FETCH_HEAD^{commit}'], { encoding: 'utf8' }).trim();
verifyRun(run, jobs, tag, sha);
execFileSync('git', ['fetch', 'origin', 'master']);
execFileSync('git', ['merge-base', '--is-ancestor', sha, 'origin/master']);
// Immutable Actions artifact, not a user-replaceable Release attachment.
// Expired/missing artifacts intentionally fail closed; no unverified rebuild fallback.
gh(['run', 'download', runId, '--repo', repo, '--name', `release-bundle-${attempt}`, '--dir', 'release-bundle']);
const manifest = JSON.parse(readFileSync('release-bundle/manifest.json', 'utf8'));
const digest = createHash('sha256').update(readFileSync('release-bundle/deploy.tar.gz')).digest('hex');
verifyManifest(manifest, run, digest);
mkdirSync('deployment');
execFileSync('tar', ['-xzf', 'release-bundle/deploy.tar.gz', '-C', 'deployment']);
console.log(`Verified release ${tag}: ${sha}`);
