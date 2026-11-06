import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAuthStore } from './authStore';
import type { SaveItemsGuard } from '../services/identityGuard';

// One primitive for "drop this async result if the identity changed while it was in
// flight" (#867). A token snapshots the uid and the scope's generation when the work
// begins. The generation moves on:
// - any uid change, including A → B → A (so a token from the first A is stale),
// - unmount of the owning component,
// - a change in the caller's `invalidateOn` deps (e.g. the open item),
// - an explicit invalidate() call.
// isCurrent(token) is true only for the same generation, while mounted, with the
// token's uid still the live uid.
export interface OperationToken {
  readonly uid: string | null;
  readonly generation: number;
}

export interface OperationScope {
  /** Snapshot the live uid (or an explicit owner, e.g. the uid a callback rendered with). */
  begin(owner?: string | null): OperationToken;
  isCurrent(token: OperationToken): boolean;
  /** Adapter for itemService.saveItems / setItem. */
  guard(token: OperationToken): SaveItemsGuard;
  /** Make every outstanding token stale now (e.g. a caller-driven reload). */
  invalidate(): void;
}

const liveUid = () => useAuthStore.getState().user?.uid ?? null;

export function useOperationScope({ invalidateOn = [] }: { invalidateOn?: unknown[] } = {}): OperationScope {
  const generation = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = useAuthStore.subscribe((next, previous) => {
      if ((next.user?.uid ?? null) !== (previous.user?.uid ?? null)) generation.current += 1;
    });
    return () => {
      mounted.current = false;
      generation.current += 1;
      unsubscribe();
    };
  }, []);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    generation.current += 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller's deps ARE the trigger
  }, invalidateOn);

  const begin = useCallback(
    (owner?: string | null): OperationToken => ({
      uid: owner === undefined ? liveUid() : owner,
      generation: generation.current,
    }),
    [],
  );
  const isCurrent = useCallback(
    (token: OperationToken) => mounted.current && generation.current === token.generation && liveUid() === token.uid,
    [],
  );
  const guard = useCallback(
    (token: OperationToken): SaveItemsGuard => ({ expectedUid: token.uid, isCurrent: () => isCurrent(token) }),
    [isCurrent],
  );
  const invalidate = useCallback(() => {
    generation.current += 1;
  }, []);
  return useMemo(() => ({ begin, isCurrent, guard, invalidate }), [begin, isCurrent, guard, invalidate]);
}
