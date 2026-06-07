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
