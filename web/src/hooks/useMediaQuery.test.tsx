import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery, useIsMobile } from './useMediaQuery';

type ChangeListener = (event: MediaQueryListEvent) => void;

/**
 * Build a MediaQueryList-like mock plus a `fire` helper that dispatches a
 * synthetic `change` event to every registered listener.
 */
function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<ChangeListener>();
  let matches = initialMatches;

  const mql = {
    get matches() {
      return matches;
    },
    media: '',
    onchange: null,
    addEventListener: vi.fn((_type: string, cb: ChangeListener) => {
      listeners.add(cb);
    }),
    removeEventListener: vi.fn((_type: string, cb: ChangeListener) => {
      listeners.delete(cb);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  const matchMedia = vi.fn((q: string) => {
    mql.media = q;
    return mql as unknown as MediaQueryList;
  });

  const fire = (next: boolean) => {
    matches = next;
    listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent));
  };

  return { matchMedia, mql, fire, listeners };
}

afterEach(() => {
  vi.restoreAllMocks();
  // Reset matchMedia between tests so an "absent" test doesn't leak.
  // @ts-expect-error - deliberately clearing the optional global.
  delete window.matchMedia;
});

describe('useMediaQuery', () => {
  it('returns the initial match from matchMedia', () => {
    const { matchMedia } = mockMatchMedia(true);
    window.matchMedia = matchMedia;

    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));

    expect(result.current).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
  });

  it('returns false initially when the query does not match', () => {
    const { matchMedia } = mockMatchMedia(false);
    window.matchMedia = matchMedia;

    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));

    expect(result.current).toBe(false);
  });

  it('updates when a change event fires', () => {
    const { matchMedia, fire } = mockMatchMedia(false);
    window.matchMedia = matchMedia;

    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(result.current).toBe(false);

    act(() => fire(true));
    expect(result.current).toBe(true);

    act(() => fire(false));
    expect(result.current).toBe(false);
  });

  it('removes its change listener on unmount', () => {
    const { matchMedia, mql, listeners } = mockMatchMedia(false);
    window.matchMedia = matchMedia;

    const { unmount } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(listeners.size).toBe(1);

    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(listeners.size).toBe(0);
  });

  it('no-ops safely (returns false, does not throw) when matchMedia is absent', () => {
    // window.matchMedia is deleted by the afterEach of the previous test / not set here.
    expect(window.matchMedia).toBeUndefined();

    let result: { current: boolean } | undefined;
    expect(() => {
      ({ result } = renderHook(() => useMediaQuery('(max-width: 767px)')));
    }).not.toThrow();

    expect(result!.current).toBe(false);
  });

  it('re-subscribes when the query string changes', () => {
    const { matchMedia } = mockMatchMedia(false);
    window.matchMedia = matchMedia;

    const { rerender } = renderHook(({ q }) => useMediaQuery(q), {
      initialProps: { q: '(max-width: 767px)' },
    });
    expect(matchMedia).toHaveBeenLastCalledWith('(max-width: 767px)');

    rerender({ q: '(min-width: 1024px)' });
    expect(matchMedia).toHaveBeenLastCalledWith('(min-width: 1024px)');
  });
});

describe('useIsMobile', () => {
  it('queries the Tailwind md boundary (max-width: 767px)', () => {
    const { matchMedia } = mockMatchMedia(true);
    window.matchMedia = matchMedia;

    const { result } = renderHook(() => useIsMobile());

    expect(matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
    expect(result.current).toBe(true);
  });

  it('returns false when matchMedia is absent', () => {
    expect(window.matchMedia).toBeUndefined();
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
