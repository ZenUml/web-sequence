# Milestone 04 — Subscription + Settings + Modal Inventory + Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. Read the roadmap (`…-roadmap.md`, esp. §3 types, §4 service interfaces, §8 decisions, §9 carry-forward — the M04 entries are load-bearing), the requirements spec (`…-requirements.md` §8 Accounts/Subscription/Gating — REQ-SUB-1..7, §9 Settings — REQ-SET-1..4 + REQ-PST, §11 Keyboard — REQ-KB-1, §13 Modals — REQ-MOD-1..5, §14 Analytics — REQ-ANL-1), the contract spec (`…-frontend-backend-contract.md` §1 host→config, §3.3 user_subscriptions + plan derivation, §5.5 `/track`, §6.1 Paddle Classic, §7 storage keys/flags), and the **design system** (`2026-06-07-design-system.md` — MANDATORY for all UI). M00+M01+M02+M03 are complete on `rewrite/web-foundation`.

**Goal:** A signed-in user can upgrade/cancel via Paddle Classic checkout and see a pricing modal; plan limits (3/20/∞ saved files, Plus-only custom CSS) are enforced with a **softened** non-blocking notice (cloud write skipped, local save kept); the full Settings modal exposes every preference (load-once, live-apply, persisted local+cloud); the complete modal inventory (Settings, Pricing, Help, Keyboard-Shortcuts, Cheat-Sheet, Create-New/templates, Onboarding, Support-pledge, Atomic-CSS-settings) is present with one-time-prompt logic; the profile menu shows Pro/plan/upgrade; and analytics events fire to `/track` + client GTM/Mixpanel/Clarity (anonymous→null userId, skip CDN under extension, route to console in debug) — all against the FROZEN backend.

**Architecture:** New framework-agnostic services — `subscriptionService.ts` (read `user_subscriptions/user-{uid}`), `analytics.ts` (client fan-out: GTM/Mixpanel/Clarity conditional load), `cloudFunctions.ts` gains `trackEvent` (POST `/track`); a pure `planLimit.ts` (over-cap decision from the ownership map); a typed `templates.ts` data module (4 curated templates ported from legacy `src/templates/*.json`). A `uiStore` gains a **single modal-open enum** (`activeModal`) + a `pricing` open flag. **Hooks** `useSubscription`, `useAnalytics`, `usePaddle` bridge them into React. Presentational modals live in `components/modals/` and `components/subscription/`. The integrate stage wires: the AppRoot save-seam (plan limit + trackEvent), trackEvent emit-points, modal mounting, Paddle script-load + checkout, subscription-load-on-auth, one-time-prompt triggers (semver pledge), and settings persist/live-apply. **Settings live-apply** flows through the existing `settingsStore.merge` (M01/M02 already consume it in the editor); M04 only adds the UI + the persist/cloud-sync wiring.

**Tech Stack:** Firebase modular v10 (`firestore`: `doc`, `getDoc`; `auth`), React 19, Zustand, Radix (Dialog/DropdownMenu/Popover — all primitives already in `web/src/ui/`), Tailwind + the Drafting Table design system, Paddle **Classic** v1.x SDK (`https://cdn.paddle.com/paddle/paddle.js`, vendor `39343`), Vitest + RTL + MSW, Playwright.

---

## Pre-flight (read once)

- **Working dir:** all commands `pnpm -C web …` from repo root (cwd drifts). Installs use `pnpm -C web add --ignore-workspace …`. Branch `rewrite/web-foundation` — do NOT branch. Touch only `web/src/**` (+ `e2e/` for E2E). NEVER modify legacy `src/` or any backend asset (Cloud Functions / Firestore rules / indexes / external services are FROZEN — NFR-1). The Paddle **Classic** SDK + vendor `39343` + `{userId, planType}` passthrough are FROZEN (contract C-PAY-1) — do NOT switch to Paddle Billing v2.
- **DESIGN SYSTEM (mandatory for every UI task):** build from `web/src/ui/` primitives (`Button`, `IconButton`, `TextInput`, `SearchInput`, `Dialog`/`DialogContent`, `Popover*`, `Menu*`, `cn`) + Tailwind semantic tokens per `docs/superpowers/specs/2026-06-07-design-system.md`. **All modals sit on the paper surface** (`DialogContent` already renders paper + `shadow-pop` + serif title) — pass `surface="light"` to `Button`s inside them. `font-mono uppercase tracking-[0.12em] text-[11px]` for metadata/labels/plan names/counts; `font-serif` (via `DialogContent` title) for headlines. **One `Button variant="primary"` per modal.** No `gray-*`/raw hex/ad-hoc fonts. Keep every `data-testid`. If a primitive is missing, ADD it to `web/src/ui/` (wrapping the matching Radix part) before building the feature.
- **M00–M03 give you (REUSE — do NOT reimplement):**
  - `domain/plan.ts`: `isSubscribed(s)`, `getPlanType(s)` (passthrough → planType; legacy plain-userId → `'basic-monthly'`), `isPlus(s)`, `isBasic(s)`. **Use these — do NOT re-derive plan logic.**
  - `config/constants.ts`: `FILE_LIMITS = { free: 3, basic: 20 }`, `AUTO_SAVE_INTERVAL`, `UNSAVED_WARNING_COUNT`, `LS_KEYS` (incl. `pledgeModalSeen`, `onboarded`, `lastSeenVersion`, `loginAndSaveMessageSeen`, `askedToImportCreations`, `lastAuthProvider`).
  - `config/firebaseConfig.ts`: `config` (resolved per host) + `resolveConfig(hostname)` — already carries `paddleProductBasicMonthly|PlusMonthly|BasicYearly|PlusYearly` + `features.payment`. **Paddle product IDs + the payment flag already exist** — read them from `config`; do NOT add a new product map.
  - `state/settingsStore.ts`: `useSettingsStore` with `settings: Settings` + `merge(partial)` (key-filtered). The editor (M01/M02) already reads `settings.editorTheme/keymap/fontSize/...` live — calling `merge` IS the live-apply.
  - `services/userService.ts`: `getUserSettings(uid)`, `setUserSetting(uid, key, value)`, `ensureUser(uid)`, `setItemForUser`/`unsetItemForUser`, `getUserItemIds`.
  - `services/storage.ts`: `localStore` (LS) + `syncStore` (chrome.storage.sync on extension else LS). Settings persist to `syncStore`; flags to `localStore`.
  - `services/cloudFunctions.ts`: `createShare`, `getSharedItem` (M04 ADDS `trackEvent`).
  - `services/itemService.ts`: `makeItemService(getAuth)` → `getItem/setItem/saveItems/removeItem/setItemForUser/unsetItemForUser/subscribeAllItems/saveLastCode/moveToFolder/stopSharing`.
  - `hooks/useAuth.ts` (`login(provider)`, `logout()`), `state/authStore.ts` (`user`, `authReady`, `online`).
  - `components/auth/LoginModal.tsx`, `components/auth/ProfileMenu.tsx` (**EXTEND** for Pro badge/plan/upgrade — do NOT author a separate Profile modal), `components/modals/ConfirmDialog.tsx`, `components/modals/AskToImportModal.tsx`.
  - `domain/types.ts`: `Settings`, `DEFAULT_SETTINGS`, `Subscription`, `PlanType`, `AppUser`, `Item`, `JsMode`/`CssMode`/`HtmlMode`.
- **Plan-limit ground truth (legacy `src/components/app.jsx` 467-482, `checkItemsLimit`) — EXACT BOUNDARY:** legacy checks the **pre-insert** ownership-map count (`checkItemsLimit` runs BEFORE `setItemForUser` registers the item — confirmed in legacy `saveBtnClickHandler`, and the rewrite must mirror this by sampling owned ids before the cloud write). Allowed (`return true`) when: not signed in (local-only — no cloud cap) OR `count <= 3` OR `isPlusOrAdvanced` OR (`count <= 20 && isBasic`). The legacy-exact predicate over the pre-insert count is therefore **`ownedIds.length > limitFor(subscription)`** — NO `+1`, NO `ownedIds.includes(itemId)` branch. Worked example (free, limit 3): at 2 owned, saving the 3rd new item → `2 > 3` false → ALLOWED; at 3 owned, saving the 4th new item → `3 > 3` false → ALLOWED (legacy admits the (limit+1)-th new item — the `<=` check passes); at 4 owned, saving the 5th → `4 > 3` true → BLOCKED. Two consequences to ENCODE:
  1. **Legacy blocks purely on the count — there is NO `includes`/new-vs-resave branch.** A re-save of an already-owned item is treated identically to a new save: legacy reads `Object.keys(user.items).length` and applies `<= limit`, regardless of whether the saved id is already a member. So at count 4 (free, limit 3) re-saving owned item `a` reads length 4, `4 <= 3` is false → legacy ALERTS + blocks. The predicate `ownedIds.length > limitFor(sub)` already reproduces this exactly (`4 > 3` = true = over-cap). **Do NOT add an `ownedIds.includes(itemId)` short-circuit** — that would diverge from legacy by wrongly admitting an over-cap re-save. The only reason the predicate is *identical* for new vs re-save is that the count is sampled PRE-INSERT (a re-save does not grow the count, a new save's id is not yet registered), so `length` is the same quantity legacy reads in both cases — NOT because re-saves are specially exempted.
  2. Per REQ-SUB-5 the rewrite **softens presentation**: enforcement is preserved (**the cloud write is skipped** for the over-cap new item) but the **local save still succeeds**, and the user sees a **non-blocking notice with an inline upgrade affordance** — NOT a blocking `alert()` + force-opened pricing modal. The pricing modal is *offered*, not forced.
- **Analytics ground truth (legacy `src/analytics.js` + emit sites):** `trackEvent(category, action, label, value)` → Mixpanel `track({ event: action, category, label, value })`, routed to console when `window.DEBUG`. The rewrite uses the **canonical roadmap §4 signature** instead: `trackEvent(payload & { event: string; userId: string | null })`. REQ-ANL-1: dual path — POST `/track` (server, §5.5) **and** client GTM/Mixpanel/Clarity; skip CDN-loaded scripts under `chrome-extension:`; route to console in debug mode; anonymous events carry `userId: null`.

### Key facts from the contract (ground truth — match EXACTLY)
- **`user_subscriptions/user-{uid}`** (§3.3) is **client-read-only** (webhook writes it). Read: `getDoc(doc(db, 'user_subscriptions/user-' + uid))` → the doc data, or `null` if absent (and on any error — legacy `subscription.js:19` swallows errors to `null`).
- **Plan derivation** (§3.3) is already implemented in `domain/plan.ts` — `isSubscribed = status active|trialing`; `getPlanType` = `'free'` if not subscribed, else `JSON.parse(passthrough).planType` (or `'basic-monthly'` for a legacy plain-userId passthrough). REUSE.
- **Paddle Classic checkout** (§6.1): `Paddle.Setup({ vendor: 39343 })` once; `Paddle.Checkout.open({ product: <productId>, email, passthrough: JSON.stringify({ userId, planType }), successCallback })`. Product ID = `config.paddleProduct<Plan><Period>` for the selected `planType`. SDK from `https://cdn.paddle.com/paddle/paddle.js` (web); the extension would bundle `/lib/paddle.js` (M05). On success: prompt to refresh + reload subscription state. Non-logged-in upgrade → sign-in first.
- **Cancellation** (REQ-SUB-4): subscribed users get a "Cancel subscription" link to the Paddle-hosted `subscription.cancel_url` (open in a new tab).
- **Payment feature flag** (REQ-SUB-6): `config.features.payment` gates **ALL** billing UI. On for web hosts, off for every extension host. When off, hide the entire billing subsystem (no Pricing modal, no Upgrade control, no checkout).
- **POST `/track`** (§5.5): body `{ event, userId, ...properties }` (the rewrite also sends `category`, `label`, `value`). Non-blocking; `200` on success, `400` if `event` missing. Anonymous → `userId: null`.
- **One-time flags** (§7, REQ-MOD-3): `onboarded`, `pledgeModalSeen` (triggers when `lastSeenVersion` < current app version via semver compare), `askedToImportCreations` (M02), `loginAndSaveMessageSeen` (M02). Each modal appears at most once; mark the flag on first show/dismiss.

### Deferred (recorded, not silently dropped) — record in roadmap §9 in Task 1
- **Extension/embed surfaces + production cutover + extension-bundled Paddle (`/lib/paddle.js`)** → **M05**. M04 builds the analytics/Paddle conditional structure (skip-CDN-under-extension, `chrome.storage` settings backend already abstracted by `syncStore`) so M05 only flips host detection.
- **Login-modal OAuth error surfacing** (roadmap §9 M04 carry-forward): `useAuth.login` currently swallows non-account-exists errors to console and `window.alert`s account-exists. M04 surfaces both in the LoginModal as a design-system notice (Task in integrate stage).
- **Settings live-sync is load-once** (OQ-5 resolved): settings load once on sign-in; changes write to `syncStore` + cloud but the app does NOT subscribe to remote settings changes. The item list stays live (M03).
- **`layoutMode`, `infiniteLoopTimeout`, `isCodeBlastOn`, `isJs13kModeOn`** are dropped from `Settings` (roadmap §3) — the Settings UI must NOT surface them.

---

## File structure (this milestone)

```
web/src/
  services/
    subscriptionService.ts    # retrieveSubscription(uid) → Subscription | null  (read user_subscriptions/user-<uid>)
    analytics.ts              # client fan-out: GTM/Mixpanel/Clarity conditional load + emit; debug→console; extension→skip CDN
    cloudFunctions.ts         # (extend) trackEvent(payload) → POST /track
  domain/
    planLimit.ts             # (pure) isOverFileLimit({ subscription, ownedIds, itemId }) → boolean (legacy-exact: ownedIds.length > limitFor) + limitFor(subscription)
    templates.ts             # (data) 4 curated templates (basic / black-white / blue / starUMLTheme) ported from legacy src/templates/*.json
  hooks/
    useSubscription.ts       # load subscription on uid change → { subscription, planType, subscribed, loading, reload }
    useAnalytics.ts          # trackEvent bound with the current userId; page-view on mount
    usePaddle.ts             # ensure Paddle script + Setup(vendor); openCheckout({ planType, email, userId, onSuccess })
  state/
    uiStore.ts               # (extend) activeModal: ModalName | null + open/close; replaces ad-hoc booleans
  components/
    subscription/
      PricingModal.tsx       # tiers, monthly/yearly toggle, savings, Enterprise→contact, per-tier upgrade (REQ-SUB-1/3)
      LimitReachedNotice.tsx # non-blocking over-cap notice with inline "Upgrade" affordance (REQ-SUB-5)
      ProBadge.tsx           # small Pro indicator for the avatar (REQ-SUB-7)
    modals/
      SettingsModal.tsx      # full §9.2 preference list; presentational (settings + onChange injected) (REQ-SET)
      CreateNewModal.tsx     # blank + 4 templates (REQ-MOD-4)
      HelpModal.tsx          # links/about (REQ-MOD-1)
      CheatSheetModal.tsx    # ZenUML DSL reference w/ examples (REQ-ED-6)
      KeyboardShortcutsModal.tsx  # the §11 shortcut table (REQ-KB-1)
      OnboardingModal.tsx    # first-run welcome (presentational) (REQ-MOD-3)
      SupportPledgeModal.tsx # version-upgrade pledge (presentational) (REQ-MOD-3)
      AtomicCssSettingsModal.tsx  # edits cssSettings when cssMode=acss (REQ-ED-2)
  ui/
    Select.tsx / Switch.tsx / Textarea.tsx  # (add) form primitives for settings/pricing/acss modals (Task 8b — SEQUENTIAL, edits ui/index.ts)
  app/
    AppRoot.tsx              # (modify) mount modal inventory; wire save-seam (plan limit + trackEvent); subscription-on-auth; one-time triggers; settings persist/live-apply
  components/auth/
    LoginModal.tsx           # (modify) surface OAuth errors (roadmap §9 carry-forward)
    ProfileMenu.tsx          # (modify) Pro badge + "My Plan (planType)" + Upgrade/Cancel (REQ-SUB-7)
  components/header/
    AppHeader.tsx            # (modify) add the modal-trigger buttons (Settings/Help/Pricing/Create-New) into the header/menu
```

---

### Task 1: Record M04 scope deferrals in roadmap §9

**Files:** Modify `docs/superpowers/plans/2026-06-06-web-sequence-rewrite-roadmap.md`

- [ ] **Step 1:** Append to roadmap "## 9. Adversarial-review carry-forward":
```markdown
- **M04 scope boundaries (recorded).** Extension + embed surfaces + production cutover + extension-bundled Paddle (`/lib/paddle.js`) → M05 (M04 builds the conditional structure: skip-CDN-under-extension in `analytics.ts`/`usePaddle.ts`, `syncStore` already abstracts the settings backend). Settings are **load-once** (OQ-5) — written to `syncStore` + cloud on change but no remote settings subscription; the item list stays live. Plan-limit softening (REQ-SUB-5): enforcement preserved (cloud write SKIPPED for an over-cap save, local save kept) with a non-blocking `LimitReachedNotice` + inline upgrade — NOT `alert()`+forced modal. Limit predicate is **legacy-exact** — `ownedIds.length > limitFor(sub)` over the PRE-INSERT ownership map (matching legacy `checkItemsLimit`, which runs before `setItemForUser` and admits the (limit+1)-th NEW item). Legacy blocks purely on count with NO `includes`/new-vs-resave branch: an over-cap re-save is blocked exactly as a new save is. The save-seam additionally **gates enforcement on `!useSubscription().loading`** (auth-resolved-before-read race guard): while the subscription read is in flight the user transiently derives to `'free'`, so enforcing would falsely block a paying user AND silently skip their cloud write — therefore an unresolved subscription is treated as not-yet-known and the cloud write proceeds. Paddle stays **Classic** (vendor 39343, `{userId, planType}` passthrough — contract C-PAY-1). LoginModal OAuth-error surfacing + the account-exists notice replace the M02 console/`window.alert` stopgaps. Dropped from `Settings`: `layoutMode`, `infiniteLoopTimeout`, `isCodeBlastOn`, `isJs13kModeOn`.
```
- [ ] **Step 2: Commit**
```bash
git add docs/superpowers/plans/2026-06-06-web-sequence-rewrite-roadmap.md
git commit -m "docs(m04): record subscription/settings/modals/analytics scope deferrals in roadmap §9"
```

---

### Task 2: subscriptionService — read user_subscriptions/user-{uid}

**Files:** Create `web/src/services/subscriptionService.ts`, Test `web/src/services/subscriptionService.test.ts`

> Match the contract §3.3 EXACTLY: `getDoc(doc(db, 'user_subscriptions/user-' + uid))` → `doc.data()` or `null` if absent. On ANY error, return `null` (legacy `subscription.js:19` swallows errors). Client-read-only — NEVER write this collection. Tests mock `firebase/firestore`.

- [ ] **Step 1: Failing test** `web/src/services/subscriptionService.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fs = vi.hoisted(() => ({
  doc: vi.fn((_db, path) => ({ path })),
  getDoc: vi.fn(),
}));
vi.mock('firebase/firestore', () => fs);
vi.mock('./firebase', () => ({ db: {} }));

import { retrieveSubscription } from './subscriptionService';

beforeEach(() => vi.clearAllMocks());

describe('subscriptionService', () => {
  it('reads user_subscriptions/user-<uid> and returns the doc data', async () => {
    fs.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ status: 'active', passthrough: '{"planType":"plus-monthly"}' }) });
    const sub = await retrieveSubscription('u1');
    expect(fs.doc).toHaveBeenCalledWith({}, 'user_subscriptions/user-u1');
    expect(sub).toEqual({ status: 'active', passthrough: '{"planType":"plus-monthly"}' });
  });
  it('returns null when the doc is absent', async () => {
    fs.getDoc.mockResolvedValueOnce({ exists: () => false, data: () => undefined });
    expect(await retrieveSubscription('u1')).toBeNull();
  });
  it('returns null on a read error (legacy swallow-to-null)', async () => {
    fs.getDoc.mockRejectedValueOnce(new Error('permission-denied'));
    expect(await retrieveSubscription('u1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `pnpm -C web test src/services/subscriptionService.test.ts` → FAIL.

- [ ] **Step 3: Implement** `web/src/services/subscriptionService.ts`:
```ts
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Subscription } from '../domain/types';

// Read-only — written only by the Paddle webhook (admin SDK). Contract §3.3.
// Returns null when absent OR on any read error (legacy subscription.js swallows
// errors to null so a permission/transient failure never blocks the app).
export async function retrieveSubscription(uid: string): Promise<Subscription | null> {
  try {
    const snap = await getDoc(doc(db, `user_subscriptions/user-${uid}`));
    return snap.exists() ? (snap.data() as Subscription) : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add web/src/services/subscriptionService.ts web/src/services/subscriptionService.test.ts
git commit -m "feat(m04): subscriptionService — read user_subscriptions/user-<uid> (contract §3.3, REQ-SUB-2)"
```

---

### Task 3: planLimit — pure over-cap decision from the ownership map

**Files:** Create `web/src/domain/planLimit.ts`, Test `web/src/domain/planLimit.test.ts`

> Pure helper encoding the legacy `checkItemsLimit` boundary (app.jsx 467-482) **with exact parity**. REUSE `isPlus`/`isBasic` from `domain/plan.ts` and `FILE_LIMITS` from `config/constants.ts`. The legacy-exact predicate over the **pre-insert** ownership-map count is `ownedIds.length > limitFor(subscription)` — NO `+1`, NO `includes` branch. Legacy blocks purely on the count (no new-vs-resave distinction): the caller (Task 16) MUST sample `ownedIds` BEFORE registering the new item (pre-insert), so the same predicate covers both new and re-saved items. Legacy admits the (limit+1)-th NEW item (`count <= limit` passes at count === limit); a re-save at a count that is already over the cap is BLOCKED exactly as legacy blocks it (the count is over-cap, `length > limit` is true). `limitFor` returns the numeric cap for a subscription (`Infinity` for Plus).

- [ ] **Step 1: Failing test** `web/src/domain/planLimit.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isOverFileLimit, limitFor } from './planLimit';
import type { Subscription } from './types';

const plus: Subscription = { status: 'active', passthrough: '{"planType":"plus-monthly"}' };
const basic: Subscription = { status: 'active', passthrough: '{"planType":"basic-monthly"}' };

describe('limitFor', () => {
  it('free=3, basic=20, plus=Infinity', () => {
    expect(limitFor(null)).toBe(3);
    expect(limitFor(basic)).toBe(20);
    expect(limitFor(plus)).toBe(Infinity);
  });
});

// ownedIds is the PRE-INSERT ownership map (sampled before the new item is registered),
// matching legacy checkItemsLimit which runs before setItemForUser. The predicate is
// `ownedIds.length > limitFor(sub)` — legacy admits the (limit+1)-th NEW item.
describe('isOverFileLimit', () => {
  it('free user at 3 owned saving a NEW (4th) item is ALLOWED — legacy admits the (limit+1)-th (count 3 <= 3)', () => {
    expect(isOverFileLimit({ subscription: null, ownedIds: ['a', 'b', 'c'], itemId: 'd' })).toBe(false);
  });
  it('free user at 4 owned saving a NEW (5th) item is over the limit (4 > 3)', () => {
    expect(isOverFileLimit({ subscription: null, ownedIds: ['a', 'b', 'c', 'd'], itemId: 'e' })).toBe(true);
  });
  it('free user re-saving an ALREADY-OWNED item at an OVER-CAP count is BLOCKED (legacy has no includes branch)', () => {
    // DISCRIMINATING: at 4 owned (over the free cap of 3), re-saving the owned item 'a'
    // must be blocked because legacy checkItemsLimit reads the count (4) and applies
    // `4 <= 3` = false → alert+block, with NO `includes`/new-vs-resave exemption. An
    // implementation that wrongly short-circuits `ownedIds.includes(itemId)` to false here
    // would FAIL this test — that is the point. (The pre-insert sampling makes the predicate
    // identical for new vs re-save; it does NOT exempt re-saves.)
    expect(isOverFileLimit({ subscription: null, ownedIds: ['a', 'b', 'c', 'd'], itemId: 'a' })).toBe(true);
  });
  it('free user at 2 owned saving the 3rd new item is allowed (2 <= 3)', () => {
    expect(isOverFileLimit({ subscription: null, ownedIds: ['a', 'b'], itemId: 'c' })).toBe(false);
  });
  it('basic user at 20 owned allowed; at 21 owned blocked', () => {
    expect(isOverFileLimit({ subscription: basic, ownedIds: Array.from({ length: 20 }, (_, i) => `i${i}`), itemId: 'new' })).toBe(false);
    expect(isOverFileLimit({ subscription: basic, ownedIds: Array.from({ length: 21 }, (_, i) => `i${i}`), itemId: 'new' })).toBe(true);
  });
  it('plus user never over the limit', () => {
    expect(isOverFileLimit({ subscription: plus, ownedIds: Array.from({ length: 9999 }, (_, i) => `i${i}`), itemId: 'new' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `web/src/domain/planLimit.ts`:
```ts
import { isPlus, isBasic } from './plan';
import { FILE_LIMITS } from '../config/constants';
import type { Subscription } from './types';

export function limitFor(subscription: Subscription | null | undefined): number {
  if (isPlus(subscription)) return Infinity;
  if (isBasic(subscription)) return FILE_LIMITS.basic;
  return FILE_LIMITS.free;
}

// Legacy-exact parity (checkItemsLimit, app.jsx 467-482): the cap is checked against
// the PRE-INSERT ownership-map count. Legacy runs checkItemsLimit BEFORE setItemForUser
// registers the item, and admits the (limit+1)-th NEW item (the `count <= limit` check
// passes at count === limit). So the predicate is simply `ownedIds.length > limitFor(sub)`
// — NO +1, NO includes branch. The caller (save handler) MUST pass the PRE-INSERT ownedIds
// and apply this ONLY when signed in (local saves carry no cloud cap). Legacy blocks purely
// on the count — there is NO new-vs-resave distinction — so an over-cap re-save is blocked
// exactly as a new save. Because ownedIds is pre-insert, the same predicate covers both: a
// re-save does not grow the count and a new save's id is not yet registered, so `length` is
// the same quantity legacy reads in both cases. Do NOT add `ownedIds.includes(itemId)`.
// `itemId` is accepted for caller ergonomics/symmetry but is NOT part of the decision.
export function isOverFileLimit(input: {
  subscription: Subscription | null | undefined;
  ownedIds: string[];
  itemId: string;
}): boolean {
  const { subscription, ownedIds } = input;
  return ownedIds.length > limitFor(subscription);
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add web/src/domain/planLimit.ts web/src/domain/planLimit.test.ts
git commit -m "feat(m04): planLimit — pure over-cap decision from ownership map (REQ-SUB-5)"
```

---

### Task 4: cloudFunctions — trackEvent (POST /track)

**Files:** Modify `web/src/services/cloudFunctions.ts`, extend `web/src/services/cloudFunctions.test.ts`

> `POST /track` with body `{ event, userId, ...properties }` (§5.5). Non-blocking — NEVER throw to the caller (a failed analytics call must not break a user action); swallow network/non-ok errors. `userId` may be `null` (anonymous). Use MSW (reuse the M02/M03 `${window.location.origin}` handler convention).

- [ ] **Step 1: Extend the test** `web/src/services/cloudFunctions.test.ts` (append):
```ts
import { trackEvent } from './cloudFunctions';

describe('trackEvent', () => {
  it('POSTs { event, userId, ...properties } to /track', async () => {
    let received: Record<string, unknown> | null = null;
    server.use(http.post(`${window.location.origin}/track`, async ({ request }) => {
      received = (await request.json()) as Record<string, unknown>;
      return HttpResponse.text('Event tracked successfully');
    }));
    await trackEvent({ event: 'saveBtnClick', userId: 'u1', category: 'ui', label: 'saved' });
    expect(received).toEqual({ event: 'saveBtnClick', userId: 'u1', category: 'ui', label: 'saved' });
  });
  it('carries userId:null for anonymous events', async () => {
    let received: Record<string, unknown> | null = null;
    server.use(http.post(`${window.location.origin}/track`, async ({ request }) => {
      received = (await request.json()) as Record<string, unknown>;
      return HttpResponse.text('ok');
    }));
    await trackEvent({ event: 'pageView', userId: null });
    expect(received!.userId).toBeNull();
  });
  it('never throws on a network/non-ok error (non-blocking)', async () => {
    server.use(http.post(`${window.location.origin}/track`, () => HttpResponse.error()));
    await expect(trackEvent({ event: 'x', userId: null })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — add to `web/src/services/cloudFunctions.ts`:
```ts
// POST /track — non-blocking analytics (§5.5). Swallows all errors: a failed
// analytics call must never break the user action that triggered it.
export async function trackEvent(
  payload: Record<string, unknown> & { event: string; userId: string | null },
): Promise<void> {
  try {
    await fetch('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    /* non-blocking */
  }
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add web/src/services/cloudFunctions.ts web/src/services/cloudFunctions.test.ts
git commit -m "feat(m04): trackEvent cloud-function wrapper (POST /track, non-blocking) (contract §5.5, REQ-ANL-1)"
```

---

### Task 5: analytics — client fan-out (GTM/Mixpanel/Clarity conditional) + emit

**Files:** Create `web/src/services/analytics.ts`, Test `web/src/services/analytics.test.ts`

> Client-side analytics fan-out per REQ-ANL-1: emit to `trackEvent` (POST /track) AND to client analytics; route to console in debug (`window.DEBUG` or `wmdebug` cookie); skip CDN-loaded scripts under the `chrome-extension:` protocol (the structure is built now; the extension ships M05). Anonymous → `userId: null`. Keep this framework-agnostic (no React); the `useAnalytics` hook (Task 8) binds the userId. Mock the cloud `trackEvent` + `window` globals in tests.

> **Implementation shape:** export `emit(event, props, { userId, debug, isExtension })` that (a) if `debug` → `console.log('[analytics]', event, props)` and returns; (b) else `void cloudTrackEvent({ event, userId, ...props })` (fire-and-forget) and pushes to `window.dataLayer`/`window.mixpanel` when present; (c) when `isExtension` → still POST /track but skip pushing to CDN globals that aren't loaded. Also export `loadClientAnalytics({ isExtension })` (no-op stub for the GTM/Mixpanel/Clarity script injection — wired fully when the analytics keys land; the structure + conditional guards are the deliverable, the actual `<script>` injection mirrors legacy `utils.js:284` Clarity loader and may be a documented stub here).

- [ ] **Step 1: Failing test** `web/src/services/analytics.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const cf = vi.hoisted(() => ({ trackEvent: vi.fn(async () => {}) }));
vi.mock('./cloudFunctions', () => cf);
import { emit } from './analytics';

beforeEach(() => { vi.clearAllMocks(); });

describe('analytics.emit', () => {
  it('posts to /track via cloud trackEvent with the userId + props (non-debug)', () => {
    emit('saveBtnClick', { category: 'ui', label: 'saved' }, { userId: 'u1', debug: false, isExtension: false });
    expect(cf.trackEvent).toHaveBeenCalledWith({ event: 'saveBtnClick', userId: 'u1', category: 'ui', label: 'saved' });
  });
  it('carries userId:null for anonymous', () => {
    emit('pageView', {}, { userId: null, debug: false, isExtension: false });
    expect(cf.trackEvent).toHaveBeenCalledWith({ event: 'pageView', userId: null });
  });
  it('routes to console and does NOT POST in debug mode', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    emit('x', { a: 1 }, { userId: 'u1', debug: true, isExtension: false });
    expect(cf.trackEvent).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2–4:** Implement `analytics.ts` exporting `emit(event, props, ctx)` and `loadClientAnalytics(ctx)` per the shape above. Run → PASS.

- [ ] **Step 5: Commit**
```bash
git add web/src/services/analytics.ts web/src/services/analytics.test.ts
git commit -m "feat(m04): analytics fan-out — /track + client (debug→console, ext→skip CDN) (REQ-ANL-1)"
```

---

### Task 6: useSubscription hook

**Files:** Create `web/src/hooks/useSubscription.ts`, Test `web/src/hooks/useSubscription.test.tsx`

> On uid change (from `authStore`), `retrieveSubscription(uid)` → store `{ subscription }`; derive `planType`/`subscribed` via `domain/plan.ts`. Signed-out → `subscription: null`, `planType: 'free'`. Expose `{ subscription, planType, subscribed, loading, reload }` (`reload` re-reads — used after a successful Paddle checkout). Tests mock `../services/subscriptionService` + drive `authStore`.
>
> **`loading` semantics are LOAD-BEARING (race-safety, contract for Task 16).** `loading` MUST be `true` for the WHOLE window where a uid is present but its subscription read **for that uid** has not yet resolved — covering BOTH (a) a uid already present at mount (redirect/restored-session) AND (b) an IN-SESSION sign-in transition (uid `null → 'u1'`, e.g. popup OAuth). Do NOT rely on a mount-only initializer: a mount-only init leaves a one-render gap on the in-session transition where `loading===false` while `subscription===null`, re-opening the exact race for the popup-sign-in flow. **Key `loading` on "the subscription has not been loaded for the CURRENT uid"** — e.g. track the uid the loaded subscription belongs to (`loadedForUid`) and treat `loading = uid !== null && loadedForUid !== uid`, OR set `loading = true` synchronously whenever the observed uid changes to a non-null value (including the `null → uid` edge) and clear it only after `retrieveSubscription` settles (resolve OR reject) for that uid. Signed-out (uid === null) → `loading = false` immediately (nothing to load; `'free'` is the final answer, not a transient default). **The danger this guards:** while `loading` is true, `subscription` is `null` and `planType` derives to `'free'` — a Plus/Basic user transiently looks free during the post-sign-in read window. Any consumer that enforces the file limit or skips a cloud write (Task 16 save-seam) MUST consult `loading` and treat a still-loading subscription as "not yet known" (do NOT enforce/skip-cloud) — see Task 16 §1. The hook's job is to expose the flag honestly; the save-seam's job is to honor it.

- [ ] **Step 1: Failing test** `web/src/hooks/useSubscription.test.tsx` — mock `retrieveSubscription` (returns an active plus sub); set `authStore` signed-in; assert `subscription` populates after mount, `planType==='plus-monthly'`, `subscribed===true`; signed-out → `null`/`'free'`; `reload()` re-invokes the service. (renderHook + waitFor.) **Add discriminating `loading` tests (BOTH transitions):** (i) **mount-with-uid** — with a signed-in uid present at mount and a `retrieveSubscription` that returns a never-resolving promise (a deferred you control), assert `loading === true` on the first render before the promise settles, then resolve and assert it flips to `false`; (ii) **in-session sign-in (`null → uid`)** — render with uid `null` (assert `loading === false`), then change `authStore` to a signed-in uid with the deferred still unresolved, and assert `loading === true` on the very next render (NOT a one-render `false` gap) — this FAILS for a mount-only initializer; resolve and assert `false`. Also assert signed-out → `loading === false` (no spurious in-flight state). These tests FAIL if `loading` is a mount-only initializer or only flips true inside an async callback after a tick.

- [ ] **Step 2–4:** Implement `useSubscription.ts`: `const uid = useAuthStore(s => s.user?.uid ?? null)`; derive `loading` so it is true for ANY signed-in uid whose subscription is not yet loaded — NOT a mount-only initializer. Recommended shape: track `loadedForUid` (the uid the current `subscription` belongs to, `null` initially) and compute `loading = uid !== null && loadedForUid !== uid` (this is true on the `null → uid` in-session transition's very first render, closing the popup-sign-in gap); `useEffect([uid])` — if `uid === null` set `subscription = null`, `loadedForUid = null` and return; else `await retrieveSubscription(uid)` (else `null`) in a `try/finally` that sets `subscription` then `loadedForUid = uid` (clearing `loading`). Derive `planType = getPlanType(sub)`, `subscribed = isSubscribed(sub)`. Return the object + a `reload` callback (reset `loadedForUid`/re-enter the load so it re-reports loading then settles). Run → PASS.

- [ ] **Step 5: Commit**
```bash
git add web/src/hooks/useSubscription.ts web/src/hooks/useSubscription.test.tsx
git commit -m "feat(m04): useSubscription — load + derive plan on auth (REQ-SUB-2/7)"
```

---

### Task 7: usePaddle hook (Classic SDK ensure + checkout)

**Files:** Create `web/src/hooks/usePaddle.ts`, Test `web/src/hooks/usePaddle.test.tsx`

> Ensure the Paddle **Classic** SDK is loaded + `Paddle.Setup({ vendor: 39343 })` once (idempotent; skip the CDN inject under `chrome-extension:` — M05 uses the bundled copy); expose `openCheckout({ planType, email, userId, onSuccess })` which resolves the product ID from `config.paddleProduct<...>` and calls `Paddle.Checkout.open({ product, email, passthrough: JSON.stringify({ userId, planType }), successCallback })`. Inject `window.Paddle` + `config` for testability (or mock the module). Tests assert the product-ID mapping + the passthrough shape.

> **Product-ID mapping (from `config`):** `basic-monthly→paddleProductBasicMonthly`, `plus-monthly→paddleProductPlusMonthly`, `basic-yearly→paddleProductBasicYearly`, `plus-yearly→paddleProductPlusYearly`.

- [ ] **Step 1: Failing test** `web/src/hooks/usePaddle.test.tsx` — stub `window.Paddle = { Setup: vi.fn(), Checkout: { open: vi.fn() } }`; call `openCheckout({ planType: 'plus-monthly', email: 'a@b.c', userId: 'u1', onSuccess })`; assert `Checkout.open` called with `product` = the configured plus-monthly ID and `passthrough` = `JSON.stringify({ userId:'u1', planType:'plus-monthly' })`. Assert `Setup({ vendor: 39343 })` runs once across two hook mounts (idempotent).

- [ ] **Step 2–4:** Implement `usePaddle.ts` per the shape above (module-level `let isSetup = false` guard; lazy `<script>` inject guarded by `location.protocol !== 'chrome-extension:'`). Run → PASS.

- [ ] **Step 5: Commit**
```bash
git add web/src/hooks/usePaddle.ts web/src/hooks/usePaddle.test.tsx
git commit -m "feat(m04): usePaddle — Classic SDK ensure + checkout w/ {userId,planType} passthrough (contract §6.1, REQ-SUB-3)"
```

---

### Task 8: uiStore modal enum + useAnalytics hook

**Files:** Modify `web/src/state/uiStore.ts` (+test); Create `web/src/hooks/useAnalytics.ts` (+test)

> `uiStore`: add a single `activeModal: ModalName | null` (`ModalName = 'settings'|'pricing'|'help'|'shortcuts'|'cheatsheet'|'createNew'|'onboarding'|'pledge'|'acss'`) + `openModal(name)`/`closeModal()`. Keep the existing `activePanel`/`consoleOpen`/`fullscreen`. `useAnalytics`: read `userId` from `authStore`, debug from `window.DEBUG`/`wmdebug` cookie, `isExtension` from `runtimeMode`; return a `track(event, props?)` bound to the current context (calls `analytics.emit`) + fire a page-view on mount.

- [ ] **Step 1:** Extend `uiStore.test.ts`: `openModal('settings')` sets `activeModal`; `closeModal()` clears; opening a second replaces the first (only one modal at a time). TDD `useAnalytics.test.tsx`: mock `analytics.emit`; `track('x',{a:1})` calls `emit('x',{a:1}, { userId, debug, isExtension })` with the signed-in uid; signed-out → `userId:null`.
- [ ] **Step 2:** Implement both. Run unit tests → green.
- [ ] **Step 3: Commit**
```bash
git add web/src/state/uiStore.ts web/src/state/uiStore.test.ts web/src/hooks/useAnalytics.ts web/src/hooks/useAnalytics.test.tsx
git commit -m "feat(m04): uiStore modal enum + useAnalytics (single-modal state, bound track)"
```

---

### Task 8b: Form primitives — Select / Switch / Textarea (design-system)

**Files:** Create `web/src/ui/Select.tsx`, `web/src/ui/Switch.tsx`, `web/src/ui/Textarea.tsx`; modify `web/src/ui/index.ts`; Tests

> **MUST run BEFORE the modal wave (Tasks 9–14) and is SEQUENTIAL** — it edits the shared barrel `web/src/ui/index.ts`, so it cannot run concurrently with the modal tasks (they import these primitives but must NOT touch `index.ts`). SettingsModal/AtomicCssSettingsModal/PricingModal need form controls that don't exist yet: a styled `Select` (wrap `@radix-ui/react-select`; install if missing: `pnpm -C web add --ignore-workspace @radix-ui/react-select`), a `Switch` (wrap `@radix-ui/react-switch`; install if missing), and a `Textarea` (design-system styling over a native `<textarea>`, mirroring `TextInput`). All on the paper surface (light) with `ring-draft-light`, `font-sans`, semantic tokens (no `gray-*`/hex). Each accepts/forwards `data-testid` and `aria-label`.

- [ ] **Step 1:** TDD each primitive (RTL; Radix Select/Switch render trigger + portal content): `Select` renders options + fires `onValueChange`; `Switch` toggles + fires `onCheckedChange`; `Textarea` is a controlled field. Keep design-system tokens.
- [ ] **Step 2:** Export all three from `web/src/ui/index.ts`. Run unit tests + typecheck → green.
- [ ] **Step 3: Commit**
```bash
git add web/src/ui/Select.tsx web/src/ui/Switch.tsx web/src/ui/Textarea.tsx web/src/ui/index.ts web/src/ui/*.test.tsx
git commit -m "feat(m04): Select/Switch/Textarea design-system primitives (for settings/pricing/acss modals)"
```

---

### Task 9: SettingsModal (full preference list — presentational)

**Files:** Create `web/src/components/modals/SettingsModal.tsx`, Test `…/SettingsModal.test.tsx`

> DESIGN SYSTEM (paper / `surface="light"`). Presentational: `{ open, onOpenChange, settings, onChange(key, value) }`. Renders EVERY preference in `domain/types.ts` `Settings` (REQ-SET-2 table) grouped sensibly (Editor: `editorTheme`, `keymap`, `fontSize` 12–18, `editorFont` + `editorCustomFont` when font='other', `indentWith`, `indentSize`, `lineWrap`, `autoCloseTags`, `autoComplete`; Behavior: `preserveLastCode`, `autoPreview`, `autoSave`, `preserveConsoleLogs`, `refreshOnResize`, `lightVersion`; Extension: `replaceNewTab`; modes `htmlMode`/`jsMode`/`cssMode`). **Do NOT surface** `layoutMode`/`infiniteLoopTimeout`/`isCodeBlastOn`/`isJs13kModeOn` (dropped). Each control fires `onChange(key, value)` on change (live-apply happens via the injected handler — Task 16 wires it to `settingsStore.merge`). `data-testid`s: `settings-modal`, `setting-<key>` per control (e.g. `setting-editorTheme`, `setting-fontSize`).

- [ ] **Steps:** TDD (RTL; Radix Dialog renders in a PORTAL — open then query within `document`): modal renders all controls reflecting `settings`; changing a control calls `onChange(key, newValue)` with the right key+coerced value (number for fontSize/indentSize, boolean for toggles); `editorCustomFont` input only shows when `editorFont === 'other'`. Keep design-system tokens (no `gray-*`). Commit:
```bash
git commit -m "feat(m04): SettingsModal — full preference list, presentational (REQ-SET-1/2)"
```

---

### Task 10: PricingModal + LimitReachedNotice + ProBadge

**Files:** Create `web/src/components/subscription/PricingModal.tsx`, `…/LimitReachedNotice.tsx`, `…/ProBadge.tsx`; Tests

> DESIGN SYSTEM (paper). All presentational.
> - **PricingModal** `{ open, onOpenChange, currentPlanType, billingPeriod, onPeriodChange('monthly'|'yearly'), onUpgrade(planType), onContactEnterprise }`: four tiers (Starter/Free, Basic, Plus, Enterprise) with per-tier feature bullets; a monthly/yearly toggle (yearly shows savings copy); each paid tier a `Button` → `onUpgrade('<plan>-<period>')`; Enterprise → `onContactEnterprise()` (links to contact page); the current plan tier marked (no upgrade button for it). One `Button variant="primary"` (the recommended/Plus tier). `data-testid`s: `pricing-modal`, `pricing-period-monthly`, `pricing-period-yearly`, `pricing-upgrade-basic`, `pricing-upgrade-plus`, `pricing-enterprise`.
> - **LimitReachedNotice** `{ open, onOpenChange, limit, onUpgrade }`: a non-blocking notice ("You've reached your N-diagram limit. Saved on this device.") with an inline `Button variant="primary"` → `onUpgrade()` (opens pricing) + a dismiss. REQ-SUB-5 softened presentation. `data-testid`s: `limit-notice`, `limit-upgrade`.
> - **ProBadge** `{ planType }`: a small `font-mono` badge (`signal-amber` accent) rendered next to the avatar for subscribed users. `data-testid="pro-badge"`.

- [ ] **Steps:** TDD each (RTL, portals): PricingModal renders 4 tiers, period toggle flips `billingPeriod` via `onPeriodChange`, each upgrade button calls `onUpgrade` with the composed `<plan>-<period>` planType, Enterprise calls `onContactEnterprise`, current tier shows no upgrade button. LimitReachedNotice upgrade → `onUpgrade`. ProBadge shows for a paid planType. Commit:
```bash
git commit -m "feat(m04): PricingModal + LimitReachedNotice + ProBadge (REQ-SUB-1/5/7)"
```

---

### Task 11: CreateNewModal + templates data module

**Files:** Create `web/src/domain/templates.ts` (+test), `web/src/components/modals/CreateNewModal.tsx` (+test)

> **`templates.ts`** — a typed data module with the 4 curated templates, content PORTED VERBATIM from legacy `src/templates/template-basic.json`, `template-black-white.json`, `template-blue.json`, `template-starUMLTheme.json` (READ those files and copy `title`, `mainSizes`, `htmlMode`/`cssMode`/`jsMode`, `js`, `css`, `html` — DROP the dropped `layoutMode` field). Export `TEMPLATES: { id, title, item: Partial<Item> }[]` (ids: `basic`, `black-white`, `blue`, `starUMLTheme`). A `blankTemplate()` helper returns an empty starter. Do NOT fabricate starter DSL — copy it from the legacy JSON.
> **`CreateNewModal`** — DESIGN SYSTEM (paper) presentational `{ open, onOpenChange, onSelect(item: Partial<Item>) }`: a "Blank diagram" option + one card per template (title + preview snippet); selecting fires `onSelect(template.item)` (or `blankTemplate()`) then closes. `data-testid`s: `create-new-modal`, `create-blank`, `create-template-<id>`.

- [ ] **Step 1:** TDD `templates.ts`: asserts 4 templates with the expected ids, each carries a non-empty `js`, and `layoutMode` is absent. (Pin the basic template's `js` to the legacy value you copied.)
- [ ] **Step 2:** TDD `CreateNewModal` (RTL, portal): renders blank + 4 template cards; selecting a card calls `onSelect` with that template's item; blank calls `onSelect` with the blank starter. Commit:
```bash
git commit -m "feat(m04): templates data module + CreateNewModal (REQ-MOD-4)"
```

---

### Task 12: Static-content modals — Help + CheatSheet + KeyboardShortcuts

**Files:** Create `web/src/components/modals/HelpModal.tsx`, `…/CheatSheetModal.tsx`, `…/KeyboardShortcutsModal.tsx`; Tests

> DESIGN SYSTEM (paper). All presentational `{ open, onOpenChange }`.
> - **HelpModal** (REQ-MOD-1): app version, links (docs, contact, GitHub), brief about. `data-testid="help-modal"`.
> - **CheatSheetModal** (REQ-ED-6): ZenUML DSL reference — participant, async message `A->B: message`, sync `A.method() {}`, return `result = A.method() {}`, self message, instance creation `a = new A()`, `if`/conditional, `while`/loop, comment — each with a `font-mono` example. SOURCE the examples from legacy `src/components/CheatSheetModal.jsx` (READ it) — do NOT invent DSL. `data-testid="cheatsheet-modal"`.
> - **KeyboardShortcutsModal** (REQ-KB-1): a table of the §11 shortcuts VERBATIM (Save Ctrl/Cmd+S, Manual preview refresh Ctrl/Cmd+Shift+5, Open library Ctrl/Cmd+O, Search/quick-open Ctrl/Cmd+K, Shortcuts help Ctrl/Cmd+Shift+?, Clear console Ctrl+L, Esc; editor: Find Ctrl/Cmd+F, Find next Ctrl/Cmd+G, Find prev Ctrl/Cmd+Shift+G, Find&replace Ctrl/Cmd+Alt+F, Toggle comment Ctrl/Cmd+/, Indent Ctrl/Cmd+]/[, Re-indent Shift+Tab, Autocomplete Ctrl/Cmd+Space, Emmet Tab, Prettier Ctrl+Shift+F). `data-testid="shortcuts-modal"`.

- [ ] **Steps:** TDD each (RTL, portal): renders when `open`; CheatSheet shows the DSL examples; KeyboardShortcuts shows the §11 bindings (assert a couple of representative rows, e.g. "Ctrl/Cmd+S" and "Ctrl/Cmd+K" are present). Commit:
```bash
git commit -m "feat(m04): Help + CheatSheet + KeyboardShortcuts modals (REQ-MOD-1, REQ-ED-6, REQ-KB-1)"
```

---

### Task 13: One-time modals — Onboarding + SupportPledge

**Files:** Create `web/src/components/modals/OnboardingModal.tsx`, `…/SupportPledgeModal.tsx`; Tests

> DESIGN SYSTEM (paper). Presentational only — the **trigger/flag logic is integrate (Task 16)**; these components just render + call `onDismiss`.
> - **OnboardingModal** (REQ-MOD-3) `{ open, onOpenChange, onDismiss }`: a first-run welcome (what ZenUML is, how to write the DSL, a "Get started" `Button variant="primary"` → `onDismiss`). `data-testid="onboarding-modal"`.
> - **SupportPledgeModal** (REQ-MOD-3) `{ open, onOpenChange, version, onDismiss }`: the version-upgrade pledge ("ZenUML is updated to vX — support the project") with a dismiss + (optional) a sponsor link. `data-testid="pledge-modal"`.

- [ ] **Steps:** TDD each (RTL, portal): renders when `open`; the primary action calls `onDismiss`. Commit:
```bash
git commit -m "feat(m04): Onboarding + SupportPledge modals, presentational (REQ-MOD-3)"
```

---

### Task 14: AtomicCssSettingsModal (edits cssSettings)

**Files:** Create `web/src/components/modals/AtomicCssSettingsModal.tsx`, Test `…/AtomicCssSettingsModal.test.tsx`

> DESIGN SYSTEM (paper). Presentational `{ open, onOpenChange, value, onChange(next) }` where `value`/`next` are the item's `cssSettings` object (roadmap §9 M01-deferral: ACSS mode was read-only until M04). Provide the Atomizer config fields the legacy Atomic-CSS settings modal exposed — SOURCE the field set from legacy (grep `cssSettings`/`acss` in `src/`); if the legacy modal edited a freeform JSON config, a validated JSON `<textarea>` (parse on save, surface parse errors inline) is an acceptable design-system rendering. `onChange` fires the parsed config. `data-testid`s: `acss-modal`, `acss-config`, `acss-save`.

- [ ] **Steps:** First grep legacy for the `cssSettings` shape (`grep -rn "cssSettings\|atomizer\|acss" src/`). TDD (RTL, portal): renders the current `value`; editing + save calls `onChange` with the parsed config; invalid JSON surfaces an error and does NOT call `onChange`. Commit:
```bash
git commit -m "feat(m04): AtomicCssSettingsModal — edit cssSettings (REQ-ED-2, M01 carry-forward)"
```

---

### Task 15: Header modal triggers + ProfileMenu (Pro/plan/upgrade) + LoginModal error surfacing

**Files:** Modify `web/src/components/header/AppHeader.tsx` (+test), `web/src/components/auth/ProfileMenu.tsx` (+test), `web/src/components/auth/LoginModal.tsx` (+test)

> **This is an integrate-adjacent task touching EXISTING files — do in the main session, not a fresh parallel agent.**
> - **AppHeader:** add trigger affordances (a "+" New → CreateNew, a Settings `IconButton`, a Help/Pricing entry — fold less-frequent ones into an overflow `Menu` to keep the header calm). Inject the open handlers as props (e.g. `onOpenSettings`, `onOpenCreateNew`, `onOpenHelp`, `onOpenPricing`). Keep existing props/testids. New `data-testid`s: `header-settings`, `header-help`, `header-pricing` (Create-New may reuse/replace the existing `header-new` flow — decide in integrate).
> - **ProfileMenu (REQ-SUB-7 + REQ-AC-3):** add a `ProBadge` next to the avatar for subscribed users; a "My Plan (planType)" `MenuItem` when subscribed (links to `cancel_url` / "Cancel subscription"); an "Upgrade plan" `MenuItem` → `onUpgrade()` for non-subscribed. Also surface REQ-AC-3 profile data: displayName (fallback "Anonymous Creator") + email + current plan. New props: `{ subscribed, planType, onUpgrade, onManagePlan }`. Hide ALL billing items when `payment` is off (extension) — pass a `paymentEnabled` prop. Keep `profile-logout`. New `data-testid`s: `profile-upgrade`, `profile-plan`, `pro-badge`.
> - **LoginModal (roadmap §9 carry-forward):** accept an `error?: string` prop and render it as a design-system notice; the integrate stage feeds it the OAuth error (replacing the M02 console/`window.alert` stopgap, incl. account-exists). New `data-testid="login-error"`.

- [ ] **Steps:** TDD each behavior (RTL; Menu in portal): header buttons call their injected handlers; ProfileMenu shows ProBadge+plan for subscribed, Upgrade for non-subscribed, nothing billing-related when `paymentEnabled=false`; LoginModal renders `error` when present. Commit:
```bash
git commit -m "feat(m04): header modal triggers + ProfileMenu plan/upgrade + LoginModal error (REQ-SUB-7, §9 carry-forward)"
```

---

### Task 16: Wire everything into AppRoot (save-seam, modals, subscription, analytics, one-time triggers, settings persist)

**Files:** Modify `web/src/app/AppRoot.tsx` (+ extend `AppRoot.test.tsx`)

> **INTEGRATE STAGE — main session only.** Wire all M04 surfaces.
> 1. **Save-seam (replace the `// M04:` comment at AppRoot.tsx:214).** In `save()`, after computing `itemToSave` and (for signed-in) `ensureUser`: sample the owned ids **PRE-INSERT** — i.e. BEFORE the `setItem`/`setItemForUser` calls at AppRoot.tsx:197-199 register the item (current code does `setItem` then `setItemForUser`; the limit read must happen earlier, from the membership snapshot the user had before this save). Use the `useItems` list ids OR `getUserItemIds(uid)` captured before any write. Then, if signed-in **AND the subscription read has resolved** (`!loading` from `useSubscription` — see the race guard below) and `isOverFileLimit({ subscription, ownedIds, itemId })` (legacy-exact: `ownedIds.length > limitFor(sub)` over that PRE-INSERT set) → **skip the cloud write but still persist locally** + open `LimitReachedNotice` (REQ-SUB-5). The pre-insert sampling is load-bearing: it makes the legacy-exact predicate correct (legacy admits the (limit+1)-th NEW item; an over-cap re-save is blocked exactly as legacy blocks it). The simplest honest way given `setItem` does local+cloud: call `itemService.saveLastCode`/a local-only write for the over-cap case, or thread an option through `setItem` (`{ skipCloud: true }`) — DECIDE and implement; the test must prove the cloud `setDoc` is NOT called for an over-cap new item while the local copy IS written. Then `trackEvent('saveBtnClick', { category:'ui', label: !user?'not-logged-in':itemId?'saved':'new' })` and a `'Free Limit'` event on the over-cap path (legacy parity).
>    - **RACE GUARD (auth-resolved-before-read bug class — MANDATORY).** During the post-sign-in window where auth is ready but `user_subscriptions/user-<uid>` has NOT resolved, `useSubscription` reports `subscription: null` / `planType: 'free'` / `loading: true`. If the save-seam enforced the limit in that window, a Plus/Basic user with >3 owned items who saves would get (a) a FALSE `LimitReachedNotice` and (b) their cloud write SILENTLY SKIPPED — a paying user's diagram fails to persist to the cloud. **Therefore the save-seam MUST NOT enforce the file-limit or skip the cloud write while `loading` is true.** Encode this as: `const blocked = !!user && !loading && isOverFileLimit({ subscription, ownedIds, itemId });` — i.e. an unresolved subscription is treated as "not yet known" and the cloud write PROCEEDS normally (equivalently: treat-as-unlimited-until-resolved). Once the read settles, the normal predicate applies on the next save. This same `!loading` gate also fronts the custom-CSS Plus-gate (§8): do NOT gate CSS as non-Plus while the subscription is still loading.
> 2. **Subscription on auth:** mount `useSubscription`; pass `subscription`/`planType`/`subscribed`/**`loading`** into ProfileMenu + the save-seam limit check (the `loading` flag gates enforcement — §1 race guard) + PricingModal `currentPlanType`.
> 3. **Modal inventory:** mount all modals driven by `uiStore.activeModal`; wire `openModal`/`closeModal` to the header triggers + ProfileMenu upgrade (→ pricing) + the limit notice (→ pricing). SettingsModal `onChange` → `settingsStore.merge({ [key]: value })` (live-apply) + persist: `syncStore.set(key, value)` always + `setUserSetting(uid, key, value)` when signed-in. CreateNewModal `onSelect(item)` → `editorStore.loadItem(migrateToPages({ ...blankBase, ...item, id: newId }))` then fork-to-owned. AtomicCssSettingsModal `onChange` → `editorStore.setCssSettings` (add the action if missing).
> 4. **Paddle checkout:** `usePaddle().openCheckout({ planType, email: user.email, userId: user.uid, onSuccess: () => { /* prompt refresh */ reloadSubscription() } })` from PricingModal `onUpgrade`; non-logged-in upgrade → open LoginModal first. Guard the WHOLE billing path behind `config.features.payment`.
> 5. **Analytics emit-points (REQ-ANL-1 — enumerate from legacy):** wire `useAnalytics().track(...)` at: save (above), login/logout (`'loggedIn'`/`'loggedOut'` + provider), share-link create (`'shareLink'`), open-settings (`'openSettingsModal'`), each setting change (`'updatePref-'+key`), limit-reached (`'Free Limit'`), import (`'itemsImported'`), export (`'exportItems'`), onboarding-seen (`'onboardModalSeen'`+version), page-view on mount. Anonymous → null userId (the hook handles it).
> 6. **One-time triggers (REQ-MOD-3):** on boot, if `!localStore.get(onboarded)` → open Onboarding (mark `onboarded` on dismiss). On auth-ready, semver-compare `lastSeenVersion` vs the current app version; if behind → open SupportPledge (mark `pledgeModalSeen`/update `lastSeenVersion` on dismiss). Reuse the existing `loginAndSaveMessageSeen`/`askedToImportCreations` flows (M02/M03 already wired).
> 7. **LoginModal error:** feed the OAuth error from `useAuth.login` (surface it — replaces the M02 console/`window.alert` stopgap).
> 8. **Custom-CSS Plus-gating (REQ-SUB-5 bullet 2 — legacy parity).** Editing the CSS editor or selecting a custom CSS mode (the `css-mode-select` in AppRoot) is **Plus-only**. When a non-Plus user attempts it: anonymous → open the LoginModal; signed-in Basic/Free → `openModal('pricing')` (do NOT apply the CSS change/mode). Plus users edit freely. Wire this at the AppRoot CSS-editor `onChange`/`setCss` + the `css-mode-select` `onChange` (gate via `isPlus(subscription)`). `trackEvent('Free Limit', { category:'custom-css' })` on the gated path. Discriminating test: a Free signed-in user changing CSS → pricing modal opens + the CSS is unchanged; a Plus user → CSS applies.

- [ ] **Step 1:** Wire the save-seam + limit notice; discriminating tests (legacy-exact boundary): (a) a signed-in free user **already at 4 owned items** (subscription resolved, `loading===false`) saving a NEW item → cloud `setItem`/`setItemForUser` (the `setDoc`) NOT called, local copy still written, `LimitReachedNotice` open; (b) a signed-in free user **at exactly 3 owned** saving the NEW 4th item → cloud write DOES happen (legacy admits the (limit+1)-th — guards against an off-by-one that would block it); (c) a signed-in free user **at 4 owned re-saving an ALREADY-OWNED item** → cloud write SKIPPED + notice (over-cap re-save is blocked by the same pre-insert predicate legacy applies — no `includes` exemption); **(d) RACE GUARD — a signed-in user with >3 owned items saving while the subscription is STILL LOADING (`loading===true`, so `subscription` is transiently `null`/`planType==='free'`) → the cloud `setDoc` DOES happen and NO `LimitReachedNotice` opens.** Drive (d) with a never-resolving (or controllably-deferred) `retrieveSubscription` so `useSubscription` reports `loading: true` at save time; this test FAILS if the save-seam enforces the limit on the stale `'free'` default — it is the discriminating proof of the auth-resolved-before-read fix. Wire the custom-CSS Plus-gate (test: Free user CSS edit → pricing modal + CSS unchanged; Plus user → applies; and — guarded by the same `!loading` gate — a Plus user mid-subscription-load is NOT wrongly treated as Free).
- [ ] **Step 2:** Wire subscription + modal inventory + header triggers + ProfileMenu + Paddle + analytics + one-time triggers + LoginModal error.
- [ ] **Step 3:** Run FULL `pnpm -C web test` + `pnpm -C web typecheck` → green. Commit:
```bash
git commit -m "feat(m04): wire subscription/settings/modals/analytics/limit into AppRoot (REQ-SUB, REQ-SET, REQ-MOD, REQ-ANL)"
```

---

### Task 17: E2E — modal inventory + settings + pricing (signed-out/local where feasible)

**Files:** Create/extend `e2e/tests/modals.spec.js` (repo root)

> Signed-out/local E2E for what doesn't need the emulator: open the Settings modal → change a setting (e.g. fontSize) → assert it applies + the modal closes on Esc; open the Create-New modal → pick a template → assert the editor loads its DSL; open the Cheat-Sheet + Keyboard-Shortcuts + Help modals → assert content; open the Pricing modal (web host → payment on) → toggle monthly/yearly. Checkout (Paddle), subscription-load, and the cloud plan-limit need auth/emulator → note them deferred to the staging gate (same as M02/M03 auth notes). Reuse the M02/M03 spec patterns; webServer already boots `pnpm -C web dev`.

- [ ] **Step 1:** Spec: drive the header triggers → each modal opens (query the portal); change a setting + assert live effect; pick a template; assert cheat-sheet/shortcuts content; toggle pricing period. Header-note the auth-gated parts.
- [ ] **Step 2:** Run `pnpm exec playwright test modals --project=chromium` → green; keep M01/M02/M03 specs green.
- [ ] **Step 3:** Full gate: `pnpm -C web typecheck && pnpm -C web test` green; `pnpm exec playwright test --project=chromium` green. Commit:
```bash
git commit -m "test(m04): E2E — modal inventory + settings + pricing (local, signed-out)"
```

---

### Task 18: Adversarial review of M04 surfaces

**Files:** none (review + fix)

- [ ] **Step 1:** Dispatch independent reviewers (parallel) against ground truth (legacy `src/components/app.jsx` `checkItemsLimit`/`saveBtnClickHandler`/`templateSelectHandler`, `src/analytics.js`, `src/services/user_service.js`, `src/services/planService.js`, `src/components/subscription/UpgradeLink.jsx`, `src/config/paddleInit.js`, contract §3.3/§5.5/§6.1, requirements §8/§9/§13/§14) over:
  1. `planLimit` + the save-seam — EXACT boundary (legacy `count <= 3` / `count <= 20 && isBasic` / Plus ∞ over the PRE-INSERT ownership-map count, i.e. predicate `ownedIds.length > limitFor`; the (limit+1)-th NEW item is ADMITTED, the (limit+2)-th is blocked; legacy blocks purely on count with NO `includes`/new-vs-resave branch, so an over-cap re-save is blocked exactly as a new save — confirm no `includes` short-circuit was added; ownedIds sampled before the register at AppRoot.tsx:197-199), the **`!loading` race guard** (subscription unresolved → enforcement skipped, cloud write proceeds — verify a paying user mid-load is NOT falsely blocked and their cloud write is NOT skipped), softened presentation (cloud write SKIPPED but local kept; non-blocking notice not `alert()`+forced modal), Plus-only custom-CSS gating (Basic/Free → pricing; anon → sign-in; mid-load → not gated).
  2. `subscriptionService` + `useSubscription` + `usePaddle` — read-only `user_subscriptions/user-<uid>`, null on absent/error, plan derivation via `domain/plan.ts` (legacy passthrough tolerance), `useSubscription.loading` honestly true for the whole signed-in-but-unresolved window (initial render with a uid included), Classic SDK + vendor 39343 + `{userId,planType}` passthrough + correct env product ID, success→reload, non-logged-in→sign-in, payment flag hides ALL billing.
  3. `analytics` + `trackEvent` + emit-points — `/track` body shape, non-blocking, anonymous→null userId, debug→console, ext→skip CDN, the full legacy emit inventory wired (save/login/logout/share/openSettings/updatePref/limit/import/export/onboarding/pageView).
  4. Settings + modal inventory — every §9.2 pref present + live-apply via `settingsStore.merge` + persist (syncStore + cloud), dropped settings absent, one-time-prompt flags (onboarded/pledge semver), templates ported verbatim (not fabricated), shortcuts §11 verbatim, all modals on paper/design-system (no `gray-*`/hex), Radix portal/testid collisions across the now-many dialogs, single-modal `activeModal` state, LoginModal error surfacing.
- [ ] **Step 2:** Triage; fix real findings with discriminating regression tests (revert→fail). Record deferrals in roadmap §9.
- [ ] **Step 3:** Commit fixes (one per fix, message references the review).

---

## Self-Review (completed during authoring)

**Spec coverage:** REQ-SUB-1 (pricing modal, monthly/yearly, savings, Enterprise) → 10/16. REQ-SUB-2 (plan resolution + legacy passthrough) → 2/6 (reuses `plan.ts`). REQ-SUB-3 (Paddle Classic checkout) → 7/16. REQ-SUB-4 (cancellation link) → 15. REQ-SUB-5 (plan gating, softened) → 3/10/16. REQ-SUB-6 (payment flag hides billing) → 15/16. REQ-SUB-7 (Pro indicator + plan menu) → 10/15. REQ-SET-1/2/4 (settings surface, full list, live-apply) → 9/16. REQ-PST persist split → 16 (syncStore + setUserSetting). REQ-MOD-1 (modal inventory) → 9–14. REQ-MOD-3 (one-time prompts, semver pledge) → 13/16. REQ-MOD-4 (templates) → 11. REQ-MOD-5 (toasts/notices) → 10 (LimitReachedNotice) + reuses M02 ConfirmDialog. REQ-ED-2 (ACSS settings modal) → 14. REQ-ED-6 (cheat sheet) → 12. REQ-KB-1 (shortcuts help) → 12. REQ-ANL-1 (analytics dual-path) → 4/5/8/16. Contract §3.3 → 2; §5.5 → 4; §6.1 → 7. Deferred (extension/embed/cutover + bundled Paddle → M05; settings load-once; LoginModal error surfacing) recorded in §9 (Task 1).

**Placeholders:** service/store/hook/pure tasks (2–8) carry full code/tests; UI-heavy tasks (9–15) specify exact components, props, data-testids, and TDD targets with content SOURCED from legacy (templates, cheat-sheet, shortcuts) rather than fabricated. No "TBD".

**Type consistency:** reuses canonical `Subscription`/`PlanType`/`Settings`/`Item`/`AppUser`; `retrieveSubscription` matches roadmap §4; `trackEvent` matches roadmap §4 (`payload & { event, userId: string|null }`); plan logic reuses `domain/plan.ts`; limits reuse `FILE_LIMITS`; product IDs + payment flag reuse `config/firebaseConfig.ts`; settings reuse `settingsStore.merge` + `userService.setUserSetting`.

---

## Done when

- [ ] `pnpm -C web typecheck`, `pnpm -C web test` green; `pnpm exec playwright test --project=chromium` green (incl. the new modals spec + M01/M02/M03 specs).
- [ ] Signed-in: pricing modal + Paddle Classic checkout (correct env product ID, `{userId,planType}` passthrough) + cancellation link; subscription loads on auth; Pro badge + "My Plan" / Upgrade in the profile menu; an over-cap save (pre-insert owned count > limit — legacy admits the (limit+1)-th NEW item, blocks beyond) is skipped from the cloud (local kept) with a non-blocking notice; an over-cap re-save of an owned item is blocked exactly as a new save (legacy has no `includes` exemption); a save while the subscription is still loading is NEVER falsely blocked and its cloud write proceeds (race guard); Plus-only custom CSS gated.
- [ ] Full Settings modal exposes every (non-dropped) preference, applies live, and persists to syncStore (+cloud when signed-in).
- [ ] Complete modal inventory present (Settings/Pricing/Help/Keyboard-Shortcuts/Cheat-Sheet/Create-New/Onboarding/Support-pledge/Atomic-CSS); one-time prompts fire at most once (onboarded/pledge-semver); templates loaded verbatim from the ported data.
- [ ] Analytics events emit to `/track` + client (anonymous→null userId, debug→console, ext→skip CDN); the legacy emit inventory is wired.
- [ ] Payment feature flag hides ALL billing UI when off (extension hosts).
- [ ] All new UI uses the Drafting Table design system (no gray-*/hex). No backend asset changed; legacy `src/` untouched.
- [ ] Adversarial review (Task 18) complete; real findings fixed with regression tests; deferrals in roadmap §9.
- [ ] All work committed in small steps; a milestone screenshot delivered.
</content>
</invoke>
