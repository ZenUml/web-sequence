import { describe, it, expect, vi, beforeEach } from 'vitest';

const fs = vi.hoisted(() => ({
  doc: vi.fn((_db, path) => ({ path })),
  getDoc: vi.fn(),
}));
vi.mock('firebase/firestore', () => fs);
vi.mock('./firebase', () => ({ db: {} }));

import { retrieveSubscription } from './subscriptionService';

beforeEach(() => vi.clearAllMocks());

describe('subscriptionService', () => {
  it('reads user_subscriptions/user-<uid> and returns the doc data', async () => {
    fs.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ status: 'active', passthrough: '{"planType":"plus-monthly"}' }) });
    const sub = await retrieveSubscription('u1');
    expect(fs.doc).toHaveBeenCalledWith({}, 'user_subscriptions/user-u1');
    expect(sub).toEqual({ status: 'active', passthrough: '{"planType":"plus-monthly"}' });
  });
  it('returns null when the doc is absent', async () => {
    fs.getDoc.mockResolvedValueOnce({ exists: () => false, data: () => undefined });
    expect(await retrieveSubscription('u1')).toBeNull();
  });
  it('returns null on a read error (legacy swallow-to-null)', async () => {
    fs.getDoc.mockRejectedValueOnce(new Error('permission-denied'));
    expect(await retrieveSubscription('u1')).toBeNull();
  });
});
