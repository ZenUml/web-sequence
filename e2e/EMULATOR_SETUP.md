# Emulator setup — the infra-gated E2E gap cases (NOW LIVE)

**STATUS (2026-06-18): DONE.** The `AUTH` / `CLOUD` / `PADDLE` cases from
`e2e/E2E_GAP_TEST_PLAN.md` are now LIVE, emulator-backed tests in
[`e2e/tests/cloud.spec.js`](tests/cloud.spec.js), run via the `cloud` Playwright
project. 34 of the 35 cases are real passing tests; the one residual case (FLD-2)
stays `test.fixme` in [`e2e/tests/cloud.fixme.spec.js`](tests/cloud.fixme.spec.js)
because it is blocked by a MISSING UI affordance, not by infrastructure.

```bash
# Run the whole emulator-backed cloud suite (boots emulators + the wired dev server):
yarn test:e2e:cloud           # == PW_CLOUD=1 playwright test --project=cloud
```

The signed-out staging gate (default `chromium` project) is UNCHANGED — it
`testIgnore`s the cloud specs and boots the plain dev server with no emulator.

The rest of this doc records the working recipe (and the two non-obvious traps the
prior sketch missed).

---

## 0. The two traps the original sketch missed

1. **The GLOBAL `firebase` v9.16.5 CLI cannot run the functions emulator here.** It
   is a pkg'd Mach-O binary whose bundled Node is too old to parse
   `firebase-admin@11`'s optional chaining (`this.appStore?.removeApp(...)`), so the
   functions emulator crashes on load (`SyntaxError: Unexpected token '.'`) and
   `/create-share` / `/get-shared-item` never work. **Fix:** use the v13 CLI that
   ships in `functions/node_modules/.bin/firebase` (a devDependency, `firebase-tools
   ^13`). v13 runs the functions emulator under the HOST Node (20), which loads
   `functions/index.js` cleanly. The cloud webServer command uses this binary.
   Prereq: `cd functions && npm install` (installs firebase-admin/-functions/mixpanel
   AND the v13 CLI).

2. **The Firestore emulator enforces `firestore.rules` even over REST.** Seeding a
   fixture item naively returns `403 PERMISSION_DENIED`. **Fix:** the emulator grants
   full admin access (bypassing all rules) to requests carrying
   `Authorization: Bearer owner` — `e2e/cloud/firestoreEmu.mjs` sets this on every
   seed/probe, so tests can set up arbitrary fixtures the client could never write.

---

The original scaffold notes (kept for reference): they cannot run in a plain
checkout because the signed-out staging gate runs anonymously against a live deploy,
so it never touches auth, Firestore, the cloud functions, or Paddle.

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

## 3. How the deterministic test sign-in actually works (no admin SDK)

The chosen approach signs in entirely **client-side** with an **unsigned Firebase
custom token** — no `firebase-admin` and no service-account key in the browser:

- The Auth emulator does NOT verify the custom-token signature, so a JWT with
  `alg:"none"` + an empty signature, minted for a chosen `uid`, is accepted by
  `signInWithCustomToken`. (Validated: `accounts:signInWithCustomToken` returns 200
  and an idToken whose `user_id` is exactly the uid we put in.)
- `web/src/services/firebase.ts`, gated on `VITE_USE_EMULATOR === '1'`:
  - connects the SDK to the Auth (:9099) + Firestore (:8080) emulators;
  - replaces popup `login(provider)` with a popup-free emulator sign-in (so the
    real `login-google` / `login-github` buttons sign in deterministically);
  - exposes `window.__e2eSignIn({ uid?, email? })` and a one-shot
    `window.__e2eForceAuthError(code)` (AUTH-4).
- The uid is derived from the email (`e2e-<slugified-email>`) OR passed explicitly,
  so seeded Firestore docs (`users/{uid}`, `items.createdBy`,
  `user_subscriptions/user-{uid}`) line up with the signed-in session. The test-side
  mirror is `uidForEmail()` in `e2e/tests/helpers/cloud.js`.

The spec's single sign-in seam is `signInViaEmulator(page, { uid?, email? })` in
`e2e/tests/helpers/cloud.js` — it waits for the dev hook, calls it, and waits for
`profile-trigger` to mount.

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
