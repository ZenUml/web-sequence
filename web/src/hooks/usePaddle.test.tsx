import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { AppConfig } from '../config/firebaseConfig';

// Distinct sentinel product IDs so "plus-monthly resolves PlusMonthly, not
// BasicMonthly" is actually discriminating (asserting against config would be
// tautological).
const testConfig: AppConfig = {
  firebase: {
    apiKey: 'k',
    authDomain: 'd',
    projectId: 'p',
    storageBucket: 's',
    messagingSenderId: 'm',
  },
  paddleProductBasicMonthly: 'PROD-BM',
  paddleProductPlusMonthly: 'PROD-PM',
  paddleProductBasicYearly: 'PROD-BY',
  paddleProductPlusYearly: 'PROD-PY',
  features: { payment: true },
};

function stubPaddle() {
  const Setup = vi.fn();
  const open = vi.fn();
  (window as unknown as { Paddle: unknown }).Paddle = {
    Setup,
    Checkout: { open },
  };
  return { Setup, open };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete (window as unknown as { Paddle?: unknown }).Paddle;
});

describe('usePaddle.openCheckout', () => {
  it('maps plan-monthly to the configured PlusMonthly product id', async () => {
    const { open } = stubPaddle();
    const { usePaddle } = await import('./usePaddle');
    const onSuccess = vi.fn();

    const { result } = renderHook(() => usePaddle(testConfig));
    result.current.openCheckout({
      planType: 'plus-monthly',
      email: 'a@b.c',
      userId: 'u1',
      onSuccess,
    });

    expect(open).toHaveBeenCalledTimes(1);
    const arg = open.mock.calls[0][0];
    expect(arg.product).toBe('PROD-PM');
    expect(arg.email).toBe('a@b.c');
    expect(arg.passthrough).toBe(JSON.stringify({ userId: 'u1', planType: 'plus-monthly' }));
    expect(arg.successCallback).toBe(onSuccess);
  });

  it('resolves the correct product id for every purchasable plan', async () => {
    const { open } = stubPaddle();
    const { usePaddle } = await import('./usePaddle');
    const { result } = renderHook(() => usePaddle(testConfig));

    const cases = [
      ['basic-monthly', 'PROD-BM'],
      ['plus-monthly', 'PROD-PM'],
      ['basic-yearly', 'PROD-BY'],
      ['plus-yearly', 'PROD-PY'],
    ] as const;

    cases.forEach(([planType, expectedProduct], i) => {
      result.current.openCheckout({ planType, userId: 'u1' });
      // Assert per-iteration so each planType is tied directly to its product id
      // (a wrong PRODUCT_FIELD mapping fails on the exact offending plan).
      expect(open.mock.calls[i][0].product).toBe(expectedProduct);
    });
  });
});

describe('usePaddle Setup idempotency', () => {
  it('calls Paddle.Setup({ vendor: 39343 }) exactly once across two hook mounts', async () => {
    // Fresh module instance so the module-level `isSetup` guard starts false,
    // independent of any earlier test that already flipped it.
    vi.resetModules();
    const { Setup } = stubPaddle();
    const { usePaddle } = await import('./usePaddle');

    const mount1 = renderHook(() => usePaddle(testConfig));
    const mount2 = renderHook(() => usePaddle(testConfig));

    expect(Setup).toHaveBeenCalledTimes(1);
    expect(Setup).toHaveBeenCalledWith({ vendor: 39343 });

    mount1.unmount();
    mount2.unmount();
  });
});
