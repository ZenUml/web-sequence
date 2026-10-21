import { useEffect, useState, useCallback, useRef } from 'react';
import { getFolders, createFolder as svcCreate, renameFolder as svcRename, deleteFolder as svcDelete } from '../services/folderService';
import { useAuthStore } from '../state/authStore';
import type { Folder } from '../domain/types';

export interface UseFoldersResult {
  folders: Folder[];
  loading: boolean;
  error: string | null;
  retry(): Promise<void>;
  createFolder(name: string): Promise<void>;
  renameFolder(id: string, name: string): Promise<void>;
  deleteFolder(id: string): Promise<void>;
}

export function useFolders(): UseFoldersResult {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const [state, setState] = useState<{ owner: string | null; folders: Folder[]; loading: boolean; error: string | null }>({ owner: uid, folders: [], loading: !!uid, error: null });
  const generation = useRef(0);
  const mounted = useRef(true);
  const request = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = useAuthStore.subscribe((next, previous) => {
      if (next.user?.uid !== previous.user?.uid) generation.current += 1;
    });
    return () => { mounted.current = false; generation.current += 1; unsubscribe(); };
  }, []);
  const current = useCallback((owner: string, gen: number) => mounted.current && generation.current === gen && useAuthStore.getState().user?.uid === owner, []);
  const read = useCallback(async (owner: string, gen: number, refresh = false) => {
    const attempt = ++request.current;
    setState(s => ({ owner, folders: s.owner === owner ? s.folders : [], loading: true, error: null }));
    try {
      const folders = await getFolders(owner);
      if (current(owner, gen) && attempt === request.current) setState({ owner, folders, loading: false, error: null });
    } catch {
      if (current(owner, gen) && attempt === request.current) setState(s => ({ ...s, loading: false, error: refresh ? "Couldn't refresh folders. Your change was saved. Try again." : "Couldn't load folders. Try again." }));
    }
  }, [current]);
  useEffect(() => {
    if (uid) void read(uid, generation.current);
    else { request.current += 1; setState({ owner: null, folders: [], loading: false, error: null }); }
  }, [uid, read]);
  const retry = useCallback(async () => { if (uid) await read(uid, generation.current); }, [uid, read]);
  const createFolder = useCallback(async (name: string) => {
    if (!uid) return;
    const gen = generation.current;
    const folder = await svcCreate(uid, name);
    if (!current(uid, gen)) return;
    if (folder) setState(s => ({ ...s, folders: [...s.folders.filter(f => f.id !== folder.id), folder] }));
    // The write succeeded. A refresh failure is a read error, so a retry must never create again.
    await read(uid, gen, true);
  }, [uid, current, read]);
  const renameFolder = useCallback(async (id: string, name: string) => {
    if (!uid) return;
    const gen = generation.current;
    await svcRename(uid, id, name);
    if (!current(uid, gen)) return;
    setState(s => ({ ...s, folders: s.folders.map(f => f.id === id ? { ...f, name } : f) }));
    await read(uid, gen, true);
  }, [uid, current, read]);
  const deleteFolder = useCallback(async (id: string) => {
    if (!uid) return;
    const gen = generation.current;
    await svcDelete(uid, id);
    if (!current(uid, gen)) return;
    setState(s => ({ ...s, folders: s.folders.filter(f => f.id !== id) }));
    await read(uid, gen, true);
  }, [uid, current, read]);
  return { folders: state.owner === uid ? state.folders : [], loading: state.owner === uid ? state.loading : !!uid, error: state.owner === uid ? state.error : null, retry, createFolder, renameFolder, deleteFolder };
}
