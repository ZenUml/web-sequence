// End-to-end tests for the Paddle webhook (#882): a real RSA key signs each
// payload the way Paddle Classic does, and the export runs against the
// Firestore emulator:
//   firebase emulators:exec --only firestore "node --test 'test/*.test.js'"
const crypto = require('crypto');
const Serialize = require('php-serialize');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.FUNCTIONS_EMULATOR = 'true';
process.env.CLOUD_RUNTIME_CONFIG = JSON.stringify({
  paddle: { pub_key: publicKey.export({ type: 'spki', format: 'pem' }), product_ids: 'plan-plus' },
});

const test = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const fns = require('../index');

function sign(fields) {
  const sorted = {};
  for (const key of Object.keys(fields).sort()) sorted[key] = String(fields[key]);
  const signer = crypto.createSign('sha1');
  signer.update(Serialize.serialize(sorted));
  return { ...fields, p_signature: signer.sign(privateKey, 'base64') };
}

function call(body) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headersSent: false,
      status(code) { this.statusCode = code; return this; },
      json(b) { this.headersSent = true; resolve({ status: this.statusCode, body: b }); return this; },
      send(b) { this.headersSent = true; resolve({ status: this.statusCode, body: b }); return this; },
    };
    const saved = console.log;
    console.log = () => {};
    Promise.resolve(fns.webhook({ method: 'POST', headers: {}, body, get: () => undefined }, res))
      .finally(() => { console.log = saved; });
  });
}

const alert = (overrides) => ({
  alert_name: 'subscription_created',
  checkout_id: 'chk-1',
  currency: 'USD',
  email: 'buyer@example.invalid',
  marketing_consent: '0',
  next_bill_date: '2026-11-22',
  quantity: '1',
  unit_price: '9.00',
  cancellation_effective_date: '2026-11-01',
  user_id: '42',
  passthrough: JSON.stringify({ userId: 'paddle-test-user' }),
  subscription_id: 's-new',
  subscription_plan_id: 'plan-plus',
  status: 'active',
  event_time: '2026-10-22 10:00:00',
  ...overrides,
});

test('webhook: missing p_signature is 400', async () => {
  assert.equal((await call(alert())).status, 400);
});

test('webhook: a tampered payload is 401', async () => {
  const signed = sign(alert());
  assert.equal((await call({ ...signed, status: 'deleted' })).status, 401);
});

test('webhook: an unsupported plan is 200 and logged with its subscription id', async () => {
  const logs = [];
  const saved = console.log;
  let r;
  try {
    console.log = (...args) => logs.push(args);
    r = await new Promise((resolve) => {
      const res = {
        statusCode: 200,
        headersSent: false,
        status(code) { this.statusCode = code; return this; },
        send(b) { this.headersSent = true; resolve({ status: this.statusCode, body: b }); return this; },
      };
      fns.webhook({ method: 'POST', headers: {}, body: sign(alert({ subscription_plan_id: 'other' })), get: () => undefined }, res);
    });
  } finally {
    console.log = saved;
  }
  assert.equal(r.status, 200);
  const entry = logs.find(([event]) => event === 'paddle webhook not applied');
  assert.ok(entry, 'logged');
  assert.equal(entry[1].subscription_id, 's-new');
  assert.equal(entry[1].alert_name, 'subscription_created');
  assert.doesNotMatch(JSON.stringify(entry), /buyer@example/);
});

const emulator = { skip: !process.env.FIRESTORE_EMULATOR_HOST && 'needs the Firestore emulator' };

test('webhook: unknown user is 503 so Paddle retries', emulator, async () => {
  const r = await call(sign(alert({ passthrough: JSON.stringify({ userId: 'paddle-nobody' }) })));
  assert.equal(r.status, 503);
});

test('webhook: stores a new event, then ignores an older one for the same user', emulator, async () => {
  const db = admin.firestore();
  await db.collection('users').doc('paddle-test-user').set({ uid: 'paddle-test-user' });
  const ref = db.collection('user_subscriptions').doc('user-paddle-test-user');
  await ref.delete();

  assert.deepEqual(await call(sign(alert())), { status: 200, body: 'Accepted' });
  assert.equal((await ref.get()).data().subscription_id, 's-new');

  const lateCancel = alert({
    alert_name: 'subscription_cancelled',
    subscription_id: 's-old',
    status: 'deleted',
    event_time: '2026-10-01 08:00:00',
  });
  assert.deepEqual(await call(sign(lateCancel)), { status: 200, body: 'Ignored stale event' });
  const stored = (await ref.get()).data();
  assert.equal(stored.subscription_id, 's-new');
  assert.equal(stored.status, 'active');
});
