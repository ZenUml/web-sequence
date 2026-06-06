import { useEffect, useMemo, useState } from 'react';
import { makeItemService } from '../services/itemService';
import * as localItems from '../services/localItems';
import { localStore } from '../services/storage';
import { useAuthStore } from '../state/authStore';
import type { Item } from '../domain/types';

function sortDescByUpdatedOn(items: Item[]): Item[] {
  return [...items].sort((a, b) => (b.updatedOn ?? 0) - (a.updatedOn ?? 0));
}

export function useItems(): { items: Item[]; loading: boolean } {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const uid = useAuthStore((s) => s.user?.uid ?? null);

  const svc = useMemo(
    () =>
      makeItemService(() => ({
        uid: useAuthStore.getState().user?.uid ?? null,
        online: useAuthStore.getState().online,
      })),
    [],
  );

  useEffect(() => {
    if (uid) {
      // Signed-in: use Firestore onSnapshot subscription.
      const unsub = svc.subscribeAllItems(uid, (incoming) => {
        setItems(sortDescByUpdatedOn(incoming));
        setLoading(false);
      });
      return unsub;
    } else {
      // Signed-out: load from the local storage index, and re-load on every local
      // write (create/delete/move) so the list is reactive without a remount. The
      // signed-in branch gets this for free from Firestore onSnapshot; the local
      // branch needs an explicit same-tab subscription (adversarial review).
      let cancelled = false;
      async function load() {
        const ids = await localItems.list();
        const settled = await Promise.all(ids.map((id) => localStore.get<Item | null>(id, null)));
        const owned = settled.filter((it): it is Item => it !== null);
        if (!cancelled) {
          setItems(sortDescByUpdatedOn(owned));
          setLoading(false);
        }
      }
      void load();
      const unsub = localItems.subscribe(() => { void load(); });
      return () => { cancelled = true; unsub(); };
    }
  }, [uid, svc]);

  return { items, loading };
}
