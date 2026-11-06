import { useCallback, useEffect, useState } from 'react';
import { retrieveSubscription } from '../services/subscriptionService';
import { useAuthStore } from '../state/authStore';
import { useOperationScope } from '../state/operationScope';
import { getPlanType, isSubscribed } from '../domain/plan';
import type { PlanType, Subscription } from '../domain/types';

interface UseSubscription {
  subscription: Subscription | null;
  planType: PlanType;
  subscribed: boolean;
  loading: boolean;
  loadFailed: boolean;
  reload: () => void;
  retryFailedLoad: (expectedUid: string) => Promise<Subscription | null>;
}

// Loads the signed-in user's subscription and derives plan state. The `loading`
// flag is LOAD-BEARING for the Task 16 save-seam race guard (roadmap §9): it must
// be true for the WHOLE window where a uid is present but its subscription read has
// not resolved FOR THAT uid — covering both a uid present at mount AND the in-session
// sign-in transition (uid null -> 'u1').
//
// We derive `loading` from `loadedForUid` (the uid the current `subscription` belongs
// to) rather than a mount-only initializer: `loading = uid !== null && loadedForUid !== uid`.
// On the null->uid edge this is true on the VERY FIRST render (loadedForUid still lags),
// closing the one-render gap a mount-only initializer would leave. Signed-out
// (uid === null) -> loading=false immediately ('free' is the final answer, not transient).
export function useSubscription(): UseSubscription {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  // The uid that `subscription` was loaded for (null = nothing loaded yet). A bump
  // counter lets reload() force a re-read even when uid is unchanged.
  const [loadedForUid, setLoadedForUid] = useState<string | null>(null);
  const [failedForUid, setFailedForUid] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // A new uid, a reload or unmount makes every in-flight read stale.
  const { begin, isCurrent, invalidate } = useOperationScope({ invalidateOn: [uid, reloadTick] });

  const loading = uid !== null && loadedForUid !== uid;

  useEffect(() => {
    if (uid === null) {
      // Signed out — clear synchronously; nothing to load.
      setSubscription(null);
      setLoadedForUid(null);
      setFailedForUid(null);
      return;
    }
    const token = begin(uid);
    void (async () => {
      let sub: Subscription | null = null;
      let failed = false;
      try {
        sub = await retrieveSubscription(uid);
      } catch {
        failed = true;
      } finally {
        if (isCurrent(token)) {
          setSubscription(sub);
          setFailedForUid(failed ? uid : null);
          setLoadedForUid(uid);
        }
      }
    })();
  }, [uid, reloadTick, begin, isCurrent]);

  // reload() re-reports loading (resets loadedForUid) then re-reads — used after a
  // successful Paddle checkout to pick up the new subscription.
  const reload = useCallback(() => {
    invalidate();
    setLoadedForUid(null);
    setFailedForUid(null);
    setReloadTick((t) => t + 1);
  }, [invalidate]);

  // Import retries need the verified result in the same attempt. Returning it
  // avoids using a stale render's free fallback after the retry resolves.
  const retryFailedLoad = useCallback(async (expectedUid: string): Promise<Subscription | null> => {
    const token = begin(expectedUid);
    if (!isCurrent(token)) throw new Error('Account changed');
    try {
      const result = await retrieveSubscription(expectedUid);
      if (!isCurrent(token)) throw new Error('Account changed');
      setSubscription(result);
      setFailedForUid(null);
      setLoadedForUid(expectedUid);
      return result;
    } catch (error) {
      if (isCurrent(token)) setFailedForUid(expectedUid);
      throw error;
    }
  }, [begin, isCurrent]);

  return {
    subscription,
    planType: getPlanType(subscription),
    subscribed: isSubscribed(subscription),
    loading,
    loadFailed: uid !== null && loadedForUid === uid && failedForUid === uid,
    reload,
    retryFailedLoad,
  };
}
