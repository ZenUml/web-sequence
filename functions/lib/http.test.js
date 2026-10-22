const test = require('node:test');
const assert = require('node:assert/strict');
const { HttpError, readToken, requireUser, handler } = require('./http');

const req = ({ headers = {}, body = {} } = {}) => ({
  body,
  get: (name) => headers[name.toLowerCase()],
});

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    headersSent: false,
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; this.headersSent = true; return this; },
  };
}

const okVerify = async (token) => {
  if (token === 'good') return { uid: 'u1' };
  throw new Error('Firebase ID token has expired');
};

test('readToken prefers Authorization: Bearer, then a raw header, then body.token', () => {
  assert.equal(readToken(req({ headers: { authorization: 'Bearer abc' }, body: { token: 'x' } })), 'abc');
  assert.equal(readToken(req({ headers: { authorization: 'raw' } })), 'raw');
  assert.equal(readToken(req({ body: { token: 'b' } })), 'b');
  assert.equal(readToken(req()), null);
});

test('requireUser: missing token is a 401 HttpError', async () => {
  await assert.rejects(requireUser(req(), { verify: okVerify }), (e) => e instanceof HttpError && e.status === 401);
});

test('requireUser: invalid or expired token is a 401 HttpError', async () => {
  await assert.rejects(
    requireUser(req({ body: { token: 'bad' } }), { verify: okVerify }),
    (e) => e instanceof HttpError && e.status === 401,
  );
});

test('requireUser: valid token returns the decoded user', async () => {
  assert.deepEqual(await requireUser(req({ body: { token: 'good' } }), { verify: okVerify }), { uid: 'u1' });
});

test('requireUser: the emulator bypass works only under the emulator', async () => {
  const r = req({ body: { token: 'local-dev-token' } });
  assert.deepEqual(await requireUser(r, { verify: okVerify, emulator: true }), { uid: 'local-test-user' });
  await assert.rejects(requireUser(r, { verify: okVerify, emulator: false }), (e) => e.status === 401);
});

test('handler maps HttpError to its status with a JSON { error }', async () => {
  const res = fakeRes();
  await handler(async () => { throw new HttpError(404, 'Item not found'); })(req(), res);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Item not found' });
});

test('handler maps an unknown error to 500 without leaking its message', async () => {
  const res = fakeRes();
  const original = console.error;
  console.error = () => {};
  try {
    await handler(async () => { throw new Error('internal detail'); }, { fallbackMessage: 'Failed to create share' })(req(), res);
  } finally {
    console.error = original;
  }
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'Failed to create share' });
});

test('handler leaves a successful response alone', async () => {
  const res = fakeRes();
  await handler(async (_req, r) => { r.json({ ok: true }); })(req(), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
});
