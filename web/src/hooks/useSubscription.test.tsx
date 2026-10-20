import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const svc = vi.hoisted(() => ({ retrieveSubscription: vi.fn() }));
vi.mock('../services/subscriptionService', () => svc);

import { useSubscription } from './useSubscription';
import { useAuthStore } from '../state/authStore';
import type { AppUser, Subscription } from '../domain/types';

const PLUS: Subscription = {
  status: 'active',
  passthrough: '{"planType":"plus-monthly"}',
};

function signIn(uid: string) {
  useAuthStore.getState().setUser({ uid } as AppUser);
}
function signOut() {
  useAuthStore.getState().setUser(null);
}

// A controllable promise: resolve it manually to drive the loading window.
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  signOut();
});

describe('useSubscription', () => {
  it('loads + derives plan for a signed-in uid (plus -> subscribed)', async () => {
    svc.retrieveSubscription.mockResolvedValue(PLUS);
    signIn('u1');
    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.subscription).toEqual(PLUS));
    expect(result.current.planType).toBe('plus-monthly');
    expect(result.current.subscribed).toBe(true);
    expect(svc.retrieveSubscription).toHaveBeenCalledWith('u1');
  });

  it('signed-out -> null subscription, free plan, loading=false (no spurious in-flight)', async () => {
    const { result } = renderHook(() => useSubscription());
    expect(result.current.subscription).toBeNull();
    expect(result.current.planType).toBe('free');
    expect(result.current.subscribed).toBe(false);
    expect(result.current.loading).toBe(false);
    // Never read a subscription when signed out.
    expect(svc.retrieveSubscription).not.toHaveBeenCalled();
  });

  it('reload() re-invokes the service', async () => {
    svc.retrieveSubscription.mockResolvedValue(PLUS);
    signIn('u1');
    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.subscription).toEqual(PLUS));
    expect(svc.retrieveSubscription).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.reload();
    });
    await waitFor(() =>
      expect(svc.retrieveSubscription).toHaveBeenCalledTimes(2),
    );
  });

  it('keeps a failed read distinct from a legitimate free account and retries to the verified plan', async () => {
    svc.retrieveSubscription.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(PLUS);
    signIn('u1');
    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.planType).toBe('free');

    let retried: Subscription | null = null;
    await act(async () => { retried = await result.current.retryFailedLoad('u1'); });
    expect(retried).toEqual(PLUS);
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.planType).toBe('plus-monthly');
    expect(svc.retrieveSubscription).toHaveBeenCalledTimes(2);
  });

  it('does not apply a failed old-account retry to the next account', async () => {
    const oldRetry = deferred<Subscription | null>();
    svc.retrieveSubscription.mockRejectedValueOnce(new Error('offline'))
      .mockReturnValueOnce(oldRetry.promise).mockResolvedValueOnce(null);
    signIn('u1');
    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    const retry = result.current.retryFailedLoad('u1').catch((error: unknown) => error);
    await act(async () => { signIn('u2'); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { oldRetry.resolve(PLUS); });
    expect(await retry).toEqual(new Error('Account changed'));
    expect(result.current.subscription).toBeNull();
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.planType).toBe('free');
  });

  // (i) mount-with-uid: loading is true on the first render before the read settles.
  it('mount-with-uid: loading=true until the read settles, then false', async () => {
    const d = deferred<Subscription | null>();
    svc.retrieveSubscription.mockReturnValue(d.promise);
    signIn('u1');

    const { result } = renderHook(() => useSubscription());
    // First render, promise unresolved: a uid is present but its sub is unknown.
    expect(result.current.loading).toBe(true);
    expect(result.current.subscription).toBeNull();

    await act(async () => {
      d.resolve(PLUS);
      await d.promise;
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subscription).toEqual(PLUS);
  });

  // (ii) in-session sign-in (null -> uid): loading must be true on the VERY NEXT
  // render, with NO one-render `false` gap. This FAILS for a mount-only initializer.
  it('in-session sign-in (null -> uid): loading flips true with no false gap', async () => {
    const d = deferred<Subscription | null>();
    svc.retrieveSubscription.mockReturnValue(d.promise);

    // Mount signed-out: loading is false (nothing to load).
    const { result } = renderHook(() => useSubscription());
    expect(result.current.loading).toBe(false);

    // Sign in while the read is still unresolved.
    await act(async () => {
      signIn('u1');
    });
    // On the very next render loading is true — NOT a transient false. A mount-only
    // initializer would report false here (the gap that re-opens the popup-sign-in race).
    expect(result.current.loading).toBe(true);
    expect(result.current.subscription).toBeNull();

    await act(async () => {
      d.resolve(PLUS);
      await d.promise;
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subscription).toEqual(PLUS);
    expect(result.current.subscribed).toBe(true);
  });
});
