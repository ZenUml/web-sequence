# ZenUML Web-Sequence — Frontend ↔ Backend Contract Specification

**Status:** Draft for approval
**Date:** 2026-06-06
**Scope:** The exact, **unchangeable** interface between the rewritten frontend and the existing Firebase backend. The backend (Cloud Functions, Firestore schema, security rules, indexes, Paddle integration, external services) is **frozen**. This document is the source of truth for everything the new frontend must send, expect, and store. It is technology-stack-neutral on the client side.

> Companion: `2026-06-06-web-sequence-rewrite-requirements.md` (feature/parity spec).
> All shapes below were verified against `functions/index.js`, `functions/webhook.js`, `functions/alert_parser.js`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `src/services/configuration.js`, `src/itemService.js`, `src/services/syncService.js`, `src/services/user_service.js`, `src/services/folderService.js`, and `src/javascript/firebase/subscription.js`.

---

## 1. Environments & Firebase Projects

| Domain / host | Firebase project | Notes |
|---|---|---|
| `app.zenuml.com` | **web-sequence-local** | Production. `authDomain: app.zenuml.com` |
| Chrome ext `kcpganeflmhffnlofpdmcjklmdpbbmef` | web-sequence-local | payment off |
| Edge ext `dkbmlkgijbidhjiojpmfchklncgimlpd` (local) | web-sequence-local | payment off |
| Edge ext `lbdlpjkkjmclkacflkdoaacpafjdiido` (store) | web-sequence-local | payment off |
| `staging.zenuml.com` | **staging-zenuml-27954** | Staging |
| `web-sequence-dev.web.app` | web-sequence-dev | Dev |
| *(fallback / unknown host)* | staging-zenuml-27954 | `defaultConfig` |

**Frontend obligation (C-ENV-1):** Select Firebase config by `window.location.hostname` from a per-host map; unknown hosts fall back to the staging config. Each entry provides `firebase` SDK config + Paddle product IDs + a `features.payment` boolean. The new app MUST keep this host→config mapping (values in `src/services/configuration.js`).

> Note: "production" Firebase project is literally named `web-sequence-local` — keep the name; it is the real prod project.

Emulator ports (local dev): functions `5002`, firestore `8080`, hosting `5000`, UI `4000`. Functions emulator initializes admin with `projectId: staging-zenuml-27954`.

---

## 2. Authentication

- **Mechanism:** Firebase Authentication, popup OAuth (`signInWithPopup`).
- **Providers:** Google (with `userinfo.profile` scope), GitHub (historical default), Facebook, Twitter.
- **User object fields used:** `uid`, `displayName`, `photoURL`, `email`, and `getIdToken()`.
- **ID token usage:** A fresh ID token (`getIdToken(true)`) is sent to Cloud Functions that require auth (`create_share`, `sync_diagram`) in the request **body** as `token`; `authenticate` expects it in the **`Authorization` header**.
- **Frontend obligation (C-AUTH-1):** Drive the app from a single auth-state subscription; on change, (re)load items, settings, and subscription. On the backend nothing changes.

---

## 3. Firestore Data Model

Access is a mix of **direct client SDK** access (guarded by security rules) and **Cloud Functions** (admin SDK, bypasses rules). The collections:

### 3.1 `items/{itemId}`
Owner-scoped diagram documents.

```
items/{itemId} = {
  id: string,
  title: string,
  js: string,                 // ZenUML DSL (primary content; also sent to share service)
  css: string,
  html: string,
  externalLibs?: { js: string, css: string },  // LEGACY: may exist on old items; preserve on round-trip, but the rewrite does NOT surface/edit/inject it (req spec REQ-DM-3)
  htmlMode: string,           // html | markdown | jade
  cssMode: string,            // css | scss | sass | less | stylus | acss
  jsMode: string,             // js | es6 | coffeescript | typescript
  cssSettings?: object,       // Atomic CSS config when cssMode = acss
  pages: [ { id: string, title: string, js: string, css: string, isDefault: boolean } ],
  currentPageId: string,
  sizes?: number[],           // code sub-pane split
  mainSizes?: number[],       // editor/preview split
  createdBy: string,          // = owner uid (REQUIRED on every write)
  updatedOn?: number|timestamp,
  folderId?: string,          // references users/{uid}.folders[].id
  // Sharing fields — written by backend create_share, never by client:
  isShared?: boolean,
  shareToken?: string,        // 32-char hex
  sharedAt?: timestamp,
  // imageBase64 is STRIPPED before persistence (size); never store it.
  // isReadOnly is a runtime-only flag returned by get_shared_item; not stored by client.
}
```

**Client access patterns (must be preserved):**
- **Read own item:** `doc(items/{id}).get()`, then verify `item.createdBy === currentUser.uid` client-side.
- **Read shared item:** via `get_shared_item` Cloud Function (NOT direct Firestore) — see §5.
- **List own items:** `collection('items').where('createdBy','==',uid).onSnapshot(...)` (real-time).
- **Write:** `doc(items/{id}).set(item, { merge: true })`. Before write: delete `imageBase64`; set `createdBy = uid`; ensure a `pages` array exists (migrate if missing — REQ-DM-2).
- **Batch import:** `writeBatch`: `set(items/{id}, item)` + `update(users/{uid}, { ['items.'+id]: true })`.
- **Delete:** `doc(items/{id}).delete()`.
- **Special key `code`:** `setItem('code', …)` writes only to local storage (last-open snapshot), never to Firestore.

### 3.2 `users/{uid}`
User profile, ownership map, settings, folders.

```
users/{uid} = {
  items: { [itemId: string]: true },   // ownership map
  settings: { [settingName: string]: value },  // mirrors preference list (req spec §9.2)
  folders?: [ { id: "folder-…", name: string, createdOn: number, updatedOn: number } ],
  lastSeenVersion?: string,
  // subscription is attached at runtime from user_subscriptions; not necessarily stored here.
}
```

**Client access patterns:**
- Auto-create on first access (`set({ items: {} })` if missing).
- Settings update: `update({ ['settings.'+name]: value })`.
- Ownership: `update({ ['items.'+id]: true })` / `update({ ['items.'+id]: FieldValue.delete() })`.
- **Folders:** stored as an **array on the user doc** (no separate collection, no dedicated rule).
  - Create: if user doc missing → `set({ folders: [folder] }, { merge: true })`; else `update({ folders: arrayUnion(folder) })`.
  - Rename / delete: **`runTransaction`** read-modify-write of the `folders` array (rename by id; delete by filtering id out).
  - Folder id format: `"folder-" + randomId`. Operations require sign-in.

### 3.3 `user_subscriptions/user-{uid}`
Subscription state, **written only by the Paddle webhook** (admin SDK), read by the client.

```
user_subscriptions/user-{uid} = {
  checkout_id, subscription_id, subscription_plan_id,
  status,                    // 'active' | 'trialing' | 'cancelled' | ...
  event_time, currency, unit_price, quantity,
  cancel_url, update_url,    // Paddle-hosted links
  email, marketing_consent,
  cancellation_effective_date?, next_bill_date?,
  passthrough,               // JSON string { userId, planType }  OR legacy plain userId string
}
```

**Client read:** `doc('user_subscriptions/user-'+uid).get()`; null if absent.
**Plan derivation (must match `user_service.js`):**
- `isSubscribed` = `status === 'active' || status === 'trialing'`.
- `getPlanType()` = `free` if not subscribed; else `JSON.parse(passthrough).planType`, or `'basic-monthly'` if passthrough is a legacy non-JSON userId string.
- `isBasic` = planType includes `basic`; `isPlus` = planType includes `plus`; `isPlusOrAdvanced` = `isPlus`.

---

## 4. Security Rules (frozen — `firestore.rules`)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function userExists() {
      return exists(/databases/$(database)/documents/users/$(request.auth.uid));
    }
    match /users/{userId} {
      allow read, update, delete: if request.auth.uid == userId;
      allow create: if request.auth.uid != null;
    }
    match /items/{itemId} {
      allow create: if userExists();
      allow read, update, delete: if resource.data.createdBy == request.auth.uid;
    }
    match /user_subscriptions/{userSubscriptionId} {
      allow create: if userExists();
      allow read, update, delete: if 'user-' + request.auth.uid == userSubscriptionId;
    }
  }
}
```

**Implications the frontend must respect (C-RULES-1):**
- Item reads/writes require `createdBy == auth.uid`. A user can only ever query/read their **own** items directly; shared items therefore **must** go through `get_shared_item` (admin SDK).
- `items` create requires the user doc to already exist → ensure `users/{uid}` exists before first item save.
- `folders` live inside `users/{uid}` and are covered by the user rule (no separate folder rule).
- `user_subscriptions` is readable only by its owner (`user-<uid>`); it is effectively client-read-only (writes come from the webhook).

**Index (`firestore.indexes.json`):** composite index on `items` (`createdBy` ASC, `updatedOn` DESC). Client-side folder filtering is done in memory after the `createdBy` query.

---

## 5. Cloud Functions HTTP API (frozen)

Two access styles:
- **Hosting-rewritten paths** (same-origin, listed in `firebase.json`): `/sync-diagram`, `/create-share`, `/get-shared-item`, `/authenticate`, `/track`, `/info`.
- **Raw Cloud Function URLs** (NOT rewritten): `webhook`, `supported_product_ids`.

In local dev, the Vite dev server proxies the rewritten paths to the functions emulator (`http://127.0.0.1:5002/<project>/us-central1/<fn>`). **Frontend obligation (C-FN-1):** keep these dev proxies.

### 5.1 `POST /create-share` → `create_share`
Create/refresh a share for an owned item.
- **Auth:** `body.token` = Firebase ID token (emulator accepts `"local-dev-token"`).
- **Request body:** `{ token, id, name, content, description, origin }` (frontend sends `name=title`, `content=js`, `description="Shared diagram from https://app.zenuml.com"`, `origin=window.location.origin`).
- **Backend behavior:** loads `items/{id}`; 404 if absent; **403 if `createdBy !== uid`**; reuses or generates `shareToken` (16-byte hex); updates the item `{ isShared:true, shareToken, sharedAt }`; computes `md5(item.js)`.
- **Response 200:** `{ page_share: "<origin>?id=<id>&share-token=<token>", md5 }`. (`origin` falls back to localhost/staging/app per env if not supplied.)
- **Errors:** `400` missing id; `404` not found; `403` not owner; `500` failure.
- **Frontend:** final share URL = `page_share + ("?"|"&") + "v=" + md5`.

### 5.2 `GET /get-shared-item` → `get_shared_item`
Fetch a shared item read-only, **no auth required** (admin SDK bypasses rules).
- **Query:** `?id=<itemId>&share-token=<token>` (token accepted as `share-token` or `token`).
- **Behavior:** 400 if params missing; 404 if item missing; **403 unless `isShared === true && shareToken === token`**.
- **Response 200:** the full item document **plus** `isReadOnly: true`.

### 5.3 `POST /authenticate` → `authenticate`
- **Auth:** `Authorization` header = ID token.
- **Response:** the decoded `uid` (plain text). (Validation helper; not central to flows.)

### 5.4 `POST /sync-diagram` → `sync_diagram` (legacy external share via LaraSite)
- **Auth:** `body.token` = ID token.
- **Request:** `{ token, id, name, content, description, imageBase64 }`.
- **Behavior:** verifies token; builds `user = { name, id, email, email_verified, picture }`; HTTPS POSTs to LaraSite `https://<larasite.host>/diagrams` with `{ token, user, firebase_diagram_id:id, name, content, description, imageBase64 }`; rewrites `page_share` base URL to the public base URL; returns LaraSite's response.
- **Config:** `larasite.host` (staging `sequence-diagram-staging.zenuml.com`, prod `sequence-diagram.zenuml.com`); `larasite.public_base_url` (staging same host, prod `https://zenuml.com/sequence-diagram`).
- **Status:** The current frontend's share flow calls **`/create-share`**, not `/sync-diagram`. Treat `/create-share` as the active share path; `/sync-diagram` remains available but is not on the primary path. (See OQ in §9.)

### 5.5 `POST /track` → `track`
- **Request:** `{ event, userId, ...properties }` (frontend also sends `category`, `label`, `value`).
- **Behavior:** sends to Mixpanel with `distinct_id=userId`, `displayProductName="FireWeb"`, plus all extra properties. Non-blocking.
- **Response:** `200 "Event tracked successfully"`; `400` if `event` missing.

### 5.6 `GET /info` → `info`
- Health check; returns `"Hello from <GCLOUD_PROJECT>!"`. Referenced for rewrites; not used in flows.

### 5.7 `POST <raw>/webhook` → `webhook` (Paddle → backend; NOT frontend-callable)
- Paddle posts subscription events here directly (raw `cloudfunctions.net` URL, no hosting rewrite).
- Validates `p_signature` (Paddle public key, SHA1 + PHP-serialize); supports `subscription_created` and `subscription_cancelled`; checks `subscription_plan_id` against the configured supported list; extracts `userId` from `passthrough` (JSON `{userId}` or legacy raw string); requires `users/{userId}` to exist; writes `user_subscriptions/user-{userId}`.
- **Frontend never calls this.** Webhook URL is registered in the Paddle dashboard per project. Document only.

### 5.8 `GET <raw>/supported_product_ids` → `supported_product_ids`
- Returns the JSON array of configured Paddle product IDs (from functions config). Server-side gating helper; **not called by the frontend**.

---

## 6. External Services

### 6.1 Paddle (Classic — vendor `39343`)
- **SDK:** Paddle **Classic v1.x** (`https://cdn.paddle.com/paddle/paddle.js`; extension uses bundled local `/lib/paddle.js`). NOT Paddle Billing v2.
- **Init:** `Paddle.Setup({ vendor: 39343 })`. Retry until `window.Paddle` is available.
- **Checkout:** `Paddle.Checkout.open({ product: <productId>, email, passthrough: JSON.stringify({ userId, planType }), successCallback })`.
- **Product IDs:**

| planType | Prod (web-sequence-local) | Staging / dev (test) |
|---|---|---|
| basic-monthly | 879334 | 552378 |
| plus-monthly | 883078 | 882893 |
| basic-yearly | 879927 | 882890 |
| plus-yearly | 883082 | 882891 |

- **Webhook fields** (received by backend §5.7): `alert_name`, `p_signature`, `passthrough`, `subscription_id`, `subscription_plan_id`, `status`, `cancel_url`, `update_url`, `checkout_id`, `currency`, `unit_price`, `quantity`, `event_time`, `marketing_consent`, `next_bill_date`, `cancellation_effective_date`.
- **Frontend obligation (C-PAY-1):** keep Classic SDK + `passthrough` `{userId, planType}` (and legacy plain-userId tolerance). Using the modern Billing SDK would silently break checkout and webhook handling — do not switch without a backend change (out of scope).

### 6.2 LaraSite (external diagram share service)
Proxied by `sync_diagram` only (§5.4). The frontend does not call LaraSite directly.

### 6.3 Mixpanel
Server-side via `track` (token `78617e65fdba543d752fb7f6483d55f4`). Client-side analytics (Google Tag Manager, Mixpanel, Microsoft Clarity) load conditionally: CDN-based ones are skipped under the `chrome-extension:` protocol; GTM has a local copy for the extension.

---

## 7. Client-Side Storage Keys

The new app must preserve these keys/shapes so existing users keep their data and one-time prompts behave.

### 7.1 Local storage (web) / `chrome.storage` (extension)
- `items` — map `{ [itemId]: true }` of locally-known items (anonymous mode).
- `<itemId>` — full item JSON (anonymous/extension individual storage).
- `code` — last-open working item snapshot (for `preserveLastCode` restore on load; written on unload).
- `loginAndsaveMessageSeen` — suppress the local-save warning after first view.
- `askedToImportCreations` — the local→cloud import offer was shown.
- `pledgeModalSeen` — support/pledge modal shown.
- `onboarded` — onboarding completed.
- `lastSeenVersion` — last app version the user saw (drives changelog/pledge; compared via semver).
- `lastAuthProvider` — `google | github | facebook | twitter` (login hint).
- All preference keys from req spec §9.2 (synced via the local/`chrome.storage.sync` backend).

### 7.2 Settings backend split (C-STO-1)
- Web app → local browser storage.
- Extension → `chrome.storage.sync` (keys include `preserveLastCode`, `replaceNewTab`, `lastSeenVersion`).
- Signed-in users → additionally `users/{uid}.settings`.

### 7.3 Firestore offline persistence
Enable persistence with multi-tab synchronization; on the multi-tab `failed-precondition` error, warn once and continue without persistence (do not block the app).

---

## 8. URL Parameters (contract)

| Param | Meaning |
|---|---|
| `id` / `itemId` | Load a specific diagram |
| `share-token` | With `id`: load via `get_shared_item` (read-only) |
| `v` | Cache-buster (md5 of content) appended to share links |
| `code` | Inline diagram source (embed/share-by-value) |
| `title` | Diagram title (embed) |
| `embed` | Embed mode (minimal UI, shortcuts off) |
| `stickyOffset` | Passed to the renderer |

---

## 9. Frozen-Contract Checklist & Open Questions

**The new frontend MUST:**
1. Use the host→Firebase-config map and staging fallback (§1).
2. Authenticate via Firebase popup OAuth (Google/GitHub/Facebook/Twitter) and send ID tokens exactly where each endpoint expects them (§2, §5).
3. Read/write `items`, `users`, `user_subscriptions` with the exact field shapes, ownership rule, `createdBy` stamping, `imageBase64` stripping, pages migration, and folder-array transactions (§3, §4).
4. Call the six hosting-rewritten endpoints with the documented payloads and handle the documented responses/errors (§5); keep dev proxies.
5. Load shared items only through `get_shared_item`; never attempt direct Firestore reads of others' items (§4, §5.2).
6. Keep Paddle **Classic** checkout with `{userId, planType}` passthrough and the env product-ID table (§6.1).
7. Preserve all client storage keys and one-time-prompt flags (§7) and the URL-parameter contract (§8).
8. Preserve subscription-status and plan-type derivation logic (§3.3).
9. Make **no** change to Cloud Functions, Firestore schema, rules, indexes, or external services.

**Contract decisions (resolved):**
- **CQ-1 — Drop LaraSite.** The frontend already shares only via `/create-share` (the JS fn `syncDiagram()` calls `/create-share`, not `/sync-diagram`). The rewrite wires only `/create-share`; the dormant `/sync-diagram` Cloud Function is left deployed but never called.
- **CQ-2 — Add frontend-only "Stop sharing".** Token revoke/rotate is achievable client-side (owner may `update` their own item doc per the rules — no backend change). The rewrite adds a "Stop sharing" control that sets `isShared: false` and mints a fresh `shareToken` on next share (old links die). See requirements REQ-SHR-5.
- **CQ-3 — Keep parity (no item writes on folder delete).** `deleteFolder` removes only the folder; items keep an orphaned `folderId` and render "Unfiled" via the existence-check grouping (`folders.some(f => f.id === item.folderId)`). No batch rewrite.
- **CQ-4 — Keep parity (load all).** Single `where('createdBy','==',uid)` query, no pagination (it would break client-side content-search + grouping, and can't cut download cost without a backend index). Render virtualization is the frontend-only escape hatch if a large library ever lags.
- **CQ-5 — Firebase modular SDK v10+, multi-tab supported.** Use `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`. Because v10 supports multiple tabs, the legacy "multi-tab not supported" warning is **removed** (see requirements REQ-PST-4); gracefully fall back to a memory cache if IndexedDB is unavailable (private browsing).
