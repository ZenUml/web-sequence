const test = require('node:test');
const assert = require('node:assert/strict');
const { userIdFromPassthrough, isStale, processAlert } = require('./paddle');

test('userIdFromPassthrough: JSON { userId } and a raw uid both resolve', () => {
  assert.equal(userIdFromPassthrough('{"userId":"u1","planType":"plus-monthly"}'), 'u1');
  assert.equal(userIdFromPassthrough('u1'), 'u1');
});

test('userIdFromPassthrough: rejects empty, missing, non-string and path-like ids', () => {
  for (const bad of [undefined, null, '', '{}', '{"userId":""}', '{"userId":42}', 'a/b', '{"userId":"a/b"}']) {
    assert.equal(userIdFromPassthrough(bad), null, String(bad));
  }
});

test('isStale: an older event than the stored one is stale; newer or equal is not', () => {
  const stored = { event_time: '2026-10-22 10:00:00' };
  assert.equal(isStale(stored, { event_time: '2026-10-22 09:59:59' }), true);
  assert.equal(isStale(stored, { event_time: '2026-10-22 10:00:00' }), false);
  assert.equal(isStale(stored, { event_time: '2026-10-22 10:00:01' }), false);
});

test('isStale: compares across subscriptions (a late cancel of an old one must not win)', () => {
  const stored = { subscription_id: 'new', event_time: '2026-10-22 10:00:00' };
  assert.equal(isStale(stored, { subscription_id: 'old', event_time: '2026-10-01 08:00:00' }), true);
});

test('isStale: nothing stored, or an unparseable time, is never stale', () => {
  assert.equal(isStale(null, { event_time: '2026-10-22 10:00:00' }), false);
  assert.equal(isStale({ event_time: 'garbage' }, { event_time: '2026-10-22 10:00:00' }), false);
  assert.equal(isStale({ event_time: '2026-10-22 10:00:00' }, {}), false);
});

const created = {
  alert_name: 'subscription_created',
  p_signature: 'sig',
  passthrough: '{"userId":"u1"}',
  subscription_id: 's1',
  subscription_plan_id: 'plan-plus',
  status: 'active',
  event_time: '2026-10-22 10:00:00',
};

function deps(overrides = {}) {
  const writes = [];
  return {
    writes,
    verify: () => true,
    supportedPlan: (id) => id === 'plan-plus',
    userExists: async (uid) => uid === 'u1',
    applyIfNewer: async (uid, subscription) => {
      writes.push({ uid, subscription });
      return 'applied';
    },
    ...overrides,
  };
}

test('processAlert: a valid subscription_created is stored and Accepted', async () => {
  const d = deps();
  assert.deepEqual(await processAlert(created, d), { status: 200, message: 'Accepted' });
  assert.equal(d.writes.length, 1);
  assert.equal(d.writes[0].uid, 'u1');
  assert.equal(d.writes[0].subscription.subscription_id, 's1');
  assert.equal(d.writes[0].subscription.status, 'active');
});

test('processAlert: a valid subscription_cancelled is stored and Accepted', async () => {
  const d = deps();
  const cancelled = { ...created, alert_name: 'subscription_cancelled', status: 'deleted', event_time: '2026-10-23 10:00:00' };
  assert.deepEqual(await processAlert(cancelled, d), { status: 200, message: 'Accepted' });
  assert.equal(d.writes[0].subscription.status, 'deleted');
});

test('processAlert: no body or no p_signature is 400', async () => {
  assert.equal((await processAlert(undefined, deps())).status, 400);
  const { p_signature, ...unsigned } = created;
  assert.equal((await processAlert(unsigned, deps())).status, 400);
});

test('processAlert: a bad signature is 401 and writes nothing', async () => {
  const d = deps({ verify: () => false });
  assert.equal((await processAlert(created, d)).status, 401);
  assert.equal(d.writes.length, 0);
});

test('processAlert: verify gets a copy, so the caller body keeps p_signature', async () => {
  const body = { ...created };
  await processAlert(body, deps({ verify: (copy) => { delete copy.p_signature; return true; } }));
  assert.equal(body.p_signature, 'sig');
});

test('processAlert: an unsupported alert is acknowledged (200) and ignored', async () => {
  const d = deps();
  const r = await processAlert({ ...created, alert_name: 'payment_refunded' }, d);
  assert.equal(r.status, 200);
  assert.match(r.message, /unsupported alert payment_refunded/);
  assert.equal(d.writes.length, 0);
});

test('processAlert: an unsupported plan is acknowledged (200) and ignored', async () => {
  const d = deps();
  const r = await processAlert({ ...created, subscription_plan_id: 'other' }, d);
  assert.equal(r.status, 200);
  assert.match(r.message, /not supported/);
  assert.equal(d.writes.length, 0);
});

test('processAlert: an unknown user is 503 so Paddle retries, and writes nothing', async () => {
  const d = deps();
  const r = await processAlert({ ...created, passthrough: '{"userId":"u-missing"}' }, d);
  assert.equal(r.status, 503);
  assert.equal(d.writes.length, 0);
});

test('processAlert: an unusable passthrough is acknowledged (200): a retry cannot fix it', async () => {
  const d = deps();
  const r = await processAlert({ ...created, passthrough: '{}' }, d);
  assert.equal(r.status, 200);
  assert.match(r.message, /passthrough/);
  assert.equal(d.writes.length, 0);
});

test('processAlert: a stale event is acknowledged (200) and reported as ignored', async () => {
  const d = deps({ applyIfNewer: async () => 'stale' });
  assert.deepEqual(await processAlert(created, d), { status: 200, message: 'Ignored stale event' });
});
