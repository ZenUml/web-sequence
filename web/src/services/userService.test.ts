import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  doc: vi.fn((_db, path) => ({ path })),
  getDoc: vi.fn(),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async () => {}),
  deleteField: vi.fn(() => '__DELETE__'),
  writeBatch: vi.fn(),
}));
vi.mock('firebase/firestore', () => mocks);
vi.mock('./firebase', () => ({ db: {} }));

import { ensureUser, setItemForUser, unsetItemForUser, getUserItemIds, membershipPatch, userRef, _ensuredUids } from './userService';

beforeEach(() => { vi.clearAllMocks(); _ensuredUids.clear(); });

describe('userService', () => {
  it('ensureUser creates an empty doc (merge) when missing', async () => {
    mocks.getDoc.mockResolvedValueOnce({ exists: () => false, data: () => undefined });
    await ensureUser('u1');
    expect(mocks.setDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/u1' }), {}, { merge: true });
  });
  it('ensureUser returns existing data without writing', async () => {
    mocks.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ items: { i1: true } }) });
    const u = await ensureUser('u1');
    expect(u).toEqual({ items: { i1: true } });
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });
  // #854: membership must not depend on the user doc existing. updateDoc throws on a
  // missing doc, so setItemForUser create-or-merges instead (same as the import batch).
  it('setItemForUser create-or-merges items.<id> = true (works when users/{uid} is missing)', async () => {
    await setItemForUser('u1', 'i9');
    expect(mocks.setDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/u1' }), { items: { i9: true } }, { merge: true });
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });
  it('membershipPatch is the nested items map used by batch writers', () => {
    expect(membershipPatch('i9')).toEqual({ items: { i9: true } });
  });
  it('userRef points at users/{uid}', () => {
    expect(userRef('u1')).toEqual(expect.objectContaining({ path: 'users/u1' }));
  });
  it('unsetItemForUser deletes items.<id>', async () => {
    await unsetItemForUser('u1', 'i9');
    expect(mocks.updateDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/u1' }), { 'items.i9': '__DELETE__' });
  });
  it('getUserItemIds returns the items map keys', async () => {
    mocks.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ items: { a: true, b: true } }) });
    expect(await getUserItemIds('u1')).toEqual(['a', 'b']);
  });
  it('ensureUser does NOT call getDoc a second time for the same uid (FIX 6 memoize)', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ items: { i1: true } }) });
    await ensureUser('u-memo');
    await ensureUser('u-memo');
    expect(mocks.getDoc).toHaveBeenCalledTimes(1);
  });
});
