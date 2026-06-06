# Milestone 03 — Library + Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. Read the roadmap (`…-roadmap.md`, esp. §3 types, §4 service interfaces, §8/§9 decisions + carry-forward), the requirements spec (`…-requirements.md` §4.3 Folder, §10 Library, §11 Sharing — REQ-LIB-1..8, REQ-SHR-1..5), the contract spec (`…-frontend-backend-contract.md` §3 schema, §4.3 folders, §5.1 create-share, §5.2 get-shared-item), and the **design system** (`2026-06-07-design-system.md` — MANDATORY for all UI). M00+M01+M02 are complete on `rewrite/web-foundation`.

**Goal:** A signed-in user can browse / search / organize their saved diagrams into folders, run item actions (open / fork / delete / move-to-folder), import & export JSON + generate standalone HTML, and create / present / revoke share links — all against the FROZEN backend.

**Architecture:** New framework-agnostic services — `folderService.ts` (folders-array CRUD via `arrayUnion` + `runTransaction`), `itemService` gains `moveToFolder` + `stopSharing` (client-side owner writes), `cloudFunctions.ts` gains `createShare` (POST `/create-share`, token in body, `getIdToken(true)`), and `exportImport.ts` (JSON export/import with old-format migration + standalone-HTML generation). **Hooks** `useFolders`, `useShare` bridge them into React. The minimal M02 `ItemListStub` is **replaced** by a full **Library panel** (`components/library/`) — search, folder groups, item actions, keyboard nav, import/export — and a **Share** popover (`components/share/`). Everything signed-in-only for folders/share; the library still lists local items when signed out (read-only of the local set).

**Tech Stack:** Firebase modular v10 (`firestore`: `arrayUnion`, `runTransaction`, `updateDoc`, `setDoc`, `doc`; `auth.getIdToken`), React 19, Zustand, Radix (Dialog/DropdownMenu/Popover — add `@radix-ui/react-popover` if needed), Tailwind + the Drafting Table design system, Vitest + RTL, Playwright.

---

## Pre-flight (read once)

- **Working dir:** all commands `pnpm -C web …` from repo root (cwd drifts). Installs use `pnpm -C web add --ignore-workspace …`. Branch `rewrite/web-foundation` — do NOT branch. Touch only `web/src/**` (+ `e2e/` for E2E). NEVER modify legacy `src/` or any backend asset (Cloud Functions / Firestore rules / indexes / external services are FROZEN — NFR-1).
- **DESIGN SYSTEM (mandatory for every UI task — 9–14):** build from `web/src/ui/` primitives (`Button`, `IconButton`, `TextInput`, `Dialog`/`DialogContent`, `Menu*`, `cn`) + Tailwind semantic tokens per `docs/superpowers/specs/2026-06-07-design-system.md`. Library panel + share popover sit on **ink**; modals/menus/popovers on **paper** with `shadow-pop`. `font-mono` for metadata/counts, `font-serif` for empty-state/section headlines, one `Button variant="primary"` per surface. If a primitive is missing (e.g. `Popover`, `SearchInput`), ADD it to `web/src/ui/` (wrapping the matching Radix part) before building the feature. No `gray-*`/raw hex/ad-hoc fonts. Keep `data-testid`s.
- **M02 gives you:** `services/itemService.ts` (`makeItemService(getAuth)` → `getItem/setItem/removeItem/saveLastCode/subscribeAllItems/saveItems`), `services/userService.ts` (`ensureUser/getUserItemIds/setItemForUser/unsetItemForUser/getUserSettings/setUserSetting`), `services/localItems.ts`, `services/cloudFunctions.ts` (`getSharedItem`), `services/firebase.ts` (`auth`, `db`, `getIdToken`), `hooks/useItems.ts` (`{items,loading}`), `hooks/useAuth.ts`, `state/{authStore,editorStore,settingsStore,uiStore}.ts`, `components/library/ItemListStub.tsx` (THIS MILESTONE REPLACES IT), `components/modals/ConfirmDialog.tsx`, the design-system `web/src/ui/`.
- **editorStore (M02):** `currentItem`, `loadItem`, `forkCurrent`, `newItem`, `setTitle`, `markSaved`, `unsavedCount`, `dirty`.

### Key facts from the contract (ground truth — match EXACTLY)
- **Folders** live as an **array on `users/{uid}.folders`** — NO separate collection/rule. Shape `{ id:"folder-<rand>", name, createdOn, updatedOn }`.
  - Create: if the user doc is missing → `setDoc(userRef, { folders:[folder] }, { merge:true })`; else `updateDoc(userRef, { folders: arrayUnion(folder) })`.
  - Rename / delete: **`runTransaction`** read-modify-write of the `folders` array (rename matches by id; delete filters the id out). Operations require sign-in.
  - **Folder delete does NOT rewrite items** (CQ-3): items keep an orphaned `folderId` and render under "Unfiled" via an existence check `folders.some(f => f.id === item.folderId)`.
- **Item.folderId?** (optional) references a folder. **Move-to-folder** = owner `setItem` with the new `folderId` (cloud merge). Clearing = set `folderId` to `undefined`/remove.
- **Sharing fields** (`isShared`, `shareToken`, `sharedAt`) are written by the backend `create_share` — the client normally never writes them, EXCEPT the new client-side **stop-sharing** (CQ-2 / REQ-SHR-5): the owner MAY `update` their own item doc per the rules → set `isShared:false` (and drop `shareToken`) so old links die; the next `createShare` mints a fresh token.
- **`POST /create-share`** (§5.1): body `{ id, token }` where `token = await getIdToken(true)` (FRESH). Backend loads `items/{id}`, 404 if absent, **403 if `createdBy !== uid`**, reuses/generates a 16-byte hex `shareToken`, writes `{isShared:true, shareToken, sharedAt}`, computes `md5(item.js)`. **Response 200:** `{ page_share:"<origin>?id=<id>&share-token=<token>", md5 }`. Final share URL = `page_share + ("?"|"&") + "v=" + md5`. The item must be SAVED first (createShare reads the cloud doc).
- **`GET /get-shared-item`** (M02 wired): `?id=&share-token=` → Item (read-only). Boot already loads shared read-only (M02 Task 12) — M03 adds the share-error message + fork-from-shared affordance.
- **List query** stays `where('createdBy','==',uid)` via the existing `subscribeAllItems` (composite index `createdBy ASC, updatedOn DESC`); folder filtering + search are CLIENT-SIDE in memory (CQ-4 load-all, no pagination).

### Deferred (recorded, not silently dropped) — record in roadmap §9 in Task 1
- **Settings UI, subscription/plan gating, analytics `/track`, the remaining modal inventory** → **M04**. M03 leaves `// M04:` seams where it would gate/track (e.g. folder/library actions emit no analytics yet).
- **Extension/embed surfaces + production cutover** → **M05**.
- **`/sync-diagram`** stays unused (CQ-1) — wire only `/create-share`.

---

## File structure (this milestone)

```
web/src/
  services/
    folderService.ts        # folders-array CRUD: createFolder(arrayUnion)/renameFolder(txn)/deleteFolder(txn)/getFolders
    exportImport.ts         # exportAllItemsJson / importItemsJson (old-format migrate) / buildStandaloneHtml
    itemService.ts          # (extend) moveToFolder(id, folderId|null), stopSharing(id)
    cloudFunctions.ts       # (extend) createShare(id) → { url, md5 }
  hooks/
    useFolders.ts           # folders list (from user doc / live), CRUD actions, requires sign-in
    useShare.ts             # createShare/stopSharing for the current item + link/copy state
  state/
    libraryStore.ts         # UI state for the library panel: query, activeFolderId, sort
  components/
    library/
      LibraryPanel.tsx      # REPLACES ItemListStub — search + folder groups + item rows + import/export
      LibraryItemRow.tsx    # one item: open / fork / delete / move-to-folder (Menu)
      FolderList.tsx        # folder groups + "Unfiled" + folder CRUD controls
      ImportExportBar.tsx   # export-all JSON / import JSON / (per-item standalone HTML lives on the row menu)
    share/
      ShareButton.tsx       # header control → opens SharePopover
      SharePopover.tsx      # create link, show + copy, "Stop sharing"
    modals/
      ShareErrorNotice.tsx  # shown when a share link fails to load (REQ-SHR-4)
  ui/
    Popover.tsx             # (add) Radix popover wrapper (paper surface, shadow-pop)
    SearchInput.tsx         # (add) design-system search field (icon + clear)
  app/
    AppRoot.tsx             # (modify) mount LibraryPanel in the 'library' slot (replace stub), ShareButton in header, ShareErrorNotice on boot share-failure, fork-from-shared
```

---

### Task 1: Record M03 scope deferrals in roadmap §9

**Files:** Modify `docs/superpowers/plans/2026-06-06-web-sequence-rewrite-roadmap.md`

- [ ] **Step 1:** Append to roadmap "## 9. Adversarial-review carry-forward":
```markdown
- **M03 scope boundaries (recorded).** Settings UI / subscription + plan-limit gating / analytics `/track` + GTM/Mixpanel / remaining modal inventory → M04 (M03 leaves `// M04:` seams at gate/track points). Extension + embed + production cutover → M05. `/sync-diagram` stays unused (CQ-1) — only `/create-share` is wired. Folder delete intentionally does NOT rewrite item docs (CQ-3) — orphaned `folderId` renders "Unfiled" via existence check.
```
- [ ] **Step 2: Commit**
```bash
git add docs/superpowers/plans/2026-06-06-web-sequence-rewrite-roadmap.md
git commit -m "docs(m03): record library/sharing scope deferrals in roadmap §9"
```

---

### Task 2: folderService — create / rename / delete / get (folders array on user doc)

**Files:** Create `web/src/services/folderService.ts`, Test `web/src/services/folderService.test.ts`

> Match the contract §4.3 EXACTLY: create via `arrayUnion` (or `setDoc({folders:[f]},{merge:true})` when the doc is missing); rename/delete via `runTransaction` read-modify-write. Folder id = `'folder-' + crypto.randomUUID()`. Tests mock `firebase/firestore`.

- [ ] **Step 1: Failing test** `web/src/services/folderService.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fs = vi.hoisted(() => ({
  doc: vi.fn((_db, path) => ({ path })),
  getDoc: vi.fn(),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async () => {}),
  arrayUnion: vi.fn((v) => ({ __arrayUnion: v })),
  runTransaction: vi.fn(),
}));
vi.mock('firebase/firestore', () => fs);
vi.mock('./firebase', () => ({ db: {} }));

import { createFolder, renameFolder, deleteFolder, getFolders } from './folderService';

beforeEach(() => vi.clearAllMocks());

describe('folderService', () => {
  it('createFolder arrayUnions a folder onto users/{uid}.folders when the doc exists', async () => {
    fs.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ folders: [] }) });
    const f = await createFolder('u1', 'Designs');
    expect(f.id).toMatch(/^folder-/);
    expect(f.name).toBe('Designs');
    expect(fs.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/u1' }),
      { folders: { __arrayUnion: expect.objectContaining({ name: 'Designs' }) } },
    );
  });
  it('createFolder setDoc(merge) seeds folders when the user doc is missing', async () => {
    fs.getDoc.mockResolvedValueOnce({ exists: () => false, data: () => undefined });
    await createFolder('u1', 'First');
    expect(fs.setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/u1' }),
      { folders: [expect.objectContaining({ name: 'First' })] },
      { merge: true },
    );
  });
  it('renameFolder transaction-updates the matching folder name', async () => {
    fs.runTransaction.mockImplementationOnce(async (_db, fn) => {
      const tx = {
        get: vi.fn(async () => ({ exists: () => true, data: () => ({ folders: [{ id: 'folder-1', name: 'Old', createdOn: 1, updatedOn: 1 }] }) })),
        update: vi.fn(),
      };
      await fn(tx);
      expect(tx.update).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/u1' }), {
        folders: [expect.objectContaining({ id: 'folder-1', name: 'New' })],
      });
    });
    await renameFolder('u1', 'folder-1', 'New');
    expect(fs.runTransaction).toHaveBeenCalledTimes(1);
  });
  it('deleteFolder transaction-filters the folder out (items untouched — CQ-3)', async () => {
    fs.runTransaction.mockImplementationOnce(async (_db, fn) => {
      const tx = {
        get: vi.fn(async () => ({ exists: () => true, data: () => ({ folders: [{ id: 'folder-1', name: 'A' }, { id: 'folder-2', name: 'B' }] }) })),
        update: vi.fn(),
      };
      await fn(tx);
      expect(tx.update).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/u1' }), {
        folders: [expect.objectContaining({ id: 'folder-2' })],
      });
    });
    await deleteFolder('u1', 'folder-1');
  });
  it('getFolders returns the folders array (empty when absent)', async () => {
    fs.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ folders: [{ id: 'folder-1', name: 'A', createdOn: 1, updatedOn: 1 }] }) });
    expect(await getFolders('u1')).toEqual([{ id: 'folder-1', name: 'A', createdOn: 1, updatedOn: 1 }]);
  });
});
```

- [ ] **Step 2: Run** `pnpm -C web test src/services/folderService.test.ts` → FAIL.

- [ ] **Step 3: Implement** `web/src/services/folderService.ts`:
```ts
import { doc, getDoc, setDoc, updateDoc, arrayUnion, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import type { Folder } from '../domain/types';

function userRef(uid: string) {
  return doc(db, `users/${uid}`);
}
function genFolderId(): string {
  const rnd = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `folder-${rnd}`;
}

export async function getFolders(uid: string): Promise<Folder[]> {
  const snap = await getDoc(userRef(uid));
  return (snap.exists() ? ((snap.data() as { folders?: Folder[] }).folders) : undefined) ?? [];
}

export async function createFolder(uid: string, name: string): Promise<Folder> {
  const now = Date.now();
  const folder: Folder = { id: genFolderId(), name, createdOn: now, updatedOn: now };
  const ref = userRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { folders: [folder] }, { merge: true });
  } else {
    await updateDoc(ref, { folders: arrayUnion(folder) });
  }
  return folder;
}

export async function renameFolder(uid: string, folderId: string, name: string): Promise<void> {
  const ref = userRef(uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const folders: Folder[] = (snap.exists() ? (snap.data() as { folders?: Folder[] }).folders : undefined) ?? [];
    const next = folders.map((f) => (f.id === folderId ? { ...f, name, updatedOn: Date.now() } : f));
    tx.update(ref, { folders: next });
  });
}

export async function deleteFolder(uid: string, folderId: string): Promise<void> {
  // CQ-3: only the folder is removed; items keep an orphaned folderId → "Unfiled".
  const ref = userRef(uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const folders: Folder[] = (snap.exists() ? (snap.data() as { folders?: Folder[] }).folders : undefined) ?? [];
    tx.update(ref, { folders: folders.filter((f) => f.id !== folderId) });
  });
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add web/src/services/folderService.ts web/src/services/folderService.test.ts
git commit -m "feat(m03): folderService — folders-array CRUD (arrayUnion + runTransaction) (contract §4.3)"
```

---

### Task 3: itemService — moveToFolder + stopSharing

**Files:** Modify `web/src/services/itemService.ts`, extend `web/src/services/itemService.test.ts`

> `moveToFolder(id, folderId)` re-saves the item with the new `folderId` (cloud merge when signed-in; local always) — reuse `setItem` semantics. `stopSharing(id)` is the client-side owner write (CQ-2): `setDoc(items/{id}, { isShared:false, shareToken: deleteField() }, {merge:true})` when signed-in (a no-op when signed-out — sharing requires sign-in).

- [ ] **Step 1: Extend the test** (append; add `deleteField` to the `fs` hoisted mock as `vi.fn(() => '__DELETE__')`):
```ts
describe('itemService.moveToFolder', () => {
  it('signed-in: re-saves the item with the new folderId (merge)', async () => {
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    await localStore.set('item-1', baseItem({ id: 'item-1' }));
    await svc.moveToFolder('item-1', 'folder-9');
    const [, data] = fs.setDoc.mock.calls.at(-1)!;
    expect(data.folderId).toBe('folder-9');
  });
  it('moveToFolder(null) clears the folderId', async () => {
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    await localStore.set('item-1', baseItem({ id: 'item-1', folderId: 'folder-9' } as Partial<Item>));
    await svc.moveToFolder('item-1', null);
    const local = await localStore.get<any>('item-1', null);
    expect(local.folderId).toBeUndefined();
  });
});

describe('itemService.stopSharing', () => {
  it('signed-in: setDoc(merge) isShared:false + deletes shareToken', async () => {
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    await svc.stopSharing('item-1');
    expect(fs.setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'items/item-1' }),
      { isShared: false, shareToken: '__DELETE__' },
      { merge: true },
    );
  });
  it('signed-out: no cloud write', async () => {
    const svc = makeItemService(() => ({ uid: null, online: true }));
    await svc.stopSharing('item-1');
    expect(fs.setDoc).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — add `deleteField` to the `firebase/firestore` import; add to `makeItemService`:
```ts
  async function moveToFolder(id: string, folderId: string | null): Promise<void> {
    const existing = await localStore.get<Item | null>(id, null);
    if (!existing) return;
    const next: Item = { ...existing };
    if (folderId) (next as Item).folderId = folderId;
    else delete (next as Partial<Item>).folderId;
    await setItem(id, next);  // reuses local-always + cloud-merge + stamping
  }

  async function stopSharing(id: string): Promise<void> {
    const { uid } = getAuth();
    if (!uid) return; // sharing requires sign-in
    await setDoc(doc(db, `items/${id}`), { isShared: false, shareToken: deleteField() }, { merge: true });
  }
```
Add `moveToFolder` and `stopSharing` to the returned object.

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add web/src/services/itemService.ts web/src/services/itemService.test.ts
git commit -m "feat(m03): itemService moveToFolder + client-side stopSharing (CQ-2/CQ-3, REQ-SHR-5)"
```

---

### Task 4: cloudFunctions — createShare

**Files:** Modify `web/src/services/cloudFunctions.ts`, extend `web/src/services/cloudFunctions.test.ts`

> `POST /create-share` with body `{ id, token }` where `token = await getIdToken(true)`. Response `{ page_share, md5 }`; final URL = `page_share + ("?"|"&") + "v=" + md5`. Use MSW. The fresh ID token comes from the M00 `firebase.ts` `getIdToken` (inject it for testability — pass a `getToken` arg or mock the module).

- [ ] **Step 1: Extend the test** `web/src/services/cloudFunctions.test.ts` (append; mock `./firebase` `getIdToken`):
```ts
import { createShare } from './cloudFunctions';
vi.mock('./firebase', () => ({ getIdToken: vi.fn(async () => 'fresh-token') }));

describe('createShare', () => {
  it('POSTs id + fresh token, returns the share URL with the md5 cache-buster appended', async () => {
    server.use(http.post(`${window.location.origin}/create-share`, async ({ request }) => {
      const body = (await request.json()) as { id: string; token: string };
      expect(body.id).toBe('item-1');
      expect(body.token).toBe('fresh-token');
      return HttpResponse.json({ page_share: 'http://localhost?id=item-1&share-token=tok', md5: 'abc123' });
    }));
    const { url, md5 } = await createShare('item-1');
    expect(md5).toBe('abc123');
    expect(url).toBe('http://localhost?id=item-1&share-token=tok&v=abc123');
  });
  it('throws the server error on non-ok', async () => {
    server.use(http.post(`${window.location.origin}/create-share`, () => HttpResponse.json({ error: 'Forbidden' }, { status: 403 })));
    await expect(createShare('item-1')).rejects.toThrow(/Forbidden/);
  });
});
```
(Note: the M02 `getSharedItem` test uses `${window.location.origin}` handler URLs — reuse that convention. The existing `vi.mock('./firebase', …)` may need merging if a prior describe already mocked it; keep a single module mock exposing `getIdToken`.)

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — add to `web/src/services/cloudFunctions.ts`:
```ts
import { getIdToken } from './firebase';

// POST /create-share — body { id, token: freshIdToken }. Item must be SAVED first
// (the function reads items/{id}). Returns the share URL with the md5 cache-buster.
export async function createShare(id: string): Promise<{ url: string; md5: string }> {
  const token = await getIdToken(true);
  const res = await fetch('/create-share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, token }),
  });
  if (!res.ok) {
    let msg = 'Failed to create share link';
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const { page_share, md5 } = (await res.json()) as { page_share: string; md5: string };
  const sep = page_share.includes('?') ? '&' : '?';
  return { url: `${page_share}${sep}v=${md5}`, md5 };
}
```
(Confirm `firebase.ts` exports `getIdToken(forceRefresh?: boolean)`; if its signature differs, adapt the call minimally.)

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add web/src/services/cloudFunctions.ts web/src/services/cloudFunctions.test.ts
git commit -m "feat(m03): createShare cloud-function wrapper (POST /create-share, md5 cache-buster) (contract §5.1, REQ-SHR-1)"
```

---

### Task 5: exportImport — export-all JSON / import JSON (migrate) / standalone HTML

**Files:** Create `web/src/services/exportImport.ts`, Test `web/src/services/exportImport.test.ts`

> Pure functions (no Firestore): `exportAllItemsJson(items)` → JSON string; `parseImportJson(text)` → `Item[]` (accepts the current array/object shapes AND the legacy format — reuse `migrateToPages`); `buildStandaloneHtml(item)` → a self-contained HTML string embedding the diagram DSL (parity with legacy "export HTML"). Saving imported items is done by the caller via `itemService.saveItems`.

- [ ] **Step 1: Failing test** `web/src/services/exportImport.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { exportAllItemsJson, parseImportJson, buildStandaloneHtml } from './exportImport';
import type { Item } from '../domain/types';

const item = (over: Partial<Item> = {}): Item => ({
  id: 'i1', title: 'T', js: 'A.b', css: '', html: '', htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: '', ...over,
});

describe('exportImport', () => {
  it('exportAllItemsJson round-trips through parseImportJson', () => {
    const json = exportAllItemsJson([item({ id: 'a' }), item({ id: 'b' })]);
    const back = parseImportJson(json);
    expect(back.map((i) => i.id).sort()).toEqual(['a', 'b']);
    expect(back[0].pages.length).toBe(1); // migrated
  });
  it('parseImportJson accepts a single object and a {items:{}} map', () => {
    expect(parseImportJson(JSON.stringify(item({ id: 'solo' }))).map((i) => i.id)).toEqual(['solo']);
    expect(parseImportJson(JSON.stringify({ items: { x: item({ id: 'x' }) } })).map((i) => i.id)).toEqual(['x']);
  });
  it('parseImportJson throws on invalid JSON', () => {
    expect(() => parseImportJson('not json')).toThrow();
  });
  it('buildStandaloneHtml embeds the DSL and is a full HTML document', () => {
    const html = buildStandaloneHtml(item({ js: 'Alice->Bob: Hi' }));
    expect(html).toMatch(/<!doctype html>/i);
    expect(html).toContain('Alice-&gt;Bob: Hi'); // DSL is HTML-escaped into the document
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `web/src/services/exportImport.ts`:
```ts
import { migrateToPages } from '../domain/item';
import type { Item } from '../domain/types';

export function exportAllItemsJson(items: Item[]): string {
  return JSON.stringify({ items }, null, 2);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Accepts: Item[] | { items: Item[] } | { items: Record<string,Item> } | a single Item.
// Migrates each through migrateToPages (old-format → pages).
export function parseImportJson(text: string): Item[] {
  const raw = JSON.parse(text); // throws on invalid JSON — intentional
  let list: unknown[];
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === 'object' && 'items' in raw) {
    const items = (raw as { items: unknown }).items;
    list = Array.isArray(items) ? items : Object.values(items as Record<string, unknown>);
  } else list = [raw];
  return list.filter((x): x is Item => !!x && typeof x === 'object').map((it) => migrateToPages(it as Item));
}

// A self-contained HTML doc embedding the diagram DSL (REQ-LIB-8 "standalone HTML").
export function buildStandaloneHtml(item: Item): string {
  const title = escapeHtml(item.title || 'ZenUML Diagram');
  const dsl = escapeHtml(item.js || '');
  const css = item.css || '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>${css}</style>
</head>
<body>
<pre class="zenuml">${dsl}</pre>
<script type="module">
  import ZenUml from 'https://cdn.jsdelivr.net/npm/@zenuml/core/dist/zenuml.js';
  const el = document.querySelector('.zenuml');
  const code = el.textContent;
  el.textContent = '';
  new ZenUml(el).render(code);
</script>
</body>
</html>`;
}
```
(If the legacy "export HTML" used a different embed strategy, prefer parity; the CDN-module approach above is a reasonable standalone default. Confirm `@zenuml/core` exposes a default `ZenUml` class with `.render(code)` — adjust the bootstrap to match the M01 `previewBootstrap` usage if needed.)

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add web/src/services/exportImport.ts web/src/services/exportImport.test.ts
git commit -m "feat(m03): exportImport — JSON export/import (migrate) + standalone HTML (REQ-LIB-8)"
```

---

### Task 6: useFolders hook

**Files:** Create `web/src/hooks/useFolders.ts`, Test `web/src/hooks/useFolders.test.tsx`

> Signed-in: load folders (from `getFolders`, refreshed after CRUD); expose `{ folders, createFolder, renameFolder, deleteFolder, loading }`. Signed-out: `folders=[]`, CRUD are no-ops (require sign-in). Reads uid from `authStore`. Folders aren't streamed by a dedicated listener — refresh after each mutation (and on uid change). Tests mock `../services/folderService` + drive `authStore`.

- [ ] **Step 1: Failing test** `web/src/hooks/useFolders.test.tsx` — mock `../services/folderService` (`getFolders` returns two folders; `createFolder/renameFolder/deleteFolder` resolve); set `authStore` signed-in; assert `folders` populate after mount, `createFolder('X')` calls the service then refreshes, signed-out → empty + CRUD no-op. (renderHook + waitFor.)

- [ ] **Step 2–4:** Implement `useFolders.ts`: `const uid = useAuthStore(s => s.user?.uid ?? null)`; `useEffect([uid])` loads `getFolders(uid)` into state when uid (else `[]`); CRUD actions call the service then re-load; guard signed-out. Return `{ folders, createFolder, renameFolder, deleteFolder, loading }`. Run → PASS.

- [ ] **Step 5: Commit**
```bash
git add web/src/hooks/useFolders.ts web/src/hooks/useFolders.test.tsx
git commit -m "feat(m03): useFolders — folders list + CRUD (sign-in gated) (REQ-LIB-6)"
```

---

### Task 7: useShare hook

**Files:** Create `web/src/hooks/useShare.ts`, Test `web/src/hooks/useShare.test.tsx`

> For the current item: `share()` → ensure the item is SAVED (caller guarantees, or call the injected save first), then `createShare(item.id)` → store `{ url }`; `stop()` → `itemService.stopSharing(item.id)` + clear url. Expose `{ url, sharing, error, share, stop, copy }` where `copy()` writes `url` to the clipboard (`navigator.clipboard.writeText`, guarded). Inject `createShare`, `stopSharing`, and a `getItemId` for testability.

- [ ] **Step 1: Failing test** `web/src/hooks/useShare.test.tsx` — inject fake `createShare` (resolves `{url,md5}`) + `stopSharing`; assert `share()` sets `url`; `stop()` clears it + calls stopSharing; `copy()` calls a mocked `navigator.clipboard.writeText`; error path sets `error`. (renderHook + act.)

- [ ] **Step 2–4:** Implement `useShare({ getItemId, createShare, stopSharing, onBeforeShare? })`: `share` → `await onBeforeShare?.()` (save) then `createShare(getItemId())`; manage `sharing`/`error`/`url`. Run → PASS.

- [ ] **Step 5: Commit**
```bash
git add web/src/hooks/useShare.ts web/src/hooks/useShare.test.tsx
git commit -m "feat(m03): useShare — create/stop/copy share link for current item (REQ-SHR-1/2/5)"
```

---

### Task 8: libraryStore (search / active folder / sort) + ui primitives (Popover, SearchInput)

**Files:** Create `web/src/state/libraryStore.ts` (+test), `web/src/ui/Popover.tsx`, `web/src/ui/SearchInput.tsx`; modify `web/src/ui/index.ts`

> `libraryStore`: `{ query, activeFolderId: string|null|'unfiled', sort: 'updated'|'title', setQuery, setActiveFolder, setSort }`. Add the two design-system primitives.

- [ ] **Step 1:** TDD `libraryStore` (Zustand) — set/get query, activeFolder, sort defaults (`query:''`, `activeFolderId:null` = all, `sort:'updated'`).
- [ ] **Step 2:** Add `web/src/ui/Popover.tsx` wrapping `@radix-ui/react-popover` (install if missing: `pnpm -C web add --ignore-workspace @radix-ui/react-popover`) — `Popover`, `PopoverTrigger`, `PopoverContent` (paper surface `bg-paper-50 border border-paper-line rounded-lg shadow-pop p-3 animate-pop-in`, portal, `sideOffset=8 align="end"`). Add `web/src/ui/SearchInput.tsx` (design-system `TextInput`-style with a leading search glyph + a clear button; `data-testid` overridable). Export both from `web/src/ui/index.ts`.
- [ ] **Step 3:** Run unit tests + typecheck → green. Commit:
```bash
git add web/src/state/libraryStore.ts web/src/state/libraryStore.test.ts web/src/ui/Popover.tsx web/src/ui/SearchInput.tsx web/src/ui/index.ts
git commit -m "feat(m03): library UI state + Popover/SearchInput design-system primitives"
```

---

### Task 9: LibraryItemRow (open / fork / delete / move-to-folder)

**Files:** Create `web/src/components/library/LibraryItemRow.tsx`, Test `…/LibraryItemRow.test.tsx`

> DESIGN SYSTEM. Presentational row: title (`font-sans`), `updatedOn` + folder name (`font-mono text-ondark-faint`), row click → `onOpen(item)`. A `Menu` (kebab `IconButton`, aria-label "Item actions") with: Open, Fork, Move to folder ▸ (submenu/select of `folders` + "Unfiled"), Export HTML, Delete (→ ConfirmDialog). Props: `{ item, folders, onOpen, onFork, onDelete, onMove(item, folderId|null), onExportHtml(item) }`. `data-testid`s: `lib-row-${id}`, `lib-row-menu-${id}`, `lib-action-open/fork/delete/exporthtml-${id}`, `lib-move-${id}-${folderId|unfiled}`.

- [ ] **Steps:** TDD (RTL): row renders title + meta; row click → onOpen; menu opens → each action calls the right injected handler with the right args; delete routes through ConfirmDialog (open→confirm→onDelete; row click NOT fired). Keep design-system tokens. Commit:
```bash
git commit -m "feat(m03): LibraryItemRow — open/fork/delete/move/export actions (REQ-LIB-4)"
```

---

### Task 10: FolderList (folder groups + Unfiled + folder CRUD)

**Files:** Create `web/src/components/library/FolderList.tsx`, Test `…/FolderList.test.tsx`

> DESIGN SYSTEM. Presentational: renders the folder list + an "Unfiled" entry + an "All" entry; clicking selects (`onSelectFolder(id|null|'unfiled')`, active marked with `accent`). A "New folder" `IconButton` (aria-label) → inline `TextInput` → `onCreate(name)`. Per-folder rename (double-click → inline `TextInput` → `onRename(id, name)`) + delete (`IconButton` → ConfirmDialog "Delete folder? Items move to Unfiled." → `onDelete(id)`). Props: `{ folders, activeFolderId, counts: Record<string|'unfiled'|'all', number>, onSelectFolder, onCreate, onRename, onDelete, readOnly }` (readOnly = signed-out → CRUD hidden). `data-testid`s: `folder-all`, `folder-unfiled`, `folder-${id}`, `folder-new`, `folder-rename-${id}`, `folder-delete-${id}`.

- [ ] **Steps:** TDD each behavior (RTL) incl. signed-out hides CRUD; folder counts shown in `font-mono`. Commit:
```bash
git commit -m "feat(m03): FolderList — folder groups, Unfiled, folder CRUD (REQ-LIB-3/6)"
```

---

### Task 11: ImportExportBar + per-item standalone HTML download

**Files:** Create `web/src/components/library/ImportExportBar.tsx`, Test `…/ImportExportBar.test.tsx`

> DESIGN SYSTEM. Export-all (`Button` → `onExportAll()` which builds the JSON blob + triggers a download) and Import (`Button` → hidden `<input type="file" accept="application/json">` → reads the file text → `onImport(text)`). Keep components presentational: the actual blob/download + file-read can live in small injected callbacks OR a tiny `download(filename, text)` util in this file (jsdom-safe: guard `URL.createObjectURL`). `data-testid`s: `lib-export-all`, `lib-import`, `lib-import-input`.

- [ ] **Steps:** TDD: clicking export-all calls `onExportAll`; selecting a file calls `onImport` with the file's text (use a `File`/`FileReader` stub or fire a change with `files`). Commit:
```bash
git commit -m "feat(m03): ImportExportBar — export-all JSON + import JSON (REQ-LIB-8)"
```

---

### Task 12: LibraryPanel (compose: search + folders + rows + import/export) — replaces ItemListStub

**Files:** Create `web/src/components/library/LibraryPanel.tsx`, Test `…/LibraryPanel.test.tsx`; delete `web/src/components/library/ItemListStub.tsx` (+ its test) in Task 14 wiring

> DESIGN SYSTEM, on **ink**. Composes `SearchInput` (→ `libraryStore.query`), `FolderList`, `ImportExportBar`, and the filtered/sorted `LibraryItemRow` list. Filtering (client-side, in memory): by `activeFolderId` (null=all; 'unfiled' = items whose `folderId` is absent OR not in `folders` — the CQ-3 existence check), then by `query` (case-insensitive match on title OR `js`), then sort by `sort`. Shows a total count (REQ-LIB-1) in `font-mono`. Empty state on `.bg-blueprint` + `font-serif`. Keyboard operability (REQ-LIB-5): roving focus over rows, Enter opens. Props: `{ items, folders, onOpen, onFork, onDelete, onMove, onExportAll, onImport, onExportHtml, onCreateFolder, onRenameFolder, onDeleteFolder, readOnly }`.

- [ ] **Steps:** TDD: filter-by-folder (incl. Unfiled existence check), search filter (title + dsl), sort, count display, keyboard open (ArrowDown+Enter), empty state. Wire the sub-components. Commit:
```bash
git commit -m "feat(m03): LibraryPanel — search + folders + actions + import/export (REQ-LIB-1..8)"
```

---

### Task 13: Share UI — ShareButton + SharePopover + ShareErrorNotice

**Files:** Create `web/src/components/share/ShareButton.tsx`, `web/src/components/share/SharePopover.tsx`, `web/src/components/modals/ShareErrorNotice.tsx`; Tests

> DESIGN SYSTEM. `ShareButton` (header, `Button`/`IconButton`, `data-testid="share-button"`, disabled for read-only/unsaved-new) opens `SharePopover` (`Popover` on paper): a "Create share link" `Button variant="primary"` → `onShare()`; once `url` exists, show it in a read-only `TextInput` + a Copy `Button` (`onCopy()`) + a "Stop sharing" `Button variant="danger"` (`onStop()`); show `error` text on failure. `ShareErrorNotice` (Dialog) shows REQ-SHR-4 message when a shared link fails to load, with a "Start fresh" action (`newItem`). `data-testid`s: `share-button`, `share-create`, `share-url`, `share-copy`, `share-stop`, `share-error`.

- [ ] **Steps:** TDD each (RTL; Popover/Dialog in portals — open then query). ShareButton disabled when `readOnly` or item is a never-saved new item. Commit:
```bash
git commit -m "feat(m03): share UI — button, popover (create/copy/stop), error notice (REQ-SHR-1..5)"
```

---

### Task 14: Wire library + share into AppRoot (replace ItemListStub; boot share-error; fork-from-shared)

**Files:** Modify `web/src/app/AppRoot.tsx`; delete `web/src/components/library/ItemListStub.tsx` + `ItemListStub.test.tsx`

> Replace the M02 `ItemListStub` in the `activePanel==='library'` slot with `<LibraryPanel>` fed by `useItems`, `useFolders`, `libraryStore`, and handlers: open → `loadItem(migrateToPages(item))` + switch panel; fork → `loadItem` then `forkCurrent`; delete → `removeItem` + `unsetItemForUser`; move → `itemService.moveToFolder`; export-all → build via `exportAllItemsJson` + download; import → `parseImportJson` + `itemService.saveItems` (+ membership for signed-in); export-html → `buildStandaloneHtml` + download; folder CRUD → `useFolders`. Add `<ShareButton>` to `AppHeader` (pass through props or render in AppRoot's header row), wired to `useShare` ({ getItemId: currentItem.id, createShare, stopSharing, onBeforeShare: save }). On boot, when a shared-link load FAILS (the M02 boot `getSharedItem` error path), show `<ShareErrorNotice>` (REQ-SHR-4) instead of silently going to a new item; when a shared read-only item is open, the header `Fork` already creates an editable copy (REQ-SHR-3 — verify it clears `isReadOnly`).

- [ ] **Step 1:** Update `useBootItem` (or AppRoot's boot handling) so a shared-link failure surfaces a flag AppRoot renders as `ShareErrorNotice` (don't just fall back to `new` silently for the shared branch). Keep the M02 decision table otherwise.
- [ ] **Step 2:** Wire all handlers; ensure fork-from-shared produces an owned, editable (`isReadOnly` cleared) copy via `forkCurrent` (confirm `forkCurrent` strips `isReadOnly` — if not, clear it there or in the fork handler).
- [ ] **Step 3:** Run FULL `pnpm -C web test` + `pnpm -C web typecheck` → green; delete the stub + its test (Library replaces it). Commit:
```bash
git commit -m "feat(m03): wire LibraryPanel + ShareButton into AppRoot; boot share-error; fork-from-shared (REQ-LIB, REQ-SHR)"
```

---

### Task 15: E2E — library search/folders + share-link round-trip (where feasible offline)

**Files:** Create/extend `e2e/tests/library.spec.js` (repo root)

> Signed-out/local E2E for what doesn't need the emulator: the Library panel renders the local items, **search** filters them, the **import** flow adds items (JSON paste/file), **export-all** triggers a download (assert the download event / blob), and a **standalone-HTML export** produces a document. Folder CRUD + create-share need auth/emulator → note them as deferred to the staging gate (same as M02's auth note). Reuse the M02 spec patterns; webServer already points at `pnpm -C web dev`.

- [ ] **Step 1:** Spec: open Library panel (sidebar `LIBRARY`), seed a couple of local items (type DSL + save while signed-out, or `header-new` + save), assert they appear; type in `SearchInput` → list filters; trigger export-all → assert a download starts (`page.waitForEvent('download')`); import a small JSON → assert a new row appears. Header-note the auth-gated parts deferred to staging.
- [ ] **Step 2:** Run `pnpm exec playwright test library --project=chromium` → green; keep M01/M02 specs green.
- [ ] **Step 3:** Full gate: `pnpm -C web typecheck && pnpm -C web test` green; `pnpm exec playwright test --project=chromium` green. Commit:
```bash
git commit -m "test(m03): E2E — library list/search/import/export (local, signed-out)"
```

---

### Task 16: Adversarial review of M03 surfaces

**Files:** none (review + fix)

- [ ] **Step 1:** Dispatch independent reviewers (parallel) against ground truth (legacy `src/services/folderService.js`, `src/itemService.js`, `src/services/syncService.js`, `src/components/app.jsx`, contract §4.3/§5.1/§5.2) over:
  1. `folderService.ts` — EXACT array-CRUD shapes: `arrayUnion` create vs `setDoc(merge)` seed, `runTransaction` rename/delete, folder-delete leaves items untouched (CQ-3), id format. Sign-in gating.
  2. `cloudFunctions.createShare` + `useShare` + `itemService.stopSharing` — fresh `getIdToken(true)` in BODY, item-must-be-saved-first, md5 cache-buster URL, 403/404 handling, stop-sharing client write (isShared:false + token drop), token rotation on next share.
  3. `exportImport` + LibraryPanel filtering — old-format import migration, the Unfiled existence-check grouping (orphaned folderId), search case-insensitivity over title+dsl, move-to-folder round-trip, no imageBase64 in export.
  4. Cross-cutting: NFR-3 (no window.* integration), design-system compliance (no gray-*/hex in new components), Radix portal/testid collisions across the now-many dialogs/popovers, subscription/listener leaks, signed-out gating of folder/share actions.
- [ ] **Step 2:** Triage; fix real findings with discriminating regression tests (revert→fail). Record deferrals in roadmap §9.
- [ ] **Step 3:** Commit fixes (one per fix, message references the review).

---

## Self-Review (completed during authoring)

**Spec coverage:** REQ-LIB-1 (browse + count) → Task 12. REQ-LIB-2 (search title+dsl) → 12. REQ-LIB-3 (folders + Unfiled) → 10/12. REQ-LIB-4 (open/fork/delete/move) → 9/14. REQ-LIB-5 (keyboard) → 12. REQ-LIB-6 (folders CRUD, sign-in) → 2/6/10. REQ-LIB-7 (live list) → reuses M02 `useItems`/`subscribeAllItems`. REQ-LIB-8 (import/export/standalone HTML) → 5/11/14. REQ-SHR-1 (create link + md5) → 4/7/13. REQ-SHR-2 (panel/copy) → 13. REQ-SHR-3 (open shared read-only + fork) → reuses M02 boot + 14. REQ-SHR-4 (share error) → 13/14. REQ-SHR-5 (stop sharing) → 3/7/13. Contract §4.3 folders, §5.1 create-share, §5.2 get-shared-item → 2/4. Deferred (settings/subscription/analytics/modals → M04; extension/embed/cutover → M05) recorded in §9 (Task 1).

**Placeholders:** services + store + hook tasks (2–8) carry full code/tests; the UI-heavy tasks (9–14) specify exact components, props, data-testids, and TDD targets without dumping every line (acceptable for presentational components — each names its tests + testids). No "TBD".

**Type consistency:** reuses canonical `Item`/`Folder`/`Settings`/`AppUser`; service signatures extend M02 (`makeItemService` gains `moveToFolder`/`stopSharing`; `cloudFunctions` gains `createShare`). Folder ops match the contract (arrayUnion/runTransaction). `stopSharing` uses `deleteField()` (added to the firestore import). Library filtering uses the CQ-3 existence check for Unfiled.

---

## Done when

- [ ] `pnpm -C web typecheck`, `pnpm -C web test` green; `pnpm exec playwright test --project=chromium` green (incl. the new library spec + M01/M02 specs).
- [ ] Signed-in: browse/search saved diagrams with a count; folders CRUD (arrayUnion + transaction); item open/fork/delete/move-to-folder; live list; import/export JSON + standalone HTML; create/copy/stop share link (fresh token, md5 buster); open shared read-only + fork to own.
- [ ] Signed-out: library lists local items + search + import/export work; folder/share controls are hidden/disabled (sign-in gated).
- [ ] Folder delete leaves item docs untouched (orphaned folderId → Unfiled). No backend asset changed; legacy `src/` untouched.
- [ ] All new UI uses the Drafting Table design system (no gray-*/hex). `ItemListStub` removed.
- [ ] Adversarial review (Task 16) complete; real findings fixed with regression tests; deferrals in roadmap §9.
- [ ] All work committed in small steps; a milestone screenshot delivered.
