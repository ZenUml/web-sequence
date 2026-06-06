import { useEffect, useState, useCallback } from 'react';
import { getFolders, createFolder as svcCreate, renameFolder as svcRename, deleteFolder as svcDelete } from '../services/folderService';
import { useAuthStore } from '../state/authStore';
import type { Folder } from '../domain/types';

export interface UseFoldersResult {
  folders: Folder[];
  loading: boolean;
  createFolder(name: string): Promise<void>;
  renameFolder(id: string, name: string): Promise<void>;
  deleteFolder(id: string): Promise<void>;
}

export function useFolders(): UseFoldersResult {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  const uid = useAuthStore((s) => s.user?.uid ?? null);

  useEffect(() => {
    let cancelled = false;

    if (uid) {
      setLoading(true);
      getFolders(uid).then((result) => {
        if (!cancelled) {
          setFolders(result);
          setLoading(false);
        }
      });
    } else {
      setFolders([]);
      setLoading(false);
    }

    return () => { cancelled = true; };
  }, [uid]);

  const reload = useCallback(async (currentUid: string) => {
    const result = await getFolders(currentUid);
    // Stale-uid guard: a folder mutation captures the uid it started under. If the
    // user signed out (or switched accounts) while the create+reload round-trip was
    // in flight, applying this result would leak the prior user's folders into the
    // new session. Only apply when the live uid still matches (advisor fix #9).
    if (useAuthStore.getState().user?.uid === currentUid) {
      setFolders(result);
    }
  }, []);

  const createFolder = useCallback(async (name: string): Promise<void> => {
    if (!uid) return;
    await svcCreate(uid, name);
    await reload(uid);
  }, [uid, reload]);

  const renameFolder = useCallback(async (id: string, name: string): Promise<void> => {
    if (!uid) return;
    await svcRename(uid, id, name);
    await reload(uid);
  }, [uid, reload]);

  const deleteFolder = useCallback(async (id: string): Promise<void> => {
    if (!uid) return;
    await svcDelete(uid, id);
    await reload(uid);
  }, [uid, reload]);

  return { folders, loading, createFolder, renameFolder, deleteFolder };
}
