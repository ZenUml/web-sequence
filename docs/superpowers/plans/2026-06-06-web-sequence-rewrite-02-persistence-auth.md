# Milestone 02 — Persistence + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. Read the roadmap (`…-roadmap.md`, esp. canonical types §3, service interfaces §4, CQ decisions §8/§9) and the contract spec (`…-frontend-backend-contract.md`) first. M00 (foundation) + M01 (editor+preview) are complete on branch `rewrite/web-foundation`.

**Goal:** Make diagrams persist and accounts work against the FROZEN Firebase backend: the full item lifecycle (create / open / save / fork / delete) with dual-write + pages migration, multi-page tabs (create / switch / delete / **rename**), local + cloud persistence (local-always, cloud merge when signed-in + online), the 4 OAuth providers + import-on-login, last-code restore on boot, and auto-save — all via the modular Firebase v10 SDK already initialized in M00.

**Architecture:** A framework-agnostic **service layer** (`services/itemService.ts`, `services/userService.ts`, `services/cloudFunctions.ts`) implements the contract (roadmap §4) over the M00 `firebase.ts` handles. **Hooks** (`hooks/useAuth.ts`, `hooks/useItems.ts`, `hooks/useItem.ts`, `hooks/useAutoSave.ts`) bridge services into React. The **Zustand `editorStore`** (from M01) gains the save/dirty/unsaved-count lifecycle. A minimal **header** (New / Save / Fork / Login-Profile) and **PageTabs** provide entry points; the full library panel is **M03**. Everything degrades to local-only when signed out or offline (parity).

**Tech Stack:** Firebase modular v10 (`firebase/firestore`: `doc/getDoc/setDoc/deleteDoc/updateDoc/collection/query/where/onSnapshot/writeBatch/deleteField/arrayUnion`; `firebase/auth`), React 19, TanStack Query (item list cache bridged from `onSnapshot`), Zustand, Vitest + RTL (Firestore mocked / MSW for the one fetch endpoint), Playwright.

---

## Pre-flight (read once)

- **Working dir:** all commands `pnpm -C web …` from repo root (cwd drifts). Installs use `pnpm add --ignore-workspace`. Branch `rewrite/web-foundation` — do NOT branch. Only touch `web/src/**` (+ `e2e/` for E2E). Do NOT modify legacy `src/` or any backend asset.
- **Backend is FROZEN** (NFR-1): no changes to Cloud Functions, Firestore schema/rules/indexes, or external services. Match the existing shapes EXACTLY (contract spec §3–§5).
- **M00 gives you:** `services/firebase.ts` (`auth`, `db`, `login(provider)`, `logout()`, `onAuthChange(cb)`, `getIdToken()`), `services/storage.ts` (`localStore`, `syncStore` KvStore), `domain/types.ts` (`Item`/`Page`/`Folder`/`Subscription`/`AppUser`/`Settings`/`DEFAULT_SETTINGS`), `domain/item.ts` (`migrateToPages`/`applyPageEdit`/`addPage`/`deletePage`/`switchPage`), `domain/plan.ts`, `config/constants.ts` (`AUTO_SAVE_INTERVAL=15000`, `UNSAVED_WARNING_COUNT=15`, `LS_KEYS`), `config/firebaseConfig.ts` (`config.features.payment`).
- **M01 gives you:** `state/editorStore.ts` (`useEditorStore`: `currentItem`/`dirty`/`loadItem`/`setDsl`/`setCss`/`set*Mode`/`addPage`/`deletePage`/`switchPage`/`reset`), `app/AppRoot.tsx` (currently seeds a hardcoded `STARTER` item — M02 Task 12 replaces that seeding with real boot/restore), `components/Sidebar.tsx`, `components/Layout.tsx`.

### Key facts from the legacy (ground truth — match these)
- **`items/{id}` doc**: full `Item` (js/css/html/modes/pages/currentPageId/sizes/mainSizes/`createdBy`/`updatedOn`/sharing fields/`externalLibs`). Saved with `setDoc(..., {merge:true})`. `imageBase64` is STRIPPED before any save. Owner reads verify `item.createdBy === uid`.
- **`users/{uid}` doc**: `{ items: {<id>: true}, settings: {...}, folders: [...] (M03), subscription (M04 reads), lastSeenVersion }`. Auto-created empty (`setDoc({}, {merge:true})`) on first read. Item membership is `items.<id> = true` / `deleteField()`.
- **List query**: `query(collection(db,'items'), where('createdBy','==',uid))` via `onSnapshot` (composite index `createdBy ASC, updatedOn DESC` exists — do NOT add `orderBy` that needs a different index; sort client-side).
- **Shared read**: `GET /get-shared-item?id=<id>&share-token=<t>` → returns an `Item` with `isReadOnly:true` (the M01 proxy fix preserves the query string). Never persisted by the client.
- **`saveLastCode`**: writes the current item to the LOCAL `code` slot only (never cloud); restored on boot when `preserveLastCode` and no `?id=`.
- **Auth**: `signInWithPopup` with Google(+userinfo.profile scope)/GitHub/Facebook/Twitter (M00 `login()` already does this). On `auth/account-exists-with-different-credential`, alert the user. Persist `lastAuthProvider` (LS_KEYS) for the login UI. No Firebase **anonymous** auth in legacy — "anonymous" in the roadmap = full local-only operation when signed out (parity); we do NOT add `signInAnonymously`.
- **Import-on-login**: on first authenticated session (when `LS_KEYS.askedToImportCreations` is unset), if local items exist, prompt; on accept, `saveItems(localItems)` to cloud; then set the flag.
- **Offline**: `navigator.onLine`; local write always resolves immediately; cloud write deferred (Firestore's own offline queue via the M00 persistent cache). Multi-tab supported (CQ-5, no warning).

### Deferred (recorded, not silently dropped)
- **Library/saved-items panel UI** (browse/search/folders/import-export) → **M03**. M02 provides only the minimal New/Save/Fork/Open-by-list-stub entry points + page tabs.
- **Settings UI** (full settings modal) → **M04**. M02 loads `users/{uid}.settings` into a settings store on login and honors `preserveLastCode`/`autoSave`/`autoPreview`, but the settings editing UI is M04.
- **Subscription/plan gating** (file limits) → **M04**. M02 saves items without enforcing the 3/20/∞ limit; add a `// M04: enforce plan limit` seam in the save path.
- **create-share / share panel / stopSharing** → **M03** (REQ-SHR-1/2/4/5). M02 wires only `getSharedItem` (read shared) + `forkItem` (REQ-SHR-3).
- **Analytics events** (`/track`, GTM/Mixpanel) → **M04**. Leave `// M04: trackEvent(...)` seams where legacy emitted events; do not call analytics now.
Record these in roadmap §9 in Task 1.

---

## File structure (this milestone)

```
web/src/
  services/
    cloudFunctions.ts     # typed fetch wrappers (getSharedItem now; createShare/trackEvent later milestones)
    itemService.ts        # ItemService impl (roadmap §4) over firebase.ts db
    userService.ts        # users/{uid}: ensureUser, item-membership, settings read/write, batch import
  state/
    editorStore.ts        # (extend) save lifecycle: unsavedCount, markSaved, save flow flags, item id/meta
    authStore.ts          # Zustand: current AppUser | null, online status
    settingsStore.ts      # Zustand: Settings (load-once from user doc / local; M04 edits)
  hooks/
    useAuth.ts            # onAuthChange → authStore; login(provider)+lastAuthProvider+account-exists; logout
    useItems.ts           # subscribeAllItems → item list (TanStack Query cache bridged from onSnapshot)
    useItem.ts            # resolve boot item (?id/?share-token → getItem; else last-code; else new)
    useAutoSave.ts        # 15s loop gated by autoSave + unsavedCount
    useImportOnLogin.ts   # first-login local→cloud import prompt
    useOnlineStatus.ts    # navigator.onLine + online/offline events
  components/
    header/AppHeader.tsx  # New / Save / Fork / title / Login-or-Profile
    auth/LoginModal.tsx   # 4 provider buttons + last-provider hint
    auth/ProfileMenu.tsx  # avatar + logout
    pages/PageTabs.tsx    # page tabs: switch / add / delete / rename (REQ-PG-6)
    modals/AskToImportModal.tsx  # import-on-login prompt
    modals/ConfirmDialog.tsx     # reusable confirm (replaces window.confirm in tested paths)
  app/
    AppRoot.tsx           # (modify) boot/restore, header, page tabs, save wiring, auto-save, beforeunload
```

---

### Task 1: Record M02 scope deferrals in roadmap §9

**Files:** Modify `docs/superpowers/plans/2026-06-06-web-sequence-rewrite-roadmap.md`

- [ ] **Step 1:** Append to roadmap "## 9. Adversarial-review carry-forward" (new bullets):
```markdown
- **M02 scope boundaries (recorded).** Library/saved-items panel UI → M03. Full settings UI → M04 (M02 only loads `users/{uid}.settings` + honors preserveLastCode/autoSave/autoPreview). Plan-limit enforcement (3/20/∞) → M04 (M02 leaves a `// M04: enforce plan limit` seam in save). create-share/share-panel/stopSharing → M03 (M02 wires only getSharedItem + fork). Analytics `/track` + GTM/Mixpanel → M04 (M02 leaves `// M04: trackEvent` seams). Firebase anonymous-auth is intentionally NOT added — "anonymous" = full local-only operation when signed out (legacy parity).
```

- [ ] **Step 2: Commit**
```bash
git add docs/superpowers/plans/2026-06-06-web-sequence-rewrite-roadmap.md
git commit -m "docs(m02): record persistence/auth scope deferrals in roadmap §9"
```

---

### Task 2: Cloud Functions wrapper — `getSharedItem`

**Files:** Create `web/src/services/cloudFunctions.ts`, Test `web/src/services/cloudFunctions.test.ts`

> Only `getSharedItem` is needed in M02 (read a shared item). `createShare`/`trackEvent` wrappers are added in their milestones — do NOT stub them here (YAGNI). Use MSW (installed M00) to test the fetch.

- [ ] **Step 1: Write the failing test** `web/src/services/cloudFunctions.test.ts`:
```ts
import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { getSharedItem } from './cloudFunctions';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('getSharedItem', () => {
  it('GETs /get-shared-item with id + share-token and returns the item', async () => {
    server.use(http.get('http://localhost/get-shared-item', ({ request }) => {
      const url = new URL(request.url);
      expect(url.searchParams.get('id')).toBe('abc');
      expect(url.searchParams.get('share-token')).toBe('xyz');
      return HttpResponse.json({ id: 'abc', title: 'Shared', js: 'A.b', css: '', html: '', isReadOnly: true });
    }));
    const item = await getSharedItem('abc', 'xyz');
    expect(item.id).toBe('abc');
    expect(item.isReadOnly).toBe(true);
  });
  it('throws with the server error message on non-ok', async () => {
    server.use(http.get('http://localhost/get-shared-item', () =>
      HttpResponse.json({ error: 'Sharing disabled' }, { status: 403 })));
    await expect(getSharedItem('abc', 'xyz')).rejects.toThrow(/Sharing disabled/);
  });
});
```

- [ ] **Step 2: Run** `pnpm -C web test src/services/cloudFunctions.test.ts` → FAIL.

- [ ] **Step 3: Implement** `web/src/services/cloudFunctions.ts`:
```ts
import type { Item } from '../domain/types';

// Hosting-rewritten endpoints are same-origin paths (dev: Vite proxy → emulator;
// prod: Firebase Hosting rewrites). See contract spec §5.

// GET /get-shared-item?id=&share-token= → Item (isReadOnly:true). Public read.
export async function getSharedItem(id: string, shareToken: string): Promise<Item> {
  const res = await fetch(`/get-shared-item?id=${encodeURIComponent(id)}&share-token=${encodeURIComponent(shareToken)}`);
  if (!res.ok) {
    let msg = 'Failed to load shared item';
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return (await res.json()) as Item;
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add web/src/services/cloudFunctions.ts web/src/services/cloudFunctions.test.ts
git commit -m "feat(m02): getSharedItem cloud-function wrapper (contract §5)"
```

---

### Task 3: userService — ensureUser, item membership, settings, batch import

**Files:** Create `web/src/services/userService.ts`, Test `web/src/services/userService.test.ts`

> Tests mock the modular Firestore functions with `vi.mock('firebase/firestore', …)` so no real network. The functions are thin wrappers; the test asserts the RIGHT Firestore calls (doc paths, merge, deleteField).

- [ ] **Step 1: Write the failing test** `web/src/services/userService.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  doc: vi.fn((_db, path) => ({ path })),
  getDoc: vi.fn(),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async () => {}),
  deleteField: vi.fn(() => '__DELETE__'),
  writeBatch: vi.fn(),
}));
vi.mock('firebase/firestore', () => mocks);
vi.mock('./firebase', () => ({ db: {} }));

import { ensureUser, setItemForUser, unsetItemForUser, getUserItemIds } from './userService';

beforeEach(() => vi.clearAllMocks());

describe('userService', () => {
  it('ensureUser creates an empty doc (merge) when missing', async () => {
    mocks.getDoc.mockResolvedValueOnce({ exists: () => false, data: () => undefined });
    await ensureUser('u1');
    expect(mocks.setDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/u1' }), {}, { merge: true });
  });
  it('ensureUser returns existing data without writing', async () => {
    mocks.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ items: { i1: true } }) });
    const u = await ensureUser('u1');
    expect(u).toEqual({ items: { i1: true } });
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });
  it('setItemForUser sets items.<id> = true', async () => {
    await setItemForUser('u1', 'i9');
    expect(mocks.updateDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/u1' }), { 'items.i9': true });
  });
  it('unsetItemForUser deletes items.<id>', async () => {
    await unsetItemForUser('u1', 'i9');
    expect(mocks.updateDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/u1' }), { 'items.i9': '__DELETE__' });
  });
  it('getUserItemIds returns the items map keys', async () => {
    mocks.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ items: { a: true, b: true } }) });
    expect(await getUserItemIds('u1')).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `web/src/services/userService.ts`:
```ts
import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from './firebase';
import type { Settings } from '../domain/types';

interface UserDoc {
  items?: Record<string, true>;
  settings?: Partial<Settings>;
  [k: string]: unknown;
}

export async function ensureUser(uid: string): Promise<UserDoc> {
  const ref = doc(db, `users/${uid}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {}, { merge: true });
    return {};
  }
  return (snap.data() as UserDoc) ?? {};
}

export async function getUserItemIds(uid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, `users/${uid}`));
  const items = (snap.exists() ? (snap.data() as UserDoc).items : undefined) ?? {};
  return Object.keys(items);
}

export async function setItemForUser(uid: string, itemId: string): Promise<void> {
  await updateDoc(doc(db, `users/${uid}`), { [`items.${itemId}`]: true });
}

export async function unsetItemForUser(uid: string, itemId: string): Promise<void> {
  await updateDoc(doc(db, `users/${uid}`), { [`items.${itemId}`]: deleteField() });
}

export async function getUserSettings(uid: string): Promise<Partial<Settings>> {
  const snap = await getDoc(doc(db, `users/${uid}`));
  return (snap.exists() ? (snap.data() as UserDoc).settings : undefined) ?? {};
}

// Persist a single owned setting key (M04 settings UI calls this).
export async function setUserSetting<K extends keyof Settings>(uid: string, key: K, value: Settings[K]): Promise<void> {
  await updateDoc(doc(db, `users/${uid}`), { [`settings.${key}`]: value });
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add web/src/services/userService.ts web/src/services/userService.test.ts
git commit -m "feat(m02): userService — ensureUser, item membership, settings (contract §3)"
```

---

### Task 4: itemService — getItem / setItem / removeItem / saveLastCode

**Files:** Create `web/src/services/itemService.ts`, Test `web/src/services/itemService.test.ts`

> The core persistence contract (roadmap §4). Local-always; cloud merge when signed-in + online; strip `imageBase64`; ensure pages; stamp `createdBy`+`updatedOn`; `saveLastCode` → local `code` slot only. Tests mock `firebase/firestore`, `./firebase`, and use the M00 `localStore`. The signed-in/online state is injected (do NOT read `window.user`/globals — pass an auth context).

- [ ] **Step 1: Write the failing test** `web/src/services/itemService.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fs = vi.hoisted(() => ({
  doc: vi.fn((_db, path) => ({ path })),
  getDoc: vi.fn(),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
}));
vi.mock('firebase/firestore', () => fs);
vi.mock('./firebase', () => ({ db: {} }));

import { localStore } from './storage';
import { makeItemService } from './itemService';
import type { Item } from '../domain/types';

const baseItem = (over: Partial<Item> = {}): Item => ({
  id: 'item-1', title: 'T', js: 'A.b', css: '', html: '',
  htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: '', ...over,
});

beforeEach(() => { vi.clearAllMocks(); window.localStorage.clear(); });

describe('itemService.setItem', () => {
  it('always writes locally; signed-out → no cloud write', async () => {
    const svc = makeItemService(() => ({ uid: null, online: true }));
    await svc.setItem('item-1', baseItem());
    expect(await localStore.get<Item | null>('item-1', null)).toMatchObject({ id: 'item-1' });
    expect(fs.setDoc).not.toHaveBeenCalled();
  });
  it('signed-in + online → cloud setDoc(merge), stamps createdBy, ensures pages, strips imageBase64', async () => {
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    await svc.setItem('item-1', baseItem({ imageBase64: 'BIG' } as Partial<Item>));
    expect(fs.setDoc).toHaveBeenCalledTimes(1);
    const [ref, data, opts] = fs.setDoc.mock.calls[0];
    expect(ref).toMatchObject({ path: 'items/item-1' });
    expect(opts).toEqual({ merge: true });
    expect(data.createdBy).toBe('u1');
    expect(typeof data.updatedOn).toBe('number');
    expect(data.pages.length).toBe(1);             // migrateToPages applied
    expect('imageBase64' in data).toBe(false);     // stripped
    const local = await localStore.get<any>('item-1', null);
    expect('imageBase64' in local).toBe(false);
  });
  it('signed-in but OFFLINE → local write; cloud attempted but not awaited (resolves immediately)', async () => {
    const svc = makeItemService(() => ({ uid: 'u1', online: false }));
    await svc.setItem('item-1', baseItem());
    expect(await localStore.get<Item | null>('item-1', null)).not.toBeNull();
  });
});

describe('itemService.saveLastCode', () => {
  it('writes the item to the local `code` slot and never to cloud', async () => {
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    svc.saveLastCode(baseItem({ js: 'LAST' }));
    expect(await localStore.get<any>('code', null)).toMatchObject({ js: 'LAST' });
    expect(fs.setDoc).not.toHaveBeenCalled();
  });
});

describe('itemService.getItem', () => {
  it('own item: getDoc + ownership check', async () => {
    fs.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => baseItem({ createdBy: 'u1' }) });
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    const it = await svc.getItem('item-1');
    expect(it.id).toBe('item-1');
  });
  it('own item owned by someone else → throws', async () => {
    fs.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => baseItem({ createdBy: 'other' }) });
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    await expect(svc.getItem('item-1')).rejects.toThrow();
  });
});

describe('itemService.removeItem', () => {
  it('signed-out removes local; signed-in deletes the doc', async () => {
    await localStore.set('item-1', baseItem());
    const out = makeItemService(() => ({ uid: null, online: true }));
    await out.removeItem('item-1');
    expect(await localStore.get('item-1', null)).toBeNull();
    const inn = makeItemService(() => ({ uid: 'u1', online: true }));
    await inn.removeItem('item-2');
    expect(fs.deleteDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'items/item-2' }));
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `web/src/services/itemService.ts`:
```ts
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { localStore } from './storage';
import { migrateToPages } from '../domain/item';
import type { Item } from '../domain/types';

export interface AuthContext { uid: string | null; online: boolean }
export type AuthContextGetter = () => AuthContext;

// Factory so tests/hooks inject the auth/online context instead of reading globals
// (NFR-3: no window.* as the integration mechanism).
export function makeItemService(getAuth: AuthContextGetter) {
  async function setItem(id: string, item: Item): Promise<void> {
    // imageBase64 can blow the localStorage quota — never persist it.
    const clean: Item = { ...item };
    delete (clean as Partial<Item>).imageBase64;

    // Local write always (sync, fast feedback). The `code` slot is handled by saveLastCode.
    await localStore.set(id, clean);

    const { uid, online } = getAuth();
    if (!uid) return;

    const withMeta: Item = { ...migrateToPages(clean), createdBy: uid, updatedOn: Date.now() };
    delete (withMeta as Partial<Item>).imageBase64;
    const ref = doc(db, `items/${id}`);
    const cloud = setDoc(ref, withMeta, { merge: true });
    // Online: await so callers see the result. Offline: don't block — Firestore's
    // persistent cache queues the write and syncs on reconnect (CQ-5 multi-tab cache).
    if (online) await cloud; else void cloud.catch(() => {});
  }

  // Never goes to cloud — local `code` slot for last-code restore (REQ-PST).
  function saveLastCode(item: Item): void {
    const clean: Item = { ...item };
    delete (clean as Partial<Item>).imageBase64;
    void localStore.set('code', clean);
  }

  async function getItem(id: string): Promise<Item> {
    const { uid } = getAuth();
    const snap = await getDoc(doc(db, `items/${id}`));
    if (!snap.exists()) throw new Error('Item not found');
    const item = snap.data() as Item;
    if (!uid || item.createdBy !== uid) throw new Error('Unauthorized access to item');
    return migrateToPages(item);
  }

  async function removeItem(id: string): Promise<void> {
    const { uid } = getAuth();
    if (!uid) { await localStore.remove(id); return; }
    await deleteDoc(doc(db, `items/${id}`));
  }

  return { setItem, saveLastCode, getItem, removeItem };
}

export type ItemService = ReturnType<typeof makeItemService>;
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add web/src/services/itemService.ts web/src/services/itemService.test.ts
git commit -m "feat(m02): itemService — local-always + cloud-merge persistence (roadmap §4)"
```

---

### Task 5: itemService — subscribeAllItems + saveItems (batch import) + stopSharing seam

**Files:** Modify `web/src/services/itemService.ts`, extend `web/src/services/itemService.test.ts`

> `subscribeAllItems(uid, cb)` bridges `onSnapshot(query(where createdBy==uid))` to a callback (hooks turn this into the TanStack/store list). `saveItems(items)` batch-writes for import. Both signed-out variants persist locally. `stopSharing` is M03 — add only the signature + a `// M03` throw-or-noop stub so the interface is complete? NO — per YAGNI, defer `stopSharing` to M03 entirely (do not add a dead stub).

- [ ] **Step 1: Extend the test** (append):
```ts
import { writeBatch, collection, query, where, onSnapshot } from 'firebase/firestore';
// add to the firebase/firestore mock (fs) in vi.hoisted: writeBatch, collection, query, where, onSnapshot

describe('itemService.subscribeAllItems', () => {
  it('subscribes to items where createdBy == uid and maps docs to an array', () => {
    const unsub = vi.fn();
    fs.onSnapshot.mockImplementationOnce((_q, onNext) => {
      onNext({ forEach: (f: (d: any) => void) => { f({ data: () => ({ id: 'a', createdBy: 'u1' }) }); f({ data: () => ({ id: 'b', createdBy: 'u1' }) }); } });
      return unsub;
    });
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    const cb = vi.fn();
    const stop = svc.subscribeAllItems('u1', cb);
    expect(fs.where).toHaveBeenCalledWith('createdBy', '==', 'u1');
    expect(cb).toHaveBeenCalledWith([{ id: 'a', createdBy: 'u1' }, { id: 'b', createdBy: 'u1' }]);
    expect(stop).toBe(unsub);
  });
});

describe('itemService.saveItems (import)', () => {
  it('signed-in: batch sets each item + users.items.<id>; commits once', async () => {
    const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn(async () => {}) };
    fs.writeBatch.mockReturnValueOnce(batch);
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    await svc.saveItems({ a: baseItem({ id: 'a' }), b: baseItem({ id: 'b' }) });
    expect(batch.set).toHaveBeenCalledTimes(2);
    expect(batch.update).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});
```
(Update the `fs` hoisted mock to include `writeBatch`, `collection`, `query`, `where`, `onSnapshot` as `vi.fn()`s; `collection/query/where` can return marker objects.)

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — add to `makeItemService`:
```ts
// add imports:
// import { collection, query, where, onSnapshot, writeBatch } from 'firebase/firestore';

  function subscribeAllItems(uid: string, cb: (items: Item[]) => void): () => void {
    const q = query(collection(db, 'items'), where('createdBy', '==', uid));
    return onSnapshot(q, (snap) => {
      const items: Item[] = [];
      snap.forEach((d) => items.push(d.data() as Item));
      cb(items);
    }, () => cb([]));
  }

  async function saveItems(items: Record<string, Item>): Promise<void> {
    const { uid } = getAuth();
    const entries = Object.entries(items);
    if (!uid) {
      for (const [id, it] of entries) { const c = { ...it }; delete (c as Partial<Item>).imageBase64; await localStore.set(id, c); }
      return;
    }
    const batch = writeBatch(db);
    for (const [id, it] of entries) {
      const data: Item = { ...migrateToPages(it), createdBy: uid, updatedOn: it.updatedOn ?? Date.now() };
      delete (data as Partial<Item>).imageBase64;
      batch.set(doc(db, `items/${id}`), data);
      batch.update(doc(db, `users/${uid}`), { [`items.${id}`]: true });
    }
    await batch.commit();
  }
```
Add `subscribeAllItems` and `saveItems` to the returned object.

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add web/src/services/itemService.ts web/src/services/itemService.test.ts
git commit -m "feat(m02): itemService subscribeAllItems + batch saveItems (import) (roadmap §4)"
```

---

### Task 6: authStore + useOnlineStatus

**Files:** Create `web/src/state/authStore.ts`, `web/src/hooks/useOnlineStatus.ts`; Tests `web/src/state/authStore.test.ts`

- [ ] **Step 1: Failing test** `web/src/state/authStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => useAuthStore.setState({ user: null, online: true }));
  it('sets and clears the user', () => {
    useAuthStore.getState().setUser({ uid: 'u1', email: 'a@b.c' });
    expect(useAuthStore.getState().user?.uid).toBe('u1');
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().user).toBeNull();
  });
  it('tracks online status', () => {
    useAuthStore.getState().setOnline(false);
    expect(useAuthStore.getState().online).toBe(false);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `web/src/state/authStore.ts`:
```ts
import { create } from 'zustand';
import type { AppUser } from '../domain/types';

interface AuthState {
  user: AppUser | null;
  online: boolean;
  setUser(u: AppUser | null): void;
  setOnline(o: boolean): void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setUser: (user) => set({ user }),
  setOnline: (online) => set({ online }),
}));
```

`web/src/hooks/useOnlineStatus.ts`:
```ts
import { useEffect } from 'react';
import { useAuthStore } from '../state/authStore';

export function useOnlineStatus(): void {
  const setOnline = useAuthStore((s) => s.setOnline);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    setOnline(navigator.onLine);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [setOnline]);
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add web/src/state/authStore.ts web/src/state/authStore.test.ts web/src/hooks/useOnlineStatus.ts
git commit -m "feat(m02): auth store + online-status hook"
```

---

### Task 7: useAuth — onAuthChange wiring, login (lastAuthProvider + account-exists), logout

**Files:** Create `web/src/hooks/useAuth.ts`, Test `web/src/hooks/useAuth.test.ts`

> Wraps the M00 `firebase.ts` `login/logout/onAuthChange`. On login, persist `lastAuthProvider` (LS_KEYS) and alert on `auth/account-exists-with-different-credential`. The hook also `ensureUser` + loads settings on login (settings store in Task 8 — sequence so this task only sets the user; settings load added in Task 8). Mock `../services/firebase`.

- [ ] **Step 1: Failing test** `web/src/hooks/useAuth.test.ts`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const fb = vi.hoisted(() => ({
  login: vi.fn(async () => {}),
  logout: vi.fn(async () => {}),
  onAuthChange: vi.fn((cb: (u: unknown) => void) => { fb._cb = cb; return () => {}; }) as any,
  _cb: (_u: unknown) => {},
}));
vi.mock('../services/firebase', () => ({ login: fb.login, logout: fb.logout, onAuthChange: fb.onAuthChange }));
vi.mock('../services/userService', () => ({ ensureUser: vi.fn(async () => ({})), getUserSettings: vi.fn(async () => ({})) }));

import { useAuth } from './useAuth';
import { useAuthStore } from '../state/authStore';

beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: null, online: true }); window.localStorage.clear(); });

describe('useAuth', () => {
  it('subscribes to auth changes and reflects the user in the store', async () => {
    renderHook(() => useAuth());
    await act(async () => { fb._cb({ uid: 'u1', email: 'a@b.c', displayName: 'A', photoURL: null }); });
    expect(useAuthStore.getState().user?.uid).toBe('u1');
  });
  it('login persists lastAuthProvider', async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.login('google'); });
    expect(fb.login).toHaveBeenCalledWith('google');
    expect(window.localStorage.getItem('lastAuthProvider')).toContain('google');
  });
  it('login surfaces account-exists-with-different-credential', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    fb.login.mockRejectedValueOnce({ code: 'auth/account-exists-with-different-credential' });
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.login('github'); });
    expect(alertSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `web/src/hooks/useAuth.ts`:
```ts
import { useCallback, useEffect } from 'react';
import { login as fbLogin, logout as fbLogout, onAuthChange } from '../services/firebase';
import { ensureUser } from '../services/userService';
import { useAuthStore } from '../state/authStore';
import { localStore } from '../services/storage';
import { LS_KEYS } from '../config/constants';
import type { ProviderName } from '../services/types';

export function useAuth() {
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    return onAuthChange((user) => {
      setUser(user);
      if (user) void ensureUser(user.uid).catch(() => {});
    });
  }, [setUser]);

  const login = useCallback(async (provider: ProviderName) => {
    try {
      await fbLogin(provider);
      await localStore.set(LS_KEYS.lastAuthProvider, provider);
    } catch (e) {
      if ((e as { code?: string })?.code === 'auth/account-exists-with-different-credential') {
        window.alert('You have already signed up with the same email using a different social login.');
      } else {
        throw e;
      }
    }
  }, []);

  const logout = useCallback(async () => { await fbLogout(); }, []);

  return { login, logout };
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add web/src/hooks/useAuth.ts web/src/hooks/useAuth.test.ts
git commit -m "feat(m02): useAuth — auth wiring, lastAuthProvider, account-exists alert (REQ-AC, contract §2)"
```

---

### Task 8: settingsStore + load-once on login

**Files:** Create `web/src/state/settingsStore.ts`, Test `web/src/state/settingsStore.test.ts`; Modify `web/src/hooks/useAuth.ts`

> Settings are loaded once (from `users/{uid}.settings` merged over `DEFAULT_SETTINGS`, falling back to local for signed-out). Full settings-editing UI is M04; M02 only needs read + a few honored flags (preserveLastCode/autoSave/autoPreview). Unknown keys in the stored map are ignored (we only own `Settings` keys).

- [ ] **Step 1: Failing test** `web/src/state/settingsStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settingsStore';
import { DEFAULT_SETTINGS } from '../domain/types';

describe('settingsStore', () => {
  beforeEach(() => useSettingsStore.setState({ settings: DEFAULT_SETTINGS }));
  it('defaults to DEFAULT_SETTINGS', () => {
    expect(useSettingsStore.getState().settings.autoSave).toBe(false);
    expect(useSettingsStore.getState().settings.preserveLastCode).toBe(true);
  });
  it('merge applies known keys over defaults and ignores unknown keys', () => {
    useSettingsStore.getState().merge({ autoSave: true, bogusKey: 1 } as never);
    expect(useSettingsStore.getState().settings.autoSave).toBe(true);
    expect((useSettingsStore.getState().settings as Record<string, unknown>).bogusKey).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `web/src/state/settingsStore.ts`:
```ts
import { create } from 'zustand';
import { DEFAULT_SETTINGS, type Settings } from '../domain/types';

const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

interface SettingsState {
  settings: Settings;
  merge(partial: Partial<Settings>): void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  merge: (partial) => set((s) => {
    const next = { ...s.settings };
    for (const k of SETTINGS_KEYS) {
      if (partial[k] !== undefined) (next as Record<string, unknown>)[k] = partial[k];
    }
    return { settings: next };
  }),
}));
```

- [ ] **Step 4:** In `useAuth.ts`, after `ensureUser`, load settings into the store:
```ts
// import { getUserSettings } from '../services/userService';
// import { useSettingsStore } from '../state/settingsStore';
// inside onAuthChange handler, when user:
//   void getUserSettings(user.uid).then((s) => useSettingsStore.getState().merge(s)).catch(() => {});
```
(Add the import + call. Keep the existing user-set behavior.)

- [ ] **Step 5: Run** full suite → green. **Step 6: Commit**
```bash
git add web/src/state/settingsStore.ts web/src/state/settingsStore.test.ts web/src/hooks/useAuth.ts
git commit -m "feat(m02): settings store + load-once on login (M04 owns the editing UI)"
```

---

### Task 9: editorStore save lifecycle (unsaved count, save flags, item meta)

**Files:** Modify `web/src/state/editorStore.ts`, extend `web/src/state/editorStore.test.ts`

> Add the save/dirty lifecycle the header + auto-save need, keeping the existing pure-helper delegation. Edits increment `unsavedCount`; `markSaved` zeroes it; `setItemMeta` updates title/id; `newItem`/`forkCurrent` produce items.

- [ ] **Step 1: Extend the test** (append):
```ts
import { DEFAULT_STARTER } from './editorStore';

it('edits increment unsavedCount; markSaved resets it', () => {
  useEditorStore.getState().loadItem(sample());
  useEditorStore.getState().setDsl('X');
  useEditorStore.getState().setDsl('Y');
  expect(useEditorStore.getState().unsavedCount).toBe(2);
  useEditorStore.getState().markSaved();
  expect(useEditorStore.getState().unsavedCount).toBe(0);
  expect(useEditorStore.getState().dirty).toBe(false);
});
it('newItem loads a fresh untitled item with an id and pages', () => {
  useEditorStore.getState().newItem();
  const it = useEditorStore.getState().currentItem!;
  expect(it.id).toMatch(/^item-/);
  expect(it.pages.length).toBe(1);
  expect(useEditorStore.getState().unsavedCount).toBe(0);
});
it('forkCurrent clears id, prefixes title, resets unsavedCount', () => {
  useEditorStore.getState().loadItem(sample({ id: 'item-1', title: 'Orig' }));
  useEditorStore.getState().forkCurrent();
  const it = useEditorStore.getState().currentItem!;
  expect(it.id).toMatch(/^item-/);
  expect(it.id).not.toBe('item-1');
  expect(it.title).toBe('(Forked) Orig');
});
```
(Adjust `sample()` to accept overrides if it doesn't already.)

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — extend `editorStore.ts`:
- Add state: `unsavedCount: number` (default 0), `saving: boolean` (default false).
- `setDsl`/`setCss` also `unsavedCount: s.unsavedCount + 1`.
- `markSaved: () => set({ dirty: false, unsavedCount: 0 })`.
- `setSaving(b)`, `setTitle(title)`, `setItemId(id)`.
- `newItem()`: build a fresh `Item` (id `item-<random>`, the legacy default content, migrateToPages), `loadItem` it, reset counts.
- `forkCurrent()`: deep-clone currentItem, new id, title `(Forked) <title>`, `updatedOn: Date.now()`, load it, reset counts.
- Export `DEFAULT_STARTER` (the default new-item content, ported from legacy createNewItem) and a `genItemId()` helper (`'item-' + crypto.randomUUID()`-style, reuse the item.ts id approach — or import a shared id util).

> Use the SAME default starter DSL as legacy `createNewItem` (the BookLibService example) so parity holds. Put the default content string in `DEFAULT_STARTER`.

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add web/src/state/editorStore.ts web/src/state/editorStore.test.ts
git commit -m "feat(m02): editor save lifecycle — unsavedCount, newItem, forkCurrent (REQ-PST, REQ-SHR-3)"
```

---

### Task 10: useItems — live item list (bridge onSnapshot → query cache)

**Files:** Create `web/src/hooks/useItems.ts`, Test `web/src/hooks/useItems.test.tsx`

> Signed-in: subscribe via `itemService.subscribeAllItems`, sort by `updatedOn` desc client-side (CQ-4 load-all). Signed-out: read local items. Expose `{ items, loading }`. (The list UI is M03; this hook is the data source + proves the subscription.)

- [ ] **Step 1: Failing test** `web/src/hooks/useItems.test.tsx` — mock `../services/itemService` `subscribeAllItems` to invoke the cb with two items (different updatedOn) and assert the hook returns them sorted desc. Mock the signed-out path to read `localStore`. (Write a focused RTL `renderHook` test; provide a `makeItemService`-injected or module-mocked service.)

- [ ] **Step 2–4:** Implement `useItems.ts`: read `useAuthStore.user`; if uid, `useEffect` subscribes and stores items in local state (sorted desc by `updatedOn ?? 0`), returns unsub on cleanup; if no uid, load local items map → items array. Return `{ items, loading }`. Run → PASS.

- [ ] **Step 5: Commit**
```bash
git add web/src/hooks/useItems.ts web/src/hooks/useItems.test.tsx
git commit -m "feat(m02): useItems — live owned-items list (onSnapshot bridge, client sort) (CQ-4)"
```

---

### Task 11: LoginModal + ProfileMenu + AppHeader

**Files:** Create `web/src/components/auth/LoginModal.tsx`, `web/src/components/auth/ProfileMenu.tsx`, `web/src/components/header/AppHeader.tsx`; Tests for each.

> Header: title (editable), **New**, **Save**, **Fork**, and either a **Login** button (opens LoginModal) or the ProfileMenu (avatar + Logout). LoginModal: 4 provider buttons (Google/GitHub/Facebook/Twitter) calling `login(provider)`, with a "last used" hint from `LS_KEYS.lastAuthProvider`. Use Radix Dialog (installed M00).

- [ ] **Steps:** TDD each component (RTL): LoginModal renders 4 buttons and clicking one calls the injected `onLogin(provider)`; AppHeader shows Login when `user==null` and ProfileMenu when set; Save button calls `onSave`, New calls `onNew`, Fork calls `onFork`. Wire `data-testid`s (`header-save`, `header-new`, `header-fork`, `header-login`, `login-google` etc.). Keep components presentational (handlers injected) for testability. Commit:
```bash
git commit -m "feat(m02): login modal + profile menu + app header (REQ-AC, REQ-LAY)"
```

---

### Task 12: Boot/restore + lifecycle wiring in AppRoot

**Files:** Modify `web/src/app/AppRoot.tsx`, create `web/src/hooks/useBootItem.ts`, Test `web/src/hooks/useBootItem.test.tsx`

> Replace M01's hardcoded `STARTER` seeding with the real boot logic (REQ-PST last-code restore + shared/own item resolution), and wire the header actions + auth + online + page tabs + auto-save + beforeunload.

- [ ] **Step 1:** Implement `useBootItem` (TDD): given `{ idParam, shareToken, preserveLastCode, getItem, getLastCode, uidKnown }`, resolve the boot item:
  1. If `shareToken` + `idParam`: `getSharedItem(idParam, shareToken)` → load read-only (set `isReadOnly`).
  2. Else if `idParam`: `getItem(idParam)` → if owned, open; on error, fall back to new item (or fork if it resolves but isn't owned — owner check throws, so error → new). 
  3. Else if `preserveLastCode` and a local `code` slot with `.js` exists: restore it.
  4. Else: `newItem()`.
  Test the decision table with injected fakes (no network).

- [ ] **Step 2:** Wire `AppRoot.tsx`:
  - Call `useAuth()`, `useOnlineStatus()` once.
  - Build the auth context getter `() => ({ uid: useAuthStore.getState().user?.uid ?? null, online: useAuthStore.getState().online })` and `const itemService = useMemo(() => makeItemService(authGetter), [])`.
  - On mount, run `useBootItem` to populate the editor store (replace the `STARTER` effect).
  - Render `<AppHeader>` (above the Layout) wired to: New → `editorStore.newItem()`; Save → save flow (Task 13); Fork → `editorStore.forkCurrent()` then save-as-new; Login → open LoginModal; title edit → `editorStore.setTitle`.
  - Render `<PageTabs>` (Task 14) above the editor.
  - `beforeunload`/`visibilitychange(hidden)` → `itemService.saveLastCode(currentItem)` (REQ-PST).
  - Keep all M01 editor/preview/console/fullscreen wiring intact.

- [ ] **Step 3:** Run full suite + typecheck → green. Manual: `pnpm -C web dev`, confirm boot shows a diagram, reload preserves last code (when preserveLastCode on). Commit:
```bash
git commit -m "feat(m02): boot/restore + lifecycle wiring (last-code, shared/own resolution) (REQ-PST)"
```

---

### Task 13: Save flow + import-on-login

**Files:** Modify `web/src/app/AppRoot.tsx`; create `web/src/hooks/useImportOnLogin.ts`, `web/src/components/modals/AskToImportModal.tsx`; Tests.

- [ ] **Step 1:** Save flow (in AppRoot or a `useSaveItem` hook): on Save → set `saving`, stamp `updatedOn`/`sizes`/`mainSizes`, `itemService.setItem(id, item)`; if new item (first save), also `userService.setItemForUser(uid, id)` (when signed-in); `editorStore.markSaved()`; clear `saving`. Read-only items skip save. Leave a `// M04: enforce plan limit` + `// M04: trackEvent('fn','saved')` seam. Signed-out first-save shows the legacy "login & save" one-time notice (LS_KEYS.loginAndSaveMessageSeen) — implement as a ConfirmDialog, not window.confirm, in the tested path.

- [ ] **Step 2:** `useImportOnLogin` (TDD): when a user becomes authenticated AND `LS_KEYS.askedToImportCreations` is unset AND local items exist → expose `{ pending, count, doImport, dismiss }`. `doImport` → `itemService.saveItems(localItems)` then set the flag; `dismiss` → set the flag. `AskToImportModal` shows the count + Import/Don't-ask buttons.

- [ ] **Step 3:** Wire AskToImportModal in AppRoot driven by `useImportOnLogin`. Run full suite + typecheck → green. Commit:
```bash
git commit -m "feat(m02): save flow + import-on-login (REQ-PST, REQ-AC)"
```

---

### Task 14: PageTabs UI (switch / add / delete / rename)

**Files:** Create `web/src/components/pages/PageTabs.tsx`, Test `web/src/components/pages/PageTabs.test.tsx`; Modify `web/src/app/AppRoot.tsx`

> The store already has `addPage/switchPage/deletePage` (M01). Add **rename** (REQ-PG-6) to the store + a tab UI. Default/first page has no delete control (REQ-PG-3). Rename via double-click → inline input.

- [ ] **Step 1:** Add `renamePage(pageId, title)` to `editorStore` (uses `applyPageEdit(item, pageId, {title})`) + a test.
- [ ] **Step 2:** TDD `PageTabs`: renders a tab per `pages` with the active one marked (`aria-selected`); clicking a tab calls `onSwitch(id)`; an "Add page" button calls `onAdd`; non-default tabs show a delete control calling `onDelete(id)` (with a confirm); double-click a tab title → inline `<input>` that on Enter/blur calls `onRename(id, value)`. `data-testid`s: `page-tab-<id>`, `page-add`, `page-delete-<id>`, `page-rename-<id>`.
- [ ] **Step 3:** Wire into AppRoot above the editor; switching a page must reload the editors with that page's js/css (the editor reads `item.js`/`item.css` which the store mirrors on switch — confirm the DSL/CSS editors update on `currentPageId` change). Run full suite + typecheck → green. Commit:
```bash
git commit -m "feat(m02): multi-page tabs — switch/add/delete/rename (REQ-PG-1..6)"
```

---

### Task 15: Auto-save loop

**Files:** Create `web/src/hooks/useAutoSave.ts`, Test `web/src/hooks/useAutoSave.test.tsx`; Modify `web/src/app/AppRoot.tsx`

- [ ] **Step 1:** TDD `useAutoSave({ enabled, hasUnsaved, onSave })`: when `enabled` (settings.autoSave) and `hasUnsaved` (unsavedCount>0), calls `onSave` every `AUTO_SAVE_INTERVAL` (15000ms). Use `vi.useFakeTimers()`; assert `onSave` fires after 15s when enabled+dirty, and NOT when disabled or clean. Cleans up the interval on unmount/disable.
- [ ] **Step 2–4:** Implement with `setInterval` keyed on `[enabled]`, reading latest `hasUnsaved`/`onSave` via refs (avoid stale closures — same pattern as M01 PreviewFrame). Wire into AppRoot: `useAutoSave({ enabled: settings.autoSave, hasUnsaved: unsavedCount>0, onSave: save })`. Run → green. Commit:
```bash
git commit -m "feat(m02): auto-save loop (REQ-PST-2, AUTO_SAVE_INTERVAL)"
```

---

### Task 16: Delete item + open-from-list stub

**Files:** Modify `web/src/app/AppRoot.tsx`; small `web/src/components/library/ItemListStub.tsx` (minimal, M03 replaces)

> M02 needs delete + a way to open a saved item to exercise the lifecycle; the full library is M03. Provide a minimal list (from `useItems`) in the sidebar's "library" panel slot: each row opens the item (`itemService.getItem` → `editorStore.loadItem`) and has a delete (`itemService.removeItem` + `userService.unsetItemForUser` + confirm). Mark the file `// M03: replace with full library panel`.

- [ ] **Steps:** TDD the open + delete handlers (logic, with injected service fakes). Render the stub list in the `activePanel==='library'` slot (uiStore from M01). Run full suite + typecheck → green. Commit:
```bash
git commit -m "feat(m02): item open + delete via minimal list stub (M03 replaces) (REQ-PST)"
```

---

### Task 17: E2E — persistence + pages (local, no auth)

**Files:** Create/extend `e2e/tests/persistence.spec.js` (repo root)

> Real-browser E2E for the local (signed-out) flows that don't need Firebase auth: last-code restore + multi-page. Auth/cloud E2E needs the emulator (deferred to a later gate — note it). Run from repo ROOT (`pnpm exec playwright test`), webServer already points at `pnpm -C web dev` (M01).

- [ ] **Step 1:** Spec: load app → type DSL → reload → assert the DSL persisted (last-code restore, preserveLastCode default true). Add a page via `page-add`, type different DSL, switch tabs, assert per-page content. New item (`header-new`) resets to the starter. 
- [ ] **Step 2:** Run from repo root `pnpm exec playwright test persistence --project=chromium` → green. Keep the M01 specs green too. Note in the spec header that authenticated cloud-sync E2E requires the Firebase emulator and is deferred to the staging gate.
- [ ] **Step 3:** Full gate: `pnpm -C web typecheck && pnpm -C web test` green; `pnpm exec playwright test --project=chromium` green. Commit:
```bash
git commit -m "test(m02): E2E — last-code restore + multi-page (local, signed-out)"
```

---

### Task 18: Adversarial review of M02 surfaces

**Files:** none (review + fix)

- [ ] **Step 1:** Dispatch independent reviewers (parallel) against ground truth (legacy `src/itemService.js`, `src/components/app.jsx`, `src/auth.js`, contract spec §2–§5) over:
  1. `itemService.ts` + `userService.ts` — exact Firestore call shapes (paths, `merge:true`, `deleteField`, batch), imageBase64 strip, createdBy stamp, ownership check on read, offline non-blocking write, subscribeAllItems query + cleanup. **Does it match the frozen contract exactly?**
  2. `useAuth.ts` + import-on-login + boot/restore — provider flow, lastAuthProvider, account-exists, ensureUser, the `askedToImportCreations` one-shot, last-code restore decision table (shared vs own vs new), beforeunload saveLastCode.
  3. editorStore save lifecycle + auto-save + PageTabs — unsavedCount accuracy, fork semantics, dual-write on page switch, rename, auto-save stale-closure/cleanup, default-page delete guard.
  4. Cross-cutting: any `window.*`-as-integration leakage (NFR-3), any read of a global instead of injected context, any place that could write `imageBase64` or the `code` slot to cloud, any unbounded re-subscribe/leak.
- [ ] **Step 2:** Triage; fix real findings with discriminating regression tests (revert→fail). Record deferrals in roadmap §9.
- [ ] **Step 3:** Commit fixes (one per fix, message references the review).

---

## Self-Review (completed during authoring)

**Spec coverage:** REQ-DM-1/2/3 (dual-write/migration/legacy externalLibs preserved on round-trip — itemService writes the whole Item incl. `externalLibs`) → Tasks 4/9/14. REQ-PG-1..6 (create/switch/delete/rename + default-guard) → Tasks 9/14. REQ-PST-1..4 (auto-save, last-code, offline, multi-tab) → Tasks 4/12/13/15 + M00 cache. REQ-AC (4 OAuth, import-on-login, local-when-signed-out) → Tasks 7/13. REQ-SHR-3 (fork) → Task 9/12. Contract §2 (auth) §3 (schema) §5 (get-shared-item) → Tasks 2/3/4/7. Deferred (library/settings-UI/plan-gating/share-create/analytics) recorded in §9 (Task 1).

**Placeholders:** service-layer + store + hook tasks have full code/tests; the UI-heavy tasks (11/14/16) specify exact components, props, testids, and TDD targets without dumping every line — acceptable for presentational components, but each names its tests and data-testids so there is no ambiguity. No "TBD".

**Type consistency:** reuses canonical `Item`/`Page`/`Settings`/`AppUser`/`DEFAULT_SETTINGS`, M00 `firebase.ts`/`storage.ts`, M01 `editorStore`/`uiStore`/`AppRoot`. Service signatures match roadmap §4 (`getItem`/`setItem`/`saveItems`/`removeItem`/`setItemForUser`/`unsetItemForUser`/`subscribeAllItems`/`saveLastCode`); `makeItemService(authGetter)` factory replaces the global-reading legacy (NFR-3). `stopSharing` intentionally deferred to M03 (no dead stub).

---

## Done when

- [ ] `pnpm -C web typecheck`, `pnpm -C web test` green; `pnpm exec playwright test --project=chromium` green (incl. the new persistence spec + M01 specs).
- [ ] Signed-out: create/edit/save (local), multi-page, last-code restore on reload all work.
- [ ] Signed-in (against the contract; unit-mocked here, emulator/staging for live): save writes `items/{id}` (merge, createdBy, no imageBase64) + `users/{uid}.items.{id}`; the owned-items list streams via onSnapshot; import-on-login offers to upload local items once.
- [ ] Fork produces an owned copy; delete removes item + membership; auto-save fires on the interval when enabled+dirty.
- [ ] No backend asset changed; legacy `src/` + legacy `yarn test` isolation intact; no `window.*` integration globals.
- [ ] Adversarial review (Task 18) complete; real findings fixed with regression tests; deferrals in roadmap §9.
- [ ] All work committed in small steps.
