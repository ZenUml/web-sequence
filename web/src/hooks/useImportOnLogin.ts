import { useState, useEffect } from 'react';
import { useAuthStore } from '../state/authStore';
import { localStore } from '../services/storage';
import * as localItems from '../services/localItems';
import { LS_KEYS } from '../config/constants';
import type { Item } from '../domain/types';

export function useImportOnLogin(
  saveItems: (items: Record<string, Item>) => Promise<void>,
) {
  const user = useAuthStore((s) => s.user);
  const uid = user?.uid ?? null;

  const [pending, setPending] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) return;

    let cancelled = false;

    async function check() {
      const alreadyAsked = await localStore.get<boolean>(LS_KEYS.askedToImportCreations, false);
      if (alreadyAsked) return;

      const ids = await localItems.list();
      if (cancelled) return;
      if (ids.length > 0) {
        setPending(true);
        setCount(ids.length);
      }
    }

    void check();

    return () => { cancelled = true; };
  }, [uid]);

  async function doImport() {
    const ids = await localItems.list();
    const map: Record<string, Item> = {};
    for (const id of ids) {
      const item = await localStore.get<Item | null>(id, null);
      if (item) map[id] = item;
    }
    await saveItems(map);
    await localStore.set(LS_KEYS.askedToImportCreations, true);
    setPending(false);
  }

  async function dismiss() {
    await localStore.set(LS_KEYS.askedToImportCreations, true);
    setPending(false);
  }

  return { pending, count, doImport, dismiss };
}
