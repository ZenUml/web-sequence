import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the framework-agnostic analytics module (Task 5). useAnalytics binds the
// current userId/debug/isExtension context to its emit().
const an = vi.hoisted(() => ({ emit: vi.fn() }));
vi.mock('../services/analytics', () => ({ emit: an.emit }));
vi.mock('../services/anonId', () => ({ getAnonId: () => 'anon-test' }));

import { useAnalytics } from './useAnalytics';
import { useAuthStore } from '../state/authStore';

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, online: true, authReady: false });
  // Ensure non-debug, non-extension by default.
  (window as { DEBUG?: boolean }).DEBUG = false;
  document.cookie = 'wmdebug=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

describe('useAnalytics', () => {
  it('track() forwards event + props with the signed-in userId in the bound context', () => {
    useAuthStore.setState({ user: { uid: 'u1' }, online: true, authReady: true });
    const { result } = renderHook(() => useAnalytics());
    act(() => result.current.track('x', { a: 1 }));
    expect(an.emit).toHaveBeenCalledWith('x', { a: 1 }, {
      userId: 'u1',
      anonId: 'anon-test',
      debug: false,
      isExtension: false,
    });
  });

  it('carries userId:null when signed-out', () => {
    const { result } = renderHook(() => useAnalytics());
    act(() => result.current.track('x', { a: 1 }));
    expect(an.emit).toHaveBeenCalledWith('x', { a: 1 }, {
      userId: null,
      anonId: 'anon-test',
      debug: false,
      isExtension: false,
    });
  });

  it('fires app_opened on mount carrying the current userId', () => {
    useAuthStore.setState({ user: { uid: 'u9' }, online: true, authReady: true });
    renderHook(() => useAnalytics());
    expect(an.emit).toHaveBeenCalledWith(
      'app_opened',
      { category: 'navigation', label: null },
      { userId: 'u9', anonId: 'anon-test', debug: false, isExtension: false },
    );
  });

  // Discriminating (REQ-ANL-1 envelope parity): legacy trackPageView POSTed
  // {category:'navigation', label:null} to /track (src/analytics.js:24-34, called
  // with no arg at app.jsx:695). The mount-time pageView must carry that exact
  // envelope, not empty props. Reverting the fix (back to trackRef.current('app_opened'))
  // makes the props arg `{}` → this assertion fails.
  it('mount pageView carries the legacy category/label envelope', () => {
    renderHook(() => useAnalytics());
    const pageView = an.emit.mock.calls.find((c) => c[0] === 'app_opened');
    expect(pageView).toBeDefined();
    expect(pageView![1]).toEqual({ category: 'navigation', label: null });
  });

  // Discriminating (REQ-ANL-1 single-fire parity): pageView must fire EXACTLY ONCE
  // even across the auth-resolution transition (mount signed-out → user resolves).
  // The bug fired it twice: once on mount (userId:null) and again when `track`
  // re-memoized after userId became 'u1'. This test re-renders to cross that
  // transition; reverting the ref-guard fix makes pageView fire twice → fails.
  it('fires app_opened exactly once across the auth-resolution transition', () => {
    // Mount signed-out, then resolve auth and re-render (the real boot sequence).
    const { rerender } = renderHook(() => useAnalytics());
    act(() => {
      useAuthStore.setState({ user: { uid: 'u1' }, online: true, authReady: true });
    });
    rerender();
    const pageViews = an.emit.mock.calls.filter((c) => c[0] === 'app_opened');
    expect(pageViews).toHaveLength(1);
    // And it carries the context bound at mount time (signed-out → null), matching
    // legacy's mount-time fire that does not wait for auth.
    expect(pageViews[0][2]).toEqual({ userId: null, anonId: 'anon-test', debug: false, isExtension: false });
    // ...with the legacy property envelope intact.
    expect(pageViews[0][1]).toEqual({ category: 'navigation', label: null });
  });

  it('routes through debug context when the wmdebug cookie is set', () => {
    document.cookie = 'wmdebug=1; path=/';
    const { result } = renderHook(() => useAnalytics());
    act(() => result.current.track('x', { a: 1 }));
    expect(an.emit).toHaveBeenCalledWith('x', { a: 1 }, {
      userId: null,
      anonId: 'anon-test',
      debug: true,
      isExtension: false,
    });
  });
});
