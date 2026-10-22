// Paddle Classic subscription webhook (#882): verify, parse, resolve the user,
// and store the subscription only when the event is not older than the one
// already stored. Each step returns a status so Paddle retries only the
// failures a retry can fix (an unknown user may sign up later; a bad signature
// or an unsupported alert never changes).
const alertParser = require('../alert_parser');

// passthrough is '{"userId":"..."}' from the checkout, or a raw uid from
// older checkouts. The id becomes part of a Firestore doc path, so '/' is
// rejected.
function userIdFromPassthrough(passthrough) {
  if (typeof passthrough !== 'string' || passthrough === '') return null;
  let id = passthrough;
  try {
    const parsed = JSON.parse(passthrough);
    id = parsed && typeof parsed === 'object' ? parsed.userId : parsed;
  } catch {
    // not JSON: a raw uid
  }
  if (typeof id !== 'string' || id === '' || id.includes('/')) return null;
  return id;
}

// Paddle sends event_time as 'YYYY-MM-DD HH:MM:SS' in UTC.
function eventTimeMs(subscription) {
  const raw = subscription?.event_time;
  if (typeof raw !== 'string') return NaN;
  return Date.parse(raw.replace(' ', 'T') + 'Z');
}

// One doc per user holds the latest subscription event, so the comparison
// spans subscription ids: a late cancel of an old subscription must not
// replace a newer active one.
function isStale(stored, incoming) {
  const storedMs = eventTimeMs(stored);
  const incomingMs = eventTimeMs(incoming);
  if (Number.isNaN(storedMs) || Number.isNaN(incomingMs)) return false;
  return incomingMs < storedMs;
}

async function processAlert(body, { verify, supportedPlan, userExists, applyIfNewer }) {
  if (!body || !body.p_signature) return { status: 400, message: 'Invalid request' };
  // validateWebhook deletes p_signature from its argument.
  if (!verify({ ...body })) return { status: 401, message: 'Invalid signature' };

  const req = { body };
  if (!alertParser.supports(req)) {
    return { status: 200, message: `unsupported alert ${body.alert_name}` };
  }
  const subscription = alertParser.parse(req);
  if (!supportedPlan(subscription.subscription_plan_id)) {
    return {
      status: 200,
      message: `subscription_plan_id:${subscription.subscription_plan_id} not supported`,
    };
  }
  const userId = userIdFromPassthrough(subscription.passthrough);
  if (!userId) return { status: 200, message: 'Unusable passthrough' };
  if (!(await userExists(userId))) return { status: 503, message: `Unknown userId: ${userId}` };

  const outcome = await applyIfNewer(userId, subscription);
  if (outcome === 'stale') return { status: 200, message: 'Ignored stale event' };
  return { status: 200, message: 'Accepted' };
}

function firestoreDeps(db) {
  return {
    userExists: async (userId) => (await db.collection('users').doc(userId).get()).exists,
    applyIfNewer: (userId, subscription) => {
      const ref = db.collection('user_subscriptions').doc('user-' + userId);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists && isStale(snap.data(), subscription)) return 'stale';
        tx.set(ref, subscription);
        return 'applied';
      });
    },
  };
}

module.exports = { userIdFromPassthrough, isStale, processAlert, firestoreDeps };
