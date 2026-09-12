import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const { GITHUB_SHA: sha, GITHUB_RUN_ID: runId, GITHUB_RUN_ATTEMPT: attempt } = process.env;
if (!/^[a-f0-9]{40}$/.test(sha ?? '') || !/^\d+$/.test(runId ?? '') || !/^\d+$/.test(attempt ?? '')) throw new Error('Missing GitHub build identity');
// Staging serves this identity; the Release attachment can reuse this frontend.
writeFileSync('web/dist/release.json', JSON.stringify({ sha, runId, attempt }));
mkdirSync('release-bundle', { recursive: true });
execFileSync('tar', ['--exclude=node_modules', '--exclude=.env*', '--exclude=*-debug.log', '-czf', 'release-bundle/deploy.tar.gz', 'web/dist', 'functions', 'firebase.json', '.firebaserc', 'firestore.rules', 'firestore.indexes.json', 'extension.zip']);
const sha256 = createHash('sha256').update(readFileSync('release-bundle/deploy.tar.gz')).digest('hex');
writeFileSync('release-bundle/manifest.json', JSON.stringify({ schema: 1, sha, runId, attempt, sha256 }, null, 2));
