import { describe, it, expect } from 'vitest';
import { isOverFileLimit, limitFor } from './planLimit';
import type { Subscription } from './types';

const plus: Subscription = { status: 'active', passthrough: '{"planType":"plus-monthly"}' };
const basic: Subscription = { status: 'active', passthrough: '{"planType":"basic-monthly"}' };

describe('limitFor', () => {
  it('free=3, basic=20, plus=Infinity', () => {
    expect(limitFor(null)).toBe(3);
    expect(limitFor(basic)).toBe(20);
    expect(limitFor(plus)).toBe(Infinity);
  });
});

// ownedIds is the PRE-INSERT ownership map (sampled before the new item is registered),
// matching legacy checkItemsLimit which runs before setItemForUser. The predicate is
// `ownedIds.length > limitFor(sub)` — legacy admits the (limit+1)-th NEW item.
describe('isOverFileLimit', () => {
  it('free user at 3 owned saving a NEW (4th) item is ALLOWED — legacy admits the (limit+1)-th (count 3 <= 3)', () => {
    expect(isOverFileLimit({ subscription: null, ownedIds: ['a', 'b', 'c'], itemId: 'd' })).toBe(false);
  });
  it('free user at 4 owned saving a NEW (5th) item is over the limit (4 > 3)', () => {
    expect(isOverFileLimit({ subscription: null, ownedIds: ['a', 'b', 'c', 'd'], itemId: 'e' })).toBe(true);
  });
  it('free user re-saving an ALREADY-OWNED item at an OVER-CAP count is BLOCKED (legacy has no includes branch)', () => {
    // DISCRIMINATING: at 4 owned (over the free cap of 3), re-saving the owned item 'a'
    // must be blocked because legacy checkItemsLimit reads the count (4) and applies
    // `4 <= 3` = false → alert+block, with NO `includes`/new-vs-resave exemption. An
    // implementation that wrongly short-circuits `ownedIds.includes(itemId)` to false here
    // would FAIL this test — that is the point. (The pre-insert sampling makes the predicate
    // identical for new vs re-save; it does NOT exempt re-saves.)
    expect(isOverFileLimit({ subscription: null, ownedIds: ['a', 'b', 'c', 'd'], itemId: 'a' })).toBe(true);
  });
  it('free user at 2 owned saving the 3rd new item is allowed (2 <= 3)', () => {
    expect(isOverFileLimit({ subscription: null, ownedIds: ['a', 'b'], itemId: 'c' })).toBe(false);
  });
  it('basic user at 20 owned allowed; at 21 owned blocked', () => {
    expect(isOverFileLimit({ subscription: basic, ownedIds: Array.from({ length: 20 }, (_, i) => `i${i}`), itemId: 'new' })).toBe(false);
    expect(isOverFileLimit({ subscription: basic, ownedIds: Array.from({ length: 21 }, (_, i) => `i${i}`), itemId: 'new' })).toBe(true);
  });
  it('plus user never over the limit', () => {
    expect(isOverFileLimit({ subscription: plus, ownedIds: Array.from({ length: 9999 }, (_, i) => `i${i}`), itemId: 'new' })).toBe(false);
  });
});
