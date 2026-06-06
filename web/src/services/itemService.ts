import { doc, getDoc, setDoc, deleteDoc, deleteField, collection, query, where, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { localStore } from './storage';
import * as localItems from './localItems';
import { migrateToPages } from '../domain/item';
import type { Item } from '../domain/types';

export interface AuthContext { uid: string | null; online: boolean }
export type AuthContextGetter = () => AuthContext;

// Factory so tests/hooks inject the auth/online context instead of reading globals
// (NFR-3: no window.* as the integration mechanism).
export function makeItemService(getAuth: AuthContextGetter) {
  async function setItem(id: string, item: Item): Promise<void> {
    // imageBase64 can blow the localStorage quota — never persist it.
    const clean: any = { ...item };
    delete clean.imageBase64;

    // Local write always (sync, fast feedback). The `code` slot is handled by saveLastCode.
    await localStore.set(id, clean);

    const { uid, online } = getAuth();
    // Signed-out: keep the local index in sync (mirrors users/{uid}.items) so the
    // signed-out list + import-on-login can find this item (advisor fix).
    // Signal the signed-out list to refresh. Fire even when add() is a no-op (an
    // existing id) so move-to-folder — which routes here via moveToFolder and never
    // changes the index — still re-renders the list (adversarial review).
    if (!uid) { await localItems.add(id); localItems.notifyChange(); return; }

    const withMeta: Item = { ...migrateToPages(clean as Item), createdBy: uid, updatedOn: Date.now() };
    delete (withMeta as any).imageBase64;
    // Sharing fields are backend-owned (create_share sets; stopSharing clears).
    // Never let a normal save re-assert a stale isShared/shareToken (advisor fix).
    delete (withMeta as any).isShared;
    delete (withMeta as any).shareToken;
    delete (withMeta as any).sharedAt;
    const ref = doc(db, `items/${id}`);
    const cloud = setDoc(ref, withMeta, { merge: true });
    // Online: await so callers see the result. Offline: don't block — Firestore's
    // persistent cache queues the write and syncs on reconnect (CQ-5 multi-tab cache).
    if (online) await cloud; else void cloud.catch(() => {});
  }

  // Never goes to cloud — local `code` slot for last-code restore (REQ-PST).
  function saveLastCode(item: Item): void {
    const clean: any = { ...item };
    delete clean.imageBase64;
    void localStore.set('code', clean);
  }

  async function getItem(id: string): Promise<Item> {
    const { uid } = getAuth();
    // Signed-out: read the local copy; never hit Firestore (the ownership check
    // below would always throw with a null uid) (advisor fix).
    if (!uid) {
      const local = await localStore.get<Item | null>(id, null);
      if (!local) throw new Error('Item not found');
      return migrateToPages(local);
    }
    const snap = await getDoc(doc(db, `items/${id}`));
    if (!snap.exists()) throw new Error('Item not found');
    const item = snap.data() as Item;
    if (item.createdBy !== uid) throw new Error('Unauthorized access to item');
    return migrateToPages(item);
  }

  async function removeItem(id: string): Promise<void> {
    const { uid } = getAuth();
    if (!uid) { await localStore.remove(id); await localItems.remove(id); localItems.notifyChange(); return; }
    await deleteDoc(doc(db, `items/${id}`));
  }

  function subscribeAllItems(uid: string, cb: (items: Item[]) => void): () => void {
    const q = query(collection(db, 'items'), where('createdBy', '==', uid));
    return onSnapshot(q, (snap: any) => {
      const items: Item[] = [];
      snap.forEach((d: any) => items.push(d.data() as Item));
      cb(items);
    }, () => cb([]));
  }

  async function saveItems(items: Record<string, Item>): Promise<void> {
    const { uid } = getAuth();
    const entries = Object.entries(items);
    if (!uid) {
      for (const [id, it] of entries) {
        const c = { ...it }; delete (c as any).imageBase64;
        await localStore.set(id, c);
        await localItems.add(id);
      }
      localItems.notifyChange();
      return;
    }
    const batch = writeBatch(db);
    for (const [id, it] of entries) {
      const data: Item = { ...migrateToPages(it), createdBy: uid, updatedOn: it.updatedOn ?? Date.now() };
      delete (data as any).imageBase64;
      // Sharing fields are backend-owned (contract §3.1: written by create_share,
      // never by client). An imported JSON export can carry a stale isShared/shareToken;
      // writing it would resurrect a public share the backend never minted for this
      // owner. Strip for parity with setItem (advisor fix).
      delete (data as any).isShared;
      delete (data as any).shareToken;
      delete (data as any).sharedAt;
      // set(merge:true), NOT plain set: a re-import of one's own export (same ids)
      // must not REPLACE the cloud doc. Plain set + the sharing-field strip above would
      // wipe a live public share (and any cloud-only field absent from the export).
      // merge:true makes the strip mean "don't re-assert" rather than "delete", matching
      // setItem's contract and the comment's stated safety rationale (adversarial review).
      // set(merge:true), NOT plain set: a re-import of one's own export (same ids)
      // must not REPLACE the cloud doc. Plain set + the sharing-field strip above would
      // wipe a live public share (and any cloud-only field absent from the export).
      // merge:true makes the strip mean "don't re-assert" rather than "delete", matching
      // setItem's contract and the comment's stated safety rationale (adversarial review).
      batch.set(doc(db, `items/${id}`), data, { merge: true });
      // Use set(merge:true), NOT update(): Firestore's batch update() requires the
      // target doc to already exist and aborts the WHOLE batch if it doesn't.
      // users/{uid} is created fire-and-forget on login (useAuth.ensureUser, unawaited);
      // a freshly-signed-in user importing immediately can race ahead of that write and
      // silently lose the entire import. set(merge:true) creates-or-merges the user doc
      // so the import is robust regardless of ordering (adversarial review).
      batch.set(doc(db, `users/${uid}`), { items: { [id]: true } }, { merge: true });
    }
    await batch.commit();
  }

  async function moveToFolder(item: Item, folderId: string | null): Promise<void> {
    // Take the held Item (from useItems) — do NOT re-fetch from localStore, which
    // is empty for cloud-only items delivered by onSnapshot (advisor fix).
    //
    // Clearing the folder (move to Unfiled / out of any folder) MUST write an
    // explicit `null`, not `delete next.folderId`. setItem writes the cloud doc via
    // setDoc(merge:true): with merge, an ABSENT key is NOT a deletion — Firestore
    // retains the stale folderId, so onSnapshot re-delivers it and the item snaps
    // back into its old folder. Writing null persists through merge and the grouping
    // treats null as falsy → Unfiled (mirrors legacy LibraryPanel.jsx:136). We use
    // explicit null rather than deleteField() because setItem persists the local copy
    // first (a deleteField sentinel would leak into localStore as a FieldValue object).
    const next: Item = { ...item, folderId };
    await setItem(next.id, next);
  }

  async function stopSharing(id: string): Promise<void> {
    const { uid } = getAuth();
    if (!uid) return; // sharing requires sign-in
    await setDoc(doc(db, `items/${id}`), { isShared: false, shareToken: deleteField() }, { merge: true });
  }

  return { setItem, saveLastCode, getItem, removeItem, subscribeAllItems, saveItems, moveToFolder, stopSharing };
}

export type ItemService = ReturnType<typeof makeItemService>;
