import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from './firebase';
import type { Folder, Settings } from '../domain/types';

// This module owns the users/{uid} document: its path, its shape, and how the
// "this user owns this diagram" membership is written. Other services import
// userRef / membershipPatch instead of building the path themselves.
export interface UserDoc {
  items?: Record<string, true>;
  settings?: Partial<Settings>;
  folders?: Folder[];
  [k: string]: unknown;
}

export function userRef(uid: string) {
  return doc(db, `users/${uid}`);
}

// Membership as a nested map, for set(..., { merge: true }) writers (single and
// batch). merge creates the user doc when it is missing, so a membership write
// never depends on ensureUser having run first (it runs fire-and-forget on login).
export function membershipPatch(itemId: string): Pick<UserDoc, 'items'> {
  return { items: { [itemId]: true } };
}

// FIX 6: memoize ensureUser per uid so repeated calls within a session skip getDoc/setDoc.
// Only added to the Set after a successful ensure (so a thrown getDoc is retried next call).
// Exported for test teardown only — do not call in production code.
export const _ensuredUids = new Set<string>();

export async function ensureUser(uid: string): Promise<UserDoc> {
  if (_ensuredUids.has(uid)) return {};
  const ref = userRef(uid);
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
  const snap = await getDoc(userRef(uid));
  const items = (snap.exists() ? (snap.data() as UserDoc).items : undefined) ?? {};
  return Object.keys(items);
}

export async function setItemForUser(uid: string, itemId: string): Promise<void> {
  await setDoc(userRef(uid), membershipPatch(itemId), { merge: true });
}

export async function unsetItemForUser(uid: string, itemId: string): Promise<void> {
  await updateDoc(userRef(uid), { [`items.${itemId}`]: deleteField() });
}

export async function getUserSettings(uid: string): Promise<Partial<Settings>> {
  const snap = await getDoc(userRef(uid));
  return (snap.exists() ? (snap.data() as UserDoc).settings : undefined) ?? {};
}

// Persist a single owned setting key (M04 settings UI calls this).
export async function setUserSetting<K extends keyof Settings>(uid: string, key: K, value: Settings[K]): Promise<void> {
  await updateDoc(userRef(uid), { [`settings.${key}`]: value });
}
