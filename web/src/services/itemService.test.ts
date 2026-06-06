import { describe, it, expect, vi, beforeEach } from 'vitest';

const fs = vi.hoisted(() => ({
  doc: vi.fn((_db, path) => ({ path })),
  getDoc: vi.fn(),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
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
