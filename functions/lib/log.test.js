const test = require('node:test');
const assert = require('node:assert/strict');
const { REDACTED_KEYS, redact, log } = require('./log');

test('redacts every key in the redaction list', () => {
  const fields = Object.fromEntries(REDACTED_KEYS.map((k) => [k, 'secret-value']));
  const out = redact(fields);
  for (const k of REDACTED_KEYS) assert.equal(out[k], '[redacted]', k);
});

test('the redaction list covers the credentials and PII named in #862', () => {
  for (const k of ['token', 'shareToken', 'share-token', 'authorization', 'imageBase64', 'email']) {
    assert.ok(REDACTED_KEYS.includes(k), k);
  }
});

test('matches keys case-insensitively (Authorization header)', () => {
  assert.equal(redact({ Authorization: 'Bearer abc' }).Authorization, '[redacted]');
});

test('redacts nested objects and arrays without mutating the input', () => {
  const input = { item: { id: 'i1', shareToken: 's' }, list: [{ token: 't', ok: 1 }] };
  const out = redact(input);
  assert.deepEqual(out, { item: { id: 'i1', shareToken: '[redacted]' }, list: [{ token: '[redacted]', ok: 1 }] });
  assert.equal(input.item.shareToken, 's');
});

test('keeps non-sensitive fields and primitives as they are', () => {
  assert.deepEqual(redact({ itemId: 'i1', found: true, n: 2, nothing: null }), { itemId: 'i1', found: true, n: 2, nothing: null });
});

test('log writes the event name and redacted fields, never the secret value', () => {
  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  try {
    log('get_shared_item.denied', { itemId: 'i1', shareToken: 'very-secret' });
  } finally {
    console.log = original;
  }
  assert.equal(lines.length, 1);
  assert.match(lines[0], /get_shared_item\.denied/);
  assert.match(lines[0], /i1/);
  assert.doesNotMatch(lines[0], /very-secret/);
});
