import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
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
    if (!uid) { await localItems.add(id); return; }

    const withMeta: Item = { ...migrateToPages(clean as Item), createdBy: uid, updatedOn: Date.now() };
    delete (withMeta as any).imageBase64;
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
    if (!uid) { await localStore.remove(id); await localItems.remove(id); return; }
    await deleteDoc(doc(db, `items/${id}`));
  }

  return { setItem, saveLastCode, getItem, removeItem };
}

export type ItemService = ReturnType<typeof makeItemService>;
