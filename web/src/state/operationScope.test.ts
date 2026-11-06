import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOperationScope } from './operationScope';
import { useAuthStore } from './authStore';

const signIn = (uid: string) => useAuthStore.setState({ user: { uid, email: `${uid}@example.test` } });

beforeEach(() => {
  useAuthStore.setState({ user: null, online: true, authReady: true });
});

describe('useOperationScope', () => {
  it('a fresh token is current and snapshots the live uid', () => {
    signIn('A');
    const { result } = renderHook(() => useOperationScope());
    const t = result.current.begin();
    expect(t.uid).toBe('A');
    expect(result.current.isCurrent(t)).toBe(true);
  });

  it('a uid change invalidates the token', () => {
    signIn('A');
    const { result } = renderHook(() => useOperationScope());
    const t = result.current.begin();
    act(() => signIn('B'));
    expect(result.current.isCurrent(t)).toBe(false);
  });

  it('A → B → A still invalidates the token (generation, not just uid)', () => {
    signIn('A');
    const { result } = renderHook(() => useOperationScope());
    const t = result.current.begin();
    act(() => signIn('B'));
    act(() => signIn('A'));
    expect(result.current.isCurrent(t)).toBe(false);
    expect(result.current.isCurrent(result.current.begin())).toBe(true);
  });

  it('signed out → signed in invalidates a signed-out token', () => {
    const { result } = renderHook(() => useOperationScope());
    const t = result.current.begin();
    expect(t.uid).toBeNull();
    act(() => signIn('A'));
    expect(result.current.isCurrent(t)).toBe(false);
  });

  it('auth updates that keep the same uid do not invalidate', () => {
    signIn('A');
    const { result } = renderHook(() => useOperationScope());
    const t = result.current.begin();
    act(() => useAuthStore.setState({ online: false }));
    act(() => signIn('A'));
    expect(result.current.isCurrent(t)).toBe(true);
  });

  it('unmount invalidates every token', () => {
    signIn('A');
    const { result, unmount } = renderHook(() => useOperationScope());
    const t = result.current.begin();
    const { isCurrent } = result.current;
    unmount();
    expect(isCurrent(t)).toBe(false);
  });

  it('a change in invalidateOn invalidates; the first render does not', () => {
    signIn('A');
    const { result, rerender } = renderHook(({ item }) => useOperationScope({ invalidateOn: [item] }), {
      initialProps: { item: 'i1' },
    });
    const t = result.current.begin();
    rerender({ item: 'i1' });
    expect(result.current.isCurrent(t)).toBe(true);
    rerender({ item: 'i2' });
    expect(result.current.isCurrent(t)).toBe(false);
  });

  it('concurrent tokens from the same generation share its fate', () => {
    signIn('A');
    const { result } = renderHook(() => useOperationScope());
    const t1 = result.current.begin();
    const t2 = result.current.begin();
    expect(result.current.isCurrent(t1) && result.current.isCurrent(t2)).toBe(true);
    act(() => signIn('B'));
    const t3 = result.current.begin();
    expect([result.current.isCurrent(t1), result.current.isCurrent(t2), result.current.isCurrent(t3)]).toEqual([false, false, true]);
  });

  it('begin(owner) binds an explicit uid: a token for a uid that is no longer live is not current', () => {
    signIn('B');
    const { result } = renderHook(() => useOperationScope());
    // e.g. a callback still closing over the previously rendered uid 'A'
    const t = result.current.begin('A');
    expect(result.current.isCurrent(t)).toBe(false);
  });

  it('invalidate() makes every outstanding token stale; later tokens are current', () => {
    signIn('A');
    const { result } = renderHook(() => useOperationScope());
    const t = result.current.begin();
    result.current.invalidate();
    expect(result.current.isCurrent(t)).toBe(false);
    expect(result.current.isCurrent(result.current.begin())).toBe(true);
  });

  it('guard(token) adapts to SaveItemsGuard', () => {
    signIn('A');
    const { result } = renderHook(() => useOperationScope());
    const t = result.current.begin();
    const g = result.current.guard(t);
    expect(g.expectedUid).toBe('A');
    expect(g.isCurrent?.()).toBe(true);
    act(() => signIn('B'));
    expect(g.isCurrent?.()).toBe(false);
  });

  it('returns stable functions across renders', () => {
    signIn('A');
    const { result, rerender } = renderHook(() => useOperationScope());
    const first = result.current;
    rerender();
    expect(result.current.begin).toBe(first.begin);
    expect(result.current.isCurrent).toBe(first.isCurrent);
    expect(result.current.guard).toBe(first.guard);
    expect(result.current.invalidate).toBe(first.invalidate);
  });
});
