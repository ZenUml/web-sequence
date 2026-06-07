import { useEffect, useState } from 'react';

/**
 * SSR/jsdom-safe media query hook.
 *
 * Reads `window.matchMedia(query).matches` and subscribes to its `change`
 * event. When `window.matchMedia` is unavailable (SSR, jsdom without a polyfill)
 * the initial read returns `false` and the effect no-ops — it never throws.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(query);
    // Sync immediately in case `query` changed since the initial render.
    setMatches(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** True below the Tailwind `md` breakpoint (viewport ≤ 767px). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
