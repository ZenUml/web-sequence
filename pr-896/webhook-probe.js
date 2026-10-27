// Same scenarios against either side's exported `webhook` function + Firestore emulator.
const crypto = require('crypto');
const side = process.env.SIDE;
const Serialize = require(`/private/tmp/claude-501/pr-855/${side}/functions/node_modules/php-serialize`);
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.FUNCTIONS_EMULATOR = 'true';
process.env.CLOUD_RUNTIME_CONFIG = JSON.stringify({ paddle: { pub_key: publicKey.export({ type: 'spki', format: 'pem' }), product_ids: 'plan-plus' } });
const admin = require(`/private/tmp/claude-501/pr-855/${side}/functions/node_modules/firebase-admin`);
const fns = require(`/private/tmp/claude-501/pr-855/${side}/functions/index`);
function sign(fields) {
  const sorted = {}; for (const k of Object.keys(fields).sort()) sorted[k] = String(fields[k]);
  const s = crypto.createSign('sha1'); s.update(Serialize.serialize(sorted));
  return { ...fields, p_signature: s.sign(privateKey, 'base64') };
}
function call(body) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, headersSent: false, status(c) { this.statusCode = c; return this; },
      json(b) { this.headersSent = true; resolve({ status: this.statusCode, body: b }); return this; },
      send(b) { this.headersSent = true; resolve({ status: this.statusCode, body: b }); return this; } };
    const saved = console.log; console.log = () => {}; const se = console.error; console.error = () => {};
    Promise.resolve(fns.webhook({ method: 'POST', headers: {}, body, get: () => undefined }, res)).catch(() => resolve({ status: 'unhandled-rejection', body: null }))
      .finally(() => { console.log = saved; console.error = se; });
    setTimeout(() => resolve({ status: 'no-response-after-5s', body: null }), 5000);
  });
}
const alert = (o) => ({ alert_name: 'subscription_created', checkout_id: 'c1', currency: 'USD', email: 'buyer@example.invalid', marketing_consent: '0', next_bill_date: '2026-11-22', quantity: '1', unit_price: '9.00', cancellation_effective_date: '2026-11-01', user_id: '42', passthrough: JSON.stringify({ userId: 'u-probe' }), subscription_id: 's-new', subscription_plan_id: 'plan-plus', status: 'active', event_time: '2026-10-22 10:00:00', ...o });
(async () => {
  const out = [];
  const rec = async (name, body) => { const r = await call(body); out.push({ case: name, status: r.status, body: typeof r.body === 'string' ? r.body : JSON.stringify(r.body) }); };
  await rec('no body', undefined);
  await rec('body without p_signature', { alert_name: 'subscription_created' });
  await rec('bad signature', { ...alert({}), p_signature: 'bogus' });
  await rec('signed, unsupported plan', sign(alert({ subscription_plan_id: 'other-plan' })));
  await rec('signed, passthrough has no userId', sign(alert({ passthrough: '{}' })));
  await rec('signed, unknown user', sign(alert({ passthrough: JSON.stringify({ userId: 'ghost-user' }) })));
  await admin.firestore().doc('users/u-probe').set({ items: {} });
  await rec('signed, known user, created (active) @10:00', sign(alert({})));
  await rec('signed, OLDER cancel of other sub @09:00', sign(alert({ alert_name: 'subscription_cancelled', subscription_id: 's-old', status: 'deleted', event_time: '2026-10-22 09:00:00' })));
  const doc = (await admin.firestore().doc('user_subscriptions/user-u-probe').get()).data() || {};
  out.push({ case: 'stored subscription after the stale cancel', status: '-', body: JSON.stringify({ status: doc.status, subscription_id: doc.subscription_id ?? doc.subscriptionId, event_time: doc.event_time ?? doc.eventTime }) });
  require('fs').writeFileSync(`/private/tmp/claude-501/pr-855/wh-${side}.json`, JSON.stringify(out, null, 1));
  process.exit(0);
})();
