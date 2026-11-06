// Firestore EMULATOR REST helpers — seed + probe the local emulator with ZERO
// extra dependencies (no firebase-admin at the repo root; firebase-admin only
// lives in functions/node_modules and pulling it into the Playwright runner would
// bloat the root install). The Firestore emulator exposes the standard Firestore
// REST surface at http://<host>/v1/projects/<projectId>/databases/(default)/documents
// and — being an emulator — requires NO auth token and bypasses security rules.
//
// Used by:
//   - the cloud spec's in-test "side-effect" probes (IOL-2/3, SUB-4, NET-2, SET-7):
//     assert a Firestore doc exists / is absent / holds a value, not just the DOM.
//   - seeding shared items (SHR-5..8, PST-3/4, HDR-4, EMB-1) and paid-user docs
//     (SUB-5) so the functions emulator / the client read a known fixture.
//
// projectId MUST match the web client + functions emulator: both resolve to
// 'staging-zenuml-27954' on localhost (firebaseConfig defaultConfig / functions
// FUNCTIONS_EMULATOR branch), so the docs the client writes and the docs we probe
// are the SAME database.

const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const PROJECT_ID = process.env.E2E_PROJECT_ID || 'staging-zenuml-27954';
const BASE = `http://${HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// firestore.rules is enforced by the emulator EVEN over REST. The emulator grants
// FULL admin access (bypassing all rules) to requests carrying `Authorization:
// Bearer owner` — this is the documented emulator backdoor used by firebase-admin.
// Seeding/probing as admin lets a test set up arbitrary fixtures (items owned by a
// uid, paid-user subscription docs) the client could never write directly.
const ADMIN_HEADERS = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };

// ── Firestore <-> JS value (de)serialization for the REST `fields` shape ───────
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
function toFields(obj) {
  const fields = {};
  for (const [k, val] of Object.entries(obj)) fields[k] = toValue(val);
  return fields;
}
function fromValue(v) {
  if (!v) return undefined;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return undefined;
}
function fromFields(fields) {
  const out = {};
  for (const [k, val] of Object.entries(fields || {})) out[k] = fromValue(val);
  return out;
}

// Create OR overwrite a document at `path` (e.g. 'items/abc' or 'users/uid').
// Uses PATCH (create-or-replace) so seeding is idempotent across re-runs.
export async function setDoc(path, data) {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'PATCH',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`setDoc ${path} failed: ${res.status} ${await res.text()}`);
  return fromFields((await res.json()).fields || {});
}

// Read a document; returns the JS object or null if it does not exist.
export async function getDoc(path) {
  const res = await fetch(`${BASE}/${path}`, { headers: ADMIN_HEADERS });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getDoc ${path} failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return fromFields(body.fields || {});
}

// Delete a document (best-effort; 404 is fine).
export async function deleteDoc(path) {
  const res = await fetch(`${BASE}/${path}`, { method: 'DELETE', headers: ADMIN_HEADERS });
  if (!res.ok && res.status !== 404) throw new Error(`deleteDoc ${path} failed: ${res.status}`);
}

// List doc ids in a collection (e.g. 'items'). Returns [] when empty/missing.
export async function listDocIds(collection) {
  const res = await fetch(`${BASE}/${collection}`, { headers: ADMIN_HEADERS });
  if (!res.ok) return [];
  const body = await res.json();
  return (body.documents || []).map((d) => d.name.split('/').pop());
}

// Run a structured query: items where createdBy == uid. Returns matched docs.
export async function queryItemsByOwner(uid) {
  const res = await fetch(`${BASE}:runQuery`, {
    method: 'POST',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'items' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'createdBy' },
            op: 'EQUAL',
            value: { stringValue: uid },
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`queryItemsByOwner failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows
    .filter((r) => r.document)
    .map((r) => ({ id: r.document.name.split('/').pop(), ...fromFields(r.document.fields || {}) }));
}

// Wipe everything an emulator project knows (auth users + firestore docs). Used in
// globalSetup so each `cloud` run starts from a clean slate regardless of prior runs.
export async function clearFirestore() {
  const res = await fetch(
    `http://${HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error(`clearFirestore failed: ${res.status} ${await res.text()}`);
}

export async function clearAuth() {
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  const res = await fetch(`http://${authHost}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE',
  });
  // 404/200 both acceptable; only a connection error is fatal.
  if (!res.ok && res.status !== 404) throw new Error(`clearAuth failed: ${res.status}`);
}

export { PROJECT_ID, HOST, BASE };
