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

import { ensureUser, setItemForUser, unsetItemForUser, getUserItemIds } from './userService';

beforeEach(() => vi.clearAllMocks());

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
  it('setItemForUser sets items.<id> = true', async () => {
    await setItemForUser('u1', 'i9');
    expect(mocks.updateDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/u1' }), { 'items.i9': true });
  });
  it('unsetItemForUser deletes items.<id>', async () => {
    await unsetItemForUser('u1', 'i9');
    expect(mocks.updateDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/u1' }), { 'items.i9': '__DELETE__' });
  });
  it('getUserItemIds returns the items map keys', async () => {
    mocks.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ items: { a: true, b: true } }) });
    expect(await getUserItemIds('u1')).toEqual(['a', 'b']);
  });
});
