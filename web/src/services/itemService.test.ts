import { describe, it, expect, vi, beforeEach } from 'vitest';

const fs = vi.hoisted(() => ({
  doc: vi.fn((_db, path) => ({ path })),
  getDoc: vi.fn(),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  deleteField: vi.fn(() => '__DELETE__'),
  writeBatch: vi.fn(),
  collection: vi.fn(() => ({})),
  query: vi.fn((...a) => ({ a })),
  where: vi.fn((...a) => ({ a })),
  onSnapshot: vi.fn(),
}));
vi.mock('firebase/firestore', () => fs);
vi.mock('./firebase', () => ({ db: {} }));

import { localStore } from './storage';
import * as localItems from './localItems';
import { makeItemService } from './itemService';
import type { Item } from '../domain/types';

const baseItem = (over: Partial<Item> = {}): Item => ({
  id: 'item-1', title: 'T', js: 'A.b', css: '', html: '',
  htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: '', ...over,
});

beforeEach(() => { vi.clearAllMocks(); window.localStorage.clear(); });

describe('itemService.setItem', () => {
  it('always writes locally + adds to the local index; signed-out → no cloud write', async () => {
    const svc = makeItemService(() => ({ uid: null, online: true }));
    await svc.setItem('item-1', baseItem());
    expect(await localStore.get<Item | null>('item-1', null)).toMatchObject({ id: 'item-1' });
    expect(await localItems.list()).toContain('item-1');
    expect(fs.setDoc).not.toHaveBeenCalled();
  });
  it('signed-in + online → cloud setDoc(merge), stamps createdBy, ensures pages, strips imageBase64', async () => {
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    await svc.setItem('item-1', baseItem({ imageBase64: 'BIG' } as Partial<Item>));
    expect(fs.setDoc).toHaveBeenCalledTimes(1);
    const call = fs.setDoc.mock.calls[0] as unknown as [any, any, any];
    const [ref, data, opts] = call;
    expect(ref).toMatchObject({ path: 'items/item-1' });
    expect(opts).toEqual({ merge: true });
    expect(data.createdBy).toBe('u1');
    expect(typeof data.updatedOn).toBe('number');
    expect(data.pages.length).toBe(1);
    expect('imageBase64' in data).toBe(false);
    const local = await localStore.get<any>('item-1', null);
    expect('imageBase64' in local).toBe(false);
  });
  it('signed-in but OFFLINE → local write; cloud attempted but not awaited (resolves immediately)', async () => {
    const svc = makeItemService(() => ({ uid: 'u1', online: false }));
    await svc.setItem('item-1', baseItem());
    expect(await localStore.get<Item | null>('item-1', null)).not.toBeNull();
  });
});

describe('itemService.saveLastCode', () => {
  it('writes the item to the local `code` slot and never to cloud', async () => {
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    svc.saveLastCode(baseItem({ js: 'LAST' }));
    expect(await localStore.get<any>('code', null)).toMatchObject({ js: 'LAST' });
    expect(fs.setDoc).not.toHaveBeenCalled();
  });
});

describe('itemService.getItem', () => {
  it('own item: getDoc + ownership check', async () => {
    fs.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => baseItem({ createdBy: 'u1' }) });
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    const it = await svc.getItem('item-1');
    expect(it.id).toBe('item-1');
  });
  it('own item owned by someone else → throws', async () => {
    fs.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => baseItem({ createdBy: 'other' }) });
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    await expect(svc.getItem('item-1')).rejects.toThrow();
  });
  it('signed-out: reads from localStore, never calls getDoc (advisor fix)', async () => {
    await localStore.set('item-1', baseItem({ id: 'item-1' }));
    const svc = makeItemService(() => ({ uid: null, online: true }));
    const it = await svc.getItem('item-1');
    expect(it.id).toBe('item-1');
    expect(fs.getDoc).not.toHaveBeenCalled();
  });
  it('signed-out + missing locally → throws', async () => {
    const svc = makeItemService(() => ({ uid: null, online: true }));
    await expect(svc.getItem('nope')).rejects.toThrow();
    expect(fs.getDoc).not.toHaveBeenCalled();
  });
});

describe('itemService.removeItem', () => {
  it('signed-out removes local + index; signed-in deletes the doc', async () => {
    const out = makeItemService(() => ({ uid: null, online: true }));
    await out.setItem('item-1', baseItem());
    await out.removeItem('item-1');
    expect(await localStore.get('item-1', null)).toBeNull();
    expect(await localItems.list()).not.toContain('item-1');
    const inn = makeItemService(() => ({ uid: 'u1', online: true }));
    await inn.removeItem('item-2');
    expect(fs.deleteDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'items/item-2' }));
  });
});

describe('itemService.subscribeAllItems', () => {
  it('subscribes to items where createdBy == uid and maps docs to an array', () => {
    const unsub = vi.fn();
    fs.onSnapshot.mockImplementationOnce((_q: any, onNext: any) => {
      onNext({ forEach: (f: (d: any) => void) => { f({ data: () => ({ id: 'a', createdBy: 'u1' }) }); f({ data: () => ({ id: 'b', createdBy: 'u1' }) }); } });
      return unsub;
    });
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    const cb = vi.fn();
    const stop = svc.subscribeAllItems('u1', cb);
    expect(fs.where).toHaveBeenCalledWith('createdBy', '==', 'u1');
    expect(cb).toHaveBeenCalledWith([{ id: 'a', createdBy: 'u1' }, { id: 'b', createdBy: 'u1' }]);
    expect(stop).toBe(unsub);
  });
});

describe('itemService.saveItems (import)', () => {
  it('signed-in: batch sets each item + users.items.<id>; commits once', async () => {
    const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn(async () => {}) };
    fs.writeBatch.mockReturnValueOnce(batch);
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    await svc.saveItems({ a: baseItem({ id: 'a' }), b: baseItem({ id: 'b' }) });
    // 2 item docs + 2 user-doc merges = 4 set calls; commit once.
    expect(batch.set).toHaveBeenCalledTimes(4);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
  it('writes users/{uid} via set(merge:true), NOT update — so a missing user doc cannot abort the import (adversarial review)', async () => {
    // batch.update() requires the target doc to already exist and aborts the whole
    // batch otherwise. A freshly-signed-in user (users/{uid} created fire-and-forget
    // on login) who imports immediately would silently lose every item. Revert to
    // batch.update(users/...) → this test fails (update called, set on users path
    // absent, no merge opts). set(merge:true) is create-or-merge → safe.
    const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn(async () => {}) };
    fs.writeBatch.mockReturnValueOnce(batch);
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    await svc.saveItems({ a: baseItem({ id: 'a' }) });
    // The user doc must NEVER be touched via update() (the abort-on-missing path).
    expect(batch.update).not.toHaveBeenCalled();
    // It must be written with set(...merge:true) on the users/{uid} path.
    const userSet = batch.set.mock.calls.find(
      (c: any[]) => c[0]?.path === 'users/u1',
    );
    expect(userSet).toBeDefined();
    expect(userSet![1]).toEqual({ items: { a: true } });
    expect(userSet![2]).toEqual({ merge: true });
  });
  it('strips backend-owned sharing fields from every batch payload (advisor fix #2)', async () => {
    // Contract §3.1: isShared/shareToken/sharedAt are written by create_share only.
    // An imported export carrying a stale share token must NOT resurrect a public
    // share on the new owner's item. Revert (no strip in saveItems) → fields present → fails.
    const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn(async () => {}) };
    fs.writeBatch.mockReturnValueOnce(batch);
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    await svc.saveItems({
      a: baseItem({ id: 'a', isShared: true, shareToken: 'stale-tok', sharedAt: 999 } as Partial<Item>),
    });
    const data = batch.set.mock.calls[0][1] as any;
    expect('isShared' in data).toBe(false);
    expect('shareToken' in data).toBe(false);
    expect('sharedAt' in data).toBe(false);
  });
});

describe('itemService.setItem — strips backend-owned sharing fields from the cloud payload (advisor fix A)', () => {
  it('does NOT write isShared/shareToken/sharedAt to the cloud (so a stopped share stays revoked)', async () => {
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    await svc.setItem('item-1', baseItem({ isShared: true, shareToken: 'tok', sharedAt: 123 } as Partial<Item>));
    const data = (fs.setDoc.mock.calls.at(-1) as unknown as unknown[])[1] as any;
    expect('isShared' in data).toBe(false);
    expect('shareToken' in data).toBe(false);
    expect('sharedAt' in data).toBe(false);
  });
});

describe('itemService.moveToFolder (takes the held Item — advisor fix B)', () => {
  it('signed-in: re-saves the GIVEN item with the new folderId (no localStore re-fetch)', async () => {
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    await svc.moveToFolder(baseItem({ id: 'item-1' }), 'folder-9');
    const data = (fs.setDoc.mock.calls.at(-1) as unknown as unknown[])[1] as any;
    expect(data.folderId).toBe('folder-9');
  });
  it('moveToFolder(item, null) clears the folderId in the CLOUD payload (explicit null, not absent)', async () => {
    // Discriminating: setDoc uses merge:true, so an ABSENT folderId key does NOT
    // clear the cloud doc — Firestore retains the stale value. The clear path must
    // write an explicit null. Revert to `delete next.folderId` → key absent → fails.
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    await svc.moveToFolder(baseItem({ id: 'item-1', folderId: 'folder-9' } as Partial<Item>), null);
    const data = (fs.setDoc.mock.calls.at(-1) as unknown as unknown[])[1] as any;
    expect('folderId' in data).toBe(true);
    expect(data.folderId).toBeNull();
    // The local copy is also an explicit null (not a deleteField sentinel object).
    const local = await localStore.get<any>('item-1', null);
    expect(local.folderId).toBeNull();
  });
});

describe('itemService.stopSharing', () => {
  it('signed-in: setDoc(merge) isShared:false + deletes shareToken', async () => {
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    await svc.stopSharing('item-1');
    expect(fs.setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'items/item-1' }),
      { isShared: false, shareToken: '__DELETE__' },
      { merge: true },
    );
  });
  it('signed-out: no cloud write', async () => {
    const svc = makeItemService(() => ({ uid: null, online: true }));
    await svc.stopSharing('item-1');
    expect(fs.setDoc).not.toHaveBeenCalled();
  });
});
