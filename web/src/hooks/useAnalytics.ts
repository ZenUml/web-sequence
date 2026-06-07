import { useCallback, useEffect, useRef } from 'react';
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

  // Page-view fires EXACTLY ONCE per mount (legacy parity: app.jsx fires
  // trackPageView() once in componentDidMount, independent of auth state). The
  // effect must NOT depend on `track` — `track` re-memoizes when userId resolves
  // (null → 'u1'), which would re-run the effect and emit a second, duplicate
  // pageView (and a third on logout). We read `track` via a ref so the latest
  // bound context is used, but the effect itself runs only on mount.
  const trackRef = useRef(track);
  trackRef.current = track;
  const firedPageView = useRef(false);
  useEffect(() => {
    if (firedPageView.current) return;
    firedPageView.current = true;
    // Preserve the legacy pageView property envelope (REQ-ANL-1: emit the existing
    // events under the same conditions). Legacy trackPageView (src/analytics.js:24-34)
    // POSTed {event:'pageView', category:'navigation', label:pageName} to /track, and
    // its sole call site `trackPageView()` (app.jsx:695) passes no arg → pageName
    // defaults to null. Dropping category='navigation' would silently break any
    // Mixpanel report that filters pageView by that category. label is null to match
    // legacy exactly — we do NOT invent a page-name value legacy never sent.
    trackRef.current('pageView', { category: 'navigation', label: null });
  }, []);

  return { track };
}
