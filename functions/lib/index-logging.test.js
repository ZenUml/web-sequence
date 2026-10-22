// Source-level guard for #862: index.js must not dump requests, decoded ID
// tokens, outgoing bodies or share tokens into Cloud Logging.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const source = readFileSync(join(__dirname, '..', 'index.js'), 'utf8');

for (const [what, pattern] of [
  ['whole request object', /console\.log\(\s*'request:'/],
  ['decoded ID token', /decoded token/],
  ['outgoing sync body (ID token, email, image)', /'request - options: '/],
  ['DEBUG block in get_shared_item', /DEBUG/],
  ['raw share token values', /actualToken|requestedToken|\{ itemId, shareToken \}/],
  ['raw query object', /'Query object:'/],
]) {
  test(`index.js does not log the ${what}`, () => {
    assert.doesNotMatch(source, pattern);
  });
}
