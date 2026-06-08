import { useCallback, useEffect, useState } from 'react';
import { retrieveSubscription } from '../services/subscriptionService';
import { useAuthStore } from '../state/authStore';
import { getPlanType, isSubscribed } from '../domain/plan';
import type { PlanType, Subscription } from '../domain/types';

interface UseSubscription {
  subscription: Subscription | null;
  planType: PlanType;
  subscribed: boolean;
  loading: boolean;
  reload: () => void;
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
  const [reloadTick, setReloadTick] = useState(0);

  const loading = uid !== null && loadedForUid !== uid;

  useEffect(() => {
    if (uid === null) {
      // Signed out — clear synchronously; nothing to load.
      setSubscription(null);
      setLoadedForUid(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      let sub: Subscription | null = null;
      try {
        sub = await retrieveSubscription(uid);
      } catch {
        sub = null;
      } finally {
        if (!cancelled) {
          setSubscription(sub);
          setLoadedForUid(uid);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, reloadTick]);

  // reload() re-reports loading (resets loadedForUid) then re-reads — used after a
  // successful Paddle checkout to pick up the new subscription.
  const reload = useCallback(() => {
    setLoadedForUid(null);
    setReloadTick((t) => t + 1);
  }, []);

  return {
    subscription,
    planType: getPlanType(subscription),
    subscribed: isSubscribed(subscription),
    loading,
    reload,
  };
}
