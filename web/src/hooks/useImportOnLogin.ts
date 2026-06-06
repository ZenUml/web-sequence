import { useState, useEffect, useRef } from 'react';
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
  // In-flight guard: the modal stays open during the async import (driven solely by
  // `pending`), and the Import button is not disabled, so a fast double-click can
  // re-enter doImport → two concurrent saveItems batches + localStore writes. A ref
  // (not state) gives a synchronous gate that the second click sees immediately
  // (adversarial review).
  const importing = useRef(false);

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
    if (importing.current) return;
    importing.current = true;
    try {
      const ids = await localItems.list();
      const map: Record<string, Item> = {};
      for (const id of ids) {
        const item = await localStore.get<Item | null>(id, null);
        if (item) map[id] = item;
      }
      await saveItems(map);
      await localStore.set(LS_KEYS.askedToImportCreations, true);
      setPending(false);
    } finally {
      importing.current = false;
    }
  }

  async function dismiss() {
    await localStore.set(LS_KEYS.askedToImportCreations, true);
    setPending(false);
  }

  return { pending, count, doImport, dismiss };
}
