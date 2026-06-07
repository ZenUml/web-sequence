import { useCallback, useEffect } from 'react';
import { emit } from '../services/analytics';
import { useAuthStore } from '../state/authStore';
import { detectFromEnv } from '../app/runtimeMode';

// Reads debug from window.DEBUG (set by legacy bootstrap from the `wmdebug` cookie)
// OR directly from the cookie, so it works before/independently of that bootstrap.
function isDebug(): boolean {
  if (typeof window !== 'undefined' && (window as { DEBUG?: boolean }).DEBUG) return true;
  return typeof document !== 'undefined' && document.cookie.indexOf('wmdebug') > -1;
}

export interface UseAnalyticsResult {
  track(event: string, props?: Record<string, unknown>): void;
}

/**
 * Binds analytics.emit to the current context: userId from authStore (null when
 * signed-out), debug from window.DEBUG / wmdebug cookie, isExtension from
 * runtimeMode. Fires a single `pageView` on mount.
 */
export function useAnalytics(): UseAnalyticsResult {
  const userId = useAuthStore((s) => s.user?.uid ?? null);

  const track = useCallback(
    (event: string, props: Record<string, unknown> = {}) => {
      emit(event, props, {
        userId,
        debug: isDebug(),
        isExtension: detectFromEnv().isExtension,
      });
    },
    [userId],
  );

  // Page-view on mount. Depends on `track` (which depends on userId) so the
  // page-view carries the resolved userId once auth settles.
  useEffect(() => {
    track('pageView');
  }, [track]);

  return { track };
}
