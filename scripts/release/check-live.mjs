import { readFileSync } from 'node:fs';
import { verifyMarker } from './provenance.mjs';

const [baseUrl, manifestPath] = process.argv.slice(2);
const expected = JSON.parse(readFileSync(manifestPath, 'utf8'));
const response = await fetch(`${baseUrl}/release.json?run=${expected.runId}-${expected.attempt}-${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Release marker HTTP ${response.status}`);
verifyMarker(await response.json(), expected);
console.log(`Verified deployed commit ${expected.sha}`);
