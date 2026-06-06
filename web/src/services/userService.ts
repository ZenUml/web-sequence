import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from './firebase';
import type { Settings } from '../domain/types';

interface UserDoc {
  items?: Record<string, true>;
  settings?: Partial<Settings>;
  [k: string]: unknown;
}

// FIX 6: memoize ensureUser per uid so repeated calls within a session skip getDoc/setDoc.
// Only added to the Set after a successful ensure (so a thrown getDoc is retried next call).
// Exported for test teardown only — do not call in production code.
export const _ensuredUids = new Set<string>();

export async function ensureUser(uid: string): Promise<UserDoc> {
  if (_ensuredUids.has(uid)) return {};
  const ref = doc(db, `users/${uid}`);
  const snap = await getDoc(ref);
  let result: UserDoc;
  if (!snap.exists()) {
    await setDoc(ref, {}, { merge: true });
    result = {};
  } else {
    result = (snap.data() as UserDoc) ?? {};
  }
  _ensuredUids.add(uid);
  return result;
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
