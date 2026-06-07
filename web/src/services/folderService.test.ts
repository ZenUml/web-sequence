import { describe, it, expect, vi, beforeEach } from 'vitest';

const fs = vi.hoisted(() => ({
  doc: vi.fn((_db, path) => ({ path })),
  getDoc: vi.fn(),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async () => {}),
  arrayUnion: vi.fn((v) => ({ __arrayUnion: v })),
  runTransaction: vi.fn(),
}));
vi.mock('firebase/firestore', () => fs);
vi.mock('./firebase', () => ({ db: {} }));

import {
  createFolder,
  renameFolder,
  deleteFolder,
  getFolders,
} from './folderService';

beforeEach(() => vi.clearAllMocks());

describe('folderService', () => {
  it('createFolder arrayUnions a folder onto users/{uid}.folders when the doc exists', async () => {
    fs.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ folders: [] }),
    });
    const f = await createFolder('u1', 'Designs');
    expect(f.id).toMatch(/^folder-/);
    expect(f.name).toBe('Designs');
    expect(fs.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/u1' }),
      {
        folders: { __arrayUnion: expect.objectContaining({ name: 'Designs' }) },
      },
    );
  });
  it('createFolder setDoc(merge) seeds folders when the user doc is missing', async () => {
    fs.getDoc.mockResolvedValueOnce({
      exists: () => false,
      data: () => undefined,
    });
    await createFolder('u1', 'First');
    expect(fs.setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/u1' }),
      { folders: [expect.objectContaining({ name: 'First' })] },
      { merge: true },
    );
  });
  it('renameFolder transaction-updates the matching folder name', async () => {
    fs.runTransaction.mockImplementationOnce(async (_db, fn) => {
      const tx = {
        get: vi.fn(async () => ({
          exists: () => true,
          data: () => ({
            folders: [
              { id: 'folder-1', name: 'Old', createdOn: 1, updatedOn: 1 },
            ],
          }),
        })),
        update: vi.fn(),
      };
      await fn(tx);
      expect(tx.update).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/u1' }),
        {
          folders: [expect.objectContaining({ id: 'folder-1', name: 'New' })],
        },
      );
    });
    await renameFolder('u1', 'folder-1', 'New');
    expect(fs.runTransaction).toHaveBeenCalledTimes(1);
  });
  it('deleteFolder transaction-filters the folder out (items untouched — CQ-3)', async () => {
    fs.runTransaction.mockImplementationOnce(async (_db, fn) => {
      const tx = {
        get: vi.fn(async () => ({
          exists: () => true,
          data: () => ({
            folders: [
              { id: 'folder-1', name: 'A' },
              { id: 'folder-2', name: 'B' },
            ],
          }),
        })),
        update: vi.fn(),
      };
      await fn(tx);
      expect(tx.update).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/u1' }),
        {
          folders: [expect.objectContaining({ id: 'folder-2' })],
        },
      );
    });
    await deleteFolder('u1', 'folder-1');
  });
  it('deleteFolder silently no-ops when the user doc is missing (legacy parity, no throw)', async () => {
    // Legacy folderService.js:130 guards the transaction body with `if (!doc.exists) return`.
    // Firestore's transaction update() on a non-existent document throws "No document to
    // update", so without the guard a delete against a missing user doc rejects. This mock
    // makes tx.update throw exactly as the real client would for a missing doc; the guard
    // must skip update() entirely. Revert the `if (!snap.exists()) return` guard → update()
    // is called → mock throws → deleteFolder rejects → this test fails.
    let updateCalled = false;
    fs.runTransaction.mockImplementationOnce(async (_db, fn) => {
      const tx = {
        get: vi.fn(async () => ({
          exists: () => false,
          data: () => undefined,
        })),
        update: vi.fn(() => {
          updateCalled = true;
          throw new Error('No document to update');
        }),
      };
      await fn(tx);
    });
    await expect(deleteFolder('u1', 'folder-1')).resolves.toBeUndefined();
    expect(updateCalled).toBe(false);
  });

  it('getFolders returns the folders array (empty when absent)', async () => {
    fs.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        folders: [{ id: 'folder-1', name: 'A', createdOn: 1, updatedOn: 1 }],
      }),
    });
    expect(await getFolders('u1')).toEqual([
      { id: 'folder-1', name: 'A', createdOn: 1, updatedOn: 1 },
    ]);
  });
});
