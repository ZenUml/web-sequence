# Emulator setup — unlocking the infra-gated E2E gap cases

The `AUTH` / `CLOUD` / `PADDLE` cases in `e2e/E2E_GAP_TEST_PLAN.md` are scaffolded
as **pending** (`test.fixme`) in [`e2e/tests/cloud.fixme.spec.js`](tests/cloud.fixme.spec.js).
They cannot run in a plain checkout: the signed-out staging gate runs anonymously
against a live deploy, so it never touches auth, Firestore, the cloud functions,
or Paddle. This doc is the concrete recipe to stand that infra up locally and flip
each `test.fixme(...)` → `test(...)`.

What unlocks what (from the gap-plan coverage map):

| Bucket   | Cases                                                                     | Infra needed                                       |
| -------- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| `AUTH`   | AUTH-1..6, IOL-1, SHR-1, HDR-6, CSS-5, SUB-5                              | Firebase **Auth** emulator + a seeded test user    |
| `CLOUD`  | IOL-2/3, FLD-1..5, SHR-2..8, PST-2/3/4, HDR-4, EMB-1, NET-2, SET-7, SUB-4 | **Auth + Firestore + Functions** emulators         |
| `PADDLE` | SUB-2, SUB-3                                                              | mocked `window.Paddle` (no sandbox account needed) |

---

## 1. Why a separate Playwright project

`playwright.config.js` boots the app via `pnpm -C web dev` (port 3000) with **no**
emulator. These cloud cases need the app pointed at the Firebase emulators instead.
Add a second project rather than mutating the existing one, so the signed-out
staging gate is untouched.

```js
// playwright.config.js — add to `projects` (sketch)
{
  name: 'cloud',
  testMatch: /cloud\.fixme\.spec\.js/,        // rename to *.cloud.spec.js once un-fixme'd
  use: { ...devices['Desktop Chrome'] },
},
```

And add an emulator-backed web server to `resolveWebServers()` (guarded by an env
flag so it only runs when you intend to exercise the cloud project):

```js
// the app must boot with VITE_USE_EMULATOR=1 so firebase.ts wires the emulators (§2)
{
  command: 'firebase emulators:exec --only auth,firestore,functions "VITE_USE_EMULATOR=1 pnpm -C web dev"',
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env.CI,
  timeout: 180 * 1000,
},
```

Emulator ports are already declared in [`firebase.json`](../firebase.json):
`auth` (add it — see §2), `firestore` :8080, `functions` :5002, UI :4000.
Add the auth port to `firebase.json`:

```jsonc
"emulators": {
  "auth":      { "port": 9099 },   // ADD THIS
  "functions": { "port": 5002 },
  "firestore": { "port": 8080 },
  "hosting":   { "port": 5000 },
  "ui": { "enabled": true, "port": 4000 }
}
```

---

## 2. Wire the app to the emulators (`web/src/services/firebase.ts`)

Today [`web/src/services/firebase.ts`](../web/src/services/firebase.ts) calls
`getAuth(app)` and `initializeFirestore(app, …)` with **no** emulator connection.
Add an opt-in block, gated on a Vite env flag so production builds never connect:

```ts
// web/src/services/firebase.ts — after `export const auth` / `export const db`
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';

if (import.meta.env.VITE_USE_EMULATOR === '1') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
}
```

The cloud-function rewrites (`/create-share`, `/sync-diagram`, `/get-shared-item`,
defined in [`firebase.json`](../firebase.json)) are served by the **functions**
emulator. `firebase emulators:exec` makes the hosting rewrites resolve to the local
functions automatically; if you boot `pnpm -C web dev` directly instead, proxy
those paths to `http://localhost:5002` in `web/vite.config.*` so the relative
`fetch('/get-shared-item?…')` in
[`web/src/services/cloudFunctions.ts`](../web/src/services/cloudFunctions.ts) hits
the emulator.

> NOTE: the functions emulator runs `functions/index.js`. `create_share` /
> `get_shared_item` read/write Firestore via the admin SDK — with the Firestore
> emulator up, the admin SDK auto-targets it when `FIRESTORE_EMULATOR_HOST` is set,
> which `emulators:exec` sets for you.

---

## 3. Seed a test user (Auth emulator)

The Auth emulator accepts unsigned tokens and lets you create users via its REST
API or the admin SDK — no real Google/GitHub OAuth round-trip. Two ways:

**A. Admin SDK (deterministic, recommended)** — a global-setup script mints users
and custom tokens against the emulator:

```js
// e2e/cloud/seed.mjs  (run from Playwright globalSetup)
import admin from 'firebase-admin';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
admin.initializeApp({ projectId: 'web-sequence-local' });

export async function seedUser(uid, email) {
  await admin
    .auth()
    .createUser({ uid, email, displayName: 'E2E User' })
    .catch(() => {});
  return admin.auth().createCustomToken(uid); // the test signs in with this
}
```

**B. Emulator REST** — `POST http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`
with `{ email, password, returnSecureToken: true }`. Returns an idToken you can
inject. Heavier than the admin SDK; prefer A.

---

## 4. The in-page sign-in hook the spec calls

`cloud.fixme.spec.js` calls `window.__e2eSignIn({ uid, email })` (and
`window.__e2eForceAuthError`). Expose these **dev-only** hooks so the spec can
authenticate deterministically without driving an OAuth popup. Add to
`web/src/services/firebase.ts` behind the same `VITE_USE_EMULATOR` flag:

```ts
import { signInWithCustomToken } from 'firebase/auth';
if (import.meta.env.VITE_USE_EMULATOR === '1') {
  // The test mints the token via the admin SDK (§3A) and passes it in, OR the
  // hook fetches one from a tiny local endpoint. Keep this OUT of prod bundles.
  (window as any).__e2eSignIn = async ({ token }: { token: string }) =>
    signInWithCustomToken(auth, token);
  (window as any).__e2eForceAuthError = (code: string) => {
    (window as any).__e2eAuthErrorCode = code; // LoginModal/onLogin reads + throws this
  };
}
```

The spec's `signInViaEmulator()` helper is the single seam — point it at whichever
of A/B you choose; nothing else in the spec changes.

---

## 5. Firestore admin probes (the "no cloud write" / "synced" assertions)

Several cases assert a Firestore **side effect**, not just UI: IOL-2/3 (uploaded /
not uploaded), SUB-4 (4th doc withheld), NET-2 (offline edit synced after
reconnect), SET-7 (settings persisted). Read the emulator directly with the admin
SDK in the test (or a fixture):

```js
import admin from 'firebase-admin'; // already pointed at the emulator (§3)
const db = admin.firestore();
const snap = await db.collection('users').doc(uid).collection('items').get();
expect(snap.size).toBe(expectedCount);
```

The web client writes diagrams under the user's items collection and folders on the
`users/{uid}` doc (`folders` field) — confirm the exact paths in
`web/src/services/itemService.ts` / `folderService.ts` when you wire each probe.

---

## 6. Mocking Paddle (SUB-2, SUB-3) — no sandbox account needed

[`web/src/hooks/usePaddle.ts`](../web/src/hooks/usePaddle.ts) has a deliberate
seam: `ensurePaddle()` (line ~61) sees an existing `window.Paddle` and **skips the
CDN inject**, just calling `Setup`. So a Playwright `addInitScript` that installs a
stub BEFORE app boot fully controls checkout — the spec already does this:

```js
await page.addInitScript(() => {
  window.__paddleCalls = [];
  window.Paddle = {
    Setup() {},
    Checkout: { open: (o) => window.__paddleCalls.push(o) },
  };
});
// … later, assert openCheckout was called with the right plan:
const calls = await page.evaluate(() => window.__paddleCalls);
expect(JSON.parse(calls[0].passthrough)).toMatchObject({
  planType: 'plus-monthly',
});
```

`openCheckout` (usePaddle.ts:92) resolves the product id from `firebaseConfig.ts`
and passes `JSON.stringify({ userId, planType })` as `passthrough` — that's the
assertable contract. No Paddle sandbox vendor/account is required for the E2E
gate; the unit test `web/src/hooks/usePaddle.test.tsx` already covers the SDK
plumbing, and these E2E cases only verify the **UI → openCheckout wiring**.

---

## 7. Flipping the scaffold on

Once §1–§6 are in place, per case:

1. Replace `test.fixme(` → `test(` for the cases whose infra is now live.
2. Run only the cloud project: `npx playwright test --project=cloud`.
3. Tighten any sketch that the real run surfaces (timing waits, exact seed shape,
   the precise move-to-folder / manage-subscription testids marked "TBD" inline).

Rename the file `cloud.fixme.spec.js` → `cloud.spec.js` when the majority are
active, and add the `cloud` project to CI as a **separate** job from the
signed-out staging gate (it needs the emulator services, so it can't share the
anonymous-against-live-deploy runner).
