import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the framework-agnostic analytics module (Task 5). useAnalytics binds the
// current userId/debug/isExtension context to its emit().
const an = vi.hoisted(() => ({ emit: vi.fn() }));
vi.mock('../services/analytics', () => ({ emit: an.emit }));

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
      debug: false,
      isExtension: false,
    });
  });

  it('carries userId:null when signed-out', () => {
    const { result } = renderHook(() => useAnalytics());
    act(() => result.current.track('x', { a: 1 }));
    expect(an.emit).toHaveBeenCalledWith('x', { a: 1 }, {
      userId: null,
      debug: false,
      isExtension: false,
    });
  });

  it('fires a pageView on mount carrying the current userId', () => {
    useAuthStore.setState({ user: { uid: 'u9' }, online: true, authReady: true });
    renderHook(() => useAnalytics());
    expect(an.emit).toHaveBeenCalledWith('pageView', {}, {
      userId: 'u9',
      debug: false,
      isExtension: false,
    });
  });

  // Discriminating (REQ-ANL-1 single-fire parity): pageView must fire EXACTLY ONCE
  // even across the auth-resolution transition (mount signed-out → user resolves).
  // The bug fired it twice: once on mount (userId:null) and again when `track`
  // re-memoized after userId became 'u1'. This test re-renders to cross that
  // transition; reverting the ref-guard fix makes pageView fire twice → fails.
  it('fires pageView exactly once across the auth-resolution transition', () => {
    // Mount signed-out, then resolve auth and re-render (the real boot sequence).
    const { rerender } = renderHook(() => useAnalytics());
    act(() => {
      useAuthStore.setState({ user: { uid: 'u1' }, online: true, authReady: true });
    });
    rerender();
    const pageViews = an.emit.mock.calls.filter((c) => c[0] === 'pageView');
    expect(pageViews).toHaveLength(1);
    // And it carries the context bound at mount time (signed-out → null), matching
    // legacy's mount-time fire that does not wait for auth.
    expect(pageViews[0][2]).toEqual({ userId: null, debug: false, isExtension: false });
  });

  it('routes through debug context when the wmdebug cookie is set', () => {
    document.cookie = 'wmdebug=1; path=/';
    const { result } = renderHook(() => useAnalytics());
    act(() => result.current.track('x', { a: 1 }));
    expect(an.emit).toHaveBeenCalledWith('x', { a: 1 }, {
      userId: null,
      debug: true,
      isExtension: false,
    });
  });
});
