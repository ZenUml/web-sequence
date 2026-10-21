import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { makeItemService } from '../services/itemService';
import * as localItems from '../services/localItems';
import { localStore } from '../services/storage';
import { useAuthStore } from '../state/authStore';
import type { Item } from '../domain/types';

function sortDescByUpdatedOn(items: Item[]): Item[] {
  return [...items].sort((a, b) => (b.updatedOn ?? 0) - (a.updatedOn ?? 0));
}

export interface ItemsState {
  items: Item[];
  loading: boolean;
  // Read provenance (IE-F2). `owner` is the identity whose read produced this state
  // (uid, or null for the signed-out local library); undefined before any read
  // settled. `error` is set when that read FAILED: `items` is then [] for display
  // only and is NOT a known-empty library. Only a successful read (error null) for
  // the current uid is authoritative.
  owner: string | null | undefined;
  error: unknown;
  // Load attempt that produced this state; increases on every (re)subscription.
  attempt: number;
  // Re-subscribes for the current identity and returns the attempt id to wait for.
  retry(): number;
}

interface ReadState {
  items: Item[];
  loading: boolean;
  owner: string | null | undefined;
  error: unknown;
  attempt: number;
}

export function useItems(): ItemsState {
  const [state, setState] = useState<ReadState>({
    items: [],
    loading: true,
    owner: undefined,
    error: null,
    attempt: 0,
  });
  const [retryNonce, setRetryNonce] = useState(0);
  const attempts = useRef(0);

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
    const attempt = (attempts.current += 1);
    if (uid) {
      // Signed-in: use Firestore onSnapshot subscription. A snapshot error keeps its
      // provenance instead of looking like an empty library.
      const unsub = svc.subscribeAllItems(
        uid,
        (incoming) => {
          setState({ items: sortDescByUpdatedOn(incoming), loading: false, owner: uid, error: null, attempt });
        },
        (error) => {
          setState({ items: [], loading: false, owner: uid, error: error ?? new Error('Library read failed'), attempt });
        },
      );
      return unsub;
    } else {
      // Signed-out: load from the local storage index, and re-load on every local
      // write (create/delete/move) so the list is reactive without a remount. The
      // signed-in branch gets this for free from Firestore onSnapshot; the local
      // branch needs an explicit same-tab subscription (adversarial review).
      let cancelled = false;
      async function load() {
        try {
          const ids = await localItems.list();
          const settled = await Promise.all(ids.map((id) => localStore.get<Item | null>(id, null)));
          const owned = settled.filter((it): it is Item => it !== null);
          if (!cancelled) {
            setState({ items: sortDescByUpdatedOn(owned), loading: false, owner: null, error: null, attempt });
          }
        } catch (error) {
          if (!cancelled) {
            setState({ items: [], loading: false, owner: null, error: error ?? new Error('Library read failed'), attempt });
          }
        }
      }
      void load();
      const unsub = localItems.subscribe(() => { void load(); });
      return () => { cancelled = true; unsub(); };
    }
  }, [uid, svc, retryNonce]);

  const retry = useCallback(() => {
    setRetryNonce((n) => n + 1);
    return attempts.current + 1;
  }, []);

  return { ...state, retry };
}
