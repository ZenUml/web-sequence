import { isPlus, isBasic } from './plan';
import { FILE_LIMITS } from '../config/constants';
import type { Subscription } from './types';

export function limitFor(subscription: Subscription | null | undefined): number {
  if (isPlus(subscription)) return Infinity;
  if (isBasic(subscription)) return FILE_LIMITS.basic;
  return FILE_LIMITS.free;
}

// Legacy-exact parity (checkItemsLimit, app.jsx 467-482): the cap is checked against
// the PRE-INSERT ownership-map count. Legacy runs checkItemsLimit BEFORE setItemForUser
// registers the item, and admits the (limit+1)-th NEW item (the `count <= limit` check
// passes at count === limit). So the predicate is simply `ownedIds.length > limitFor(sub)`
// — NO +1, NO includes branch. The caller (save handler) MUST pass the PRE-INSERT ownedIds
// and apply this ONLY when signed in (local saves carry no cloud cap). Legacy blocks purely
// on the count — there is NO new-vs-resave distinction — so an over-cap re-save is blocked
// exactly as a new save. Because ownedIds is pre-insert, the same predicate covers both: a
// re-save does not grow the count and a new save's id is not yet registered, so `length` is
// the same quantity legacy reads in both cases. Do NOT add `ownedIds.includes(itemId)`.
// `itemId` is accepted for caller ergonomics/symmetry but is NOT part of the decision.
export function isOverFileLimit(input: {
  subscription: Subscription | null | undefined;
  ownedIds: string[];
  itemId: string;
}): boolean {
  const { subscription, ownedIds } = input;
  return ownedIds.length > limitFor(subscription);
}
