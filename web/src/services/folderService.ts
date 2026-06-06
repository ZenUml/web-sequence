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
