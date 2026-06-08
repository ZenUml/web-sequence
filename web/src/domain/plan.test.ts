import { describe, it, expect } from 'vitest';
import { isSubscribed, getPlanType, isPlus, isBasic } from './plan';
import type { Subscription } from './types';

const sub = (over: Partial<Subscription>): Subscription =>
  ({ status: 'active', passthrough: '', ...over } as Subscription);

describe('isSubscribed', () => {
  it('true for active/trialing, false otherwise/null', () => {
    expect(isSubscribed(sub({ status: 'active' }))).toBe(true);
    expect(isSubscribed(sub({ status: 'trialing' }))).toBe(true);
    expect(isSubscribed(sub({ status: 'cancelled' }))).toBe(false);
    expect(isSubscribed(null)).toBe(false);
  });
});

describe('getPlanType', () => {
  it('free when not subscribed', () => {
    expect(getPlanType(null)).toBe('free');
    expect(getPlanType(sub({ status: 'cancelled' }))).toBe('free');
  });
  it('reads planType from JSON passthrough', () => {
    expect(getPlanType(sub({ passthrough: JSON.stringify({ userId: 'u', planType: 'plus-yearly' }) }))).toBe('plus-yearly');
  });
  it('legacy plain-userId passthrough → basic-monthly', () => {
    expect(getPlanType(sub({ passthrough: 'rawUserId123' }))).toBe('basic-monthly');
  });
});

describe('isPlus / isBasic', () => {
  it('match plan family substrings', () => {
    const plus = sub({ passthrough: JSON.stringify({ userId: 'u', planType: 'plus-monthly' }) });
    const basic = sub({ passthrough: JSON.stringify({ userId: 'u', planType: 'basic-yearly' }) });
    expect(isPlus(plus)).toBe(true);
    expect(isBasic(plus)).toBe(false);
    expect(isBasic(basic)).toBe(true);
    expect(isPlus(basic)).toBe(false);
  });
});
