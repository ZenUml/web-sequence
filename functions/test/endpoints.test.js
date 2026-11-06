// Endpoint tests for the shared auth guard (#862). They call the exported
// functions with fake req/res objects. Needs functions/node_modules. The
// create_share success case also needs the Firestore emulator:
//   firebase emulators:exec --only firestore "node --test 'test/*.test.js'"
process.env.FUNCTIONS_EMULATOR = 'true';
process.env.CLOUD_RUNTIME_CONFIG = JSON.stringify({
  larasite: { host: 'sync-upstream.invalid', public_base_url: 'https://example.invalid' },
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fns = require('../index');

const quiet = () => {
  const saved = [console.log, console.error];
  console.log = console.error = () => {};
  return () => { [console.log, console.error] = saved; };
};

function call(fn, { headers = {}, body = {}, query = {} } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headersSent: false,
      status(code) { this.statusCode = code; return this; },
      json(b) { this.headersSent = true; resolve({ status: this.statusCode, body: b }); return this; },
      send(b) { this.headersSent = true; resolve({ status: this.statusCode, body: b }); return this; },
    };
    const req = { method: 'POST', headers, body, query, get: (n) => headers[n.toLowerCase()] };
    const restore = quiet();
    Promise.resolve(fn(req, res)).finally(restore);
  });
}

for (const name of ['authenticate', 'sync_diagram', 'create_share']) {
  test(`${name}: missing token is 401 JSON`, async () => {
    const r = await call(fns[name], { body: { id: 'x' } });
    assert.equal(r.status, 401);
    assert.equal(typeof r.body.error, 'string');
  });

  test(`${name}: invalid token is 401 JSON, not a 500`, async () => {
    const r = await call(fns[name], { body: { id: 'x', token: 'not-a-jwt' } });
    assert.equal(r.status, 401);
  });
}

test('authenticate: a valid token returns the uid (Bearer header)', async () => {
  const r = await call(fns.authenticate, { headers: { authorization: 'Bearer local-dev-token' } });
  assert.deepEqual(r, { status: 200, body: 'local-test-user' });
});

test('sync_diagram: upstream failure is 502 JSON, not 200 with the raw error', async () => {
  const r = await call(fns.sync_diagram, { body: { token: 'local-dev-token', id: 'd1', content: 'A.b' } });
  assert.equal(r.status, 502);
  assert.deepEqual(r.body, { error: 'Diagram sync service unavailable' });
});

test('create_share: valid token on an owned item returns the share link',
  { skip: !process.env.FIRESTORE_EMULATOR_HOST && 'needs the Firestore emulator' }, async () => {
    const admin = require('firebase-admin');
    await admin.firestore().collection('items').doc('share-it').set({ createdBy: 'local-test-user', js: 'A.b' });
    const r = await call(fns.create_share, { body: { token: 'local-dev-token', id: 'share-it', origin: 'https://o.test' } });
    assert.equal(r.status, 200);
    assert.match(r.body.page_share, /^https:\/\/o\.test\?id=share-it&share-token=[0-9a-f]{32}$/);
  });

// The path the web client uses: a real ID token in body.token, verified by the
// Admin SDK (no bypass). Needs the Auth + Firestore emulators:
//   firebase emulators:exec --only auth,firestore --project staging-zenuml-27954 \
//     "node --test 'test/*.test.js'"
// (index.js pins that project id under the emulator; a token minted for another
// project fails the audience check.)
test('create_share: a real ID token in body.token is verified and returns the share link',
  { skip: !(process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIRESTORE_EMULATOR_HOST) && 'needs the Auth + Firestore emulators' },
  async () => {
    const admin = require('firebase-admin');
    const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const signUp = await fetch(`http://${host}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `u${Date.now()}@example.test`, password: 'secret123', returnSecureToken: true }),
    });
    const { idToken, localId } = await signUp.json();
    await admin.firestore().collection('items').doc('real-token-item').set({ createdBy: localId, js: 'A.b' });

    const ok = await call(fns.create_share, { body: { token: idToken, id: 'real-token-item', origin: 'https://o.test' } });
    assert.equal(ok.status, 200);
    assert.match(ok.body.page_share, /^https:\/\/o\.test\?id=real-token-item&share-token=/);

    // Same verified user, item owned by someone else: still 403, not 401.
    await admin.firestore().collection('items').doc('foreign-item').set({ createdBy: 'someone-else' });
    const denied = await call(fns.create_share, { body: { token: idToken, id: 'foreign-item' } });
    assert.equal(denied.status, 403);
  });
