import { useEffect, useState, useCallback, useRef } from 'react';
import { getFolders, createFolder as svcCreate, renameFolder as svcRename, deleteFolder as svcDelete } from '../services/folderService';
import { useAuthStore } from '../state/authStore';
import { useOperationScope, type OperationToken } from '../state/operationScope';
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
  // Tokens bind the uid this render saw: a callback still closing over an old uid
  // must not write into the new account's state.
  const { begin, isCurrent } = useOperationScope();
  const request = useRef(0);
  const read = useCallback(async (token: OperationToken, refresh = false) => {
    const owner = token.uid as string;
    const attempt = ++request.current;
    setState(s => ({ owner, folders: s.owner === owner ? s.folders : [], loading: true, error: null }));
    try {
      const folders = await getFolders(owner);
      if (isCurrent(token) && attempt === request.current) setState({ owner, folders, loading: false, error: null });
    } catch {
      if (isCurrent(token) && attempt === request.current) setState(s => ({ ...s, loading: false, error: refresh ? "Couldn't refresh folders. Your change was saved. Try again." : "Couldn't load folders. Try again." }));
    }
  }, [isCurrent]);
  useEffect(() => {
    if (uid) void read(begin(uid));
    else { request.current += 1; setState({ owner: null, folders: [], loading: false, error: null }); }
  }, [uid, read, begin]);
  const retry = useCallback(async () => { if (uid) await read(begin(uid)); }, [uid, read, begin]);
  const createFolder = useCallback(async (name: string) => {
    if (!uid) return;
    const token = begin(uid);
    const folder = await svcCreate(uid, name);
    if (!isCurrent(token)) return;
    if (folder) setState(s => ({ ...s, folders: [...s.folders.filter(f => f.id !== folder.id), folder] }));
    // The write succeeded. A refresh failure is a read error, so a retry must never create again.
    await read(token, true);
  }, [uid, begin, isCurrent, read]);
  const renameFolder = useCallback(async (id: string, name: string) => {
    if (!uid) return;
    const token = begin(uid);
    await svcRename(uid, id, name);
    if (!isCurrent(token)) return;
    setState(s => ({ ...s, folders: s.folders.map(f => f.id === id ? { ...f, name } : f) }));
    await read(token, true);
  }, [uid, begin, isCurrent, read]);
  const deleteFolder = useCallback(async (id: string) => {
    if (!uid) return;
    const token = begin(uid);
    await svcDelete(uid, id);
    if (!isCurrent(token)) return;
    setState(s => ({ ...s, folders: s.folders.filter(f => f.id !== id) }));
    await read(token, true);
  }, [uid, begin, isCurrent, read]);
  return { folders: state.owner === uid ? state.folders : [], loading: state.owner === uid ? state.loading : !!uid, error: state.owner === uid ? state.error : null, retry, createFolder, renameFolder, deleteFolder };
}
