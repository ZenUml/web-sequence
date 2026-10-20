import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
import { makeItemService, IdentityChangedError } from './itemService';
import type { Item } from '../domain/types';
import { useImportFeedbackStore, runImport } from '../components/library/importFeedbackStore';
import type { IdentityBinding, OperationIdentity } from '../components/library/libraryIdentity';
import { useLibraryReader } from '../components/library/useLibraryReader';
import { renderHook } from '@testing-library/react';
import { LS_KEYS } from '../config/constants';

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
    expect(await svc.setItem('item-1', baseItem())).toEqual({ status: 'queued' });
    expect(await localStore.get<Item | null>('item-1', null)).not.toBeNull();
  });

  it('does not write to a replacement account after the local write awaited', async () => {
    let uid: string | null = 'u1';
    const svc = makeItemService(() => ({uid, online:true}));
    const original = localStore.set.bind(localStore);
    const local = vi.spyOn(localStore, 'set').mockImplementationOnce(async (key, value) => {
      await original(key, value);
      uid = 'u2';
    });
    await expect(svc.setItem('item-1', baseItem(), {guard:{expectedUid:'u1'}})).rejects.toBeInstanceOf(IdentityChangedError);
    expect(fs.setDoc).not.toHaveBeenCalled();
    local.mockRestore();
  });

  // REQ-SUB-5 softened plan-limit: skipCloud keeps the local write but withholds
  // the Firestore write even for a signed-in user.
  it('signed-in + skipCloud → local write kept, NO cloud setDoc (over-cap save)', async () => {
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    await svc.setItem('item-1', baseItem(), { skipCloud: true });
    expect(await localStore.get<Item | null>('item-1', null)).toMatchObject({ id: 'item-1' });
    expect(fs.setDoc).not.toHaveBeenCalled();
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

describe('itemService.subscribeAllItems — read error provenance (IE-F2)', () => {
  it('with onError: a snapshot error reaches onError and is NOT reported as an empty library', () => {
    const failure = new Error('permission-denied');
    fs.onSnapshot.mockImplementationOnce((_q: any, _onNext: any, onErr: any) => { onErr(failure); return vi.fn(); });
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    const cb = vi.fn();
    const onError = vi.fn();
    svc.subscribeAllItems('u1', cb, onError);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(cb).not.toHaveBeenCalled();
  });

  it('without onError: legacy behaviour (cb([])) is unchanged for existing callers', () => {
    fs.onSnapshot.mockImplementationOnce((_q: any, _onNext: any, onErr: any) => { onErr(new Error('x')); return vi.fn(); });
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    const cb = vi.fn();
    svc.subscribeAllItems('u1', cb);
    expect(cb).toHaveBeenCalledWith([]);
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
  it('writes items/{id} via set(merge:true) so a re-import never wipes a live share (adversarial review)', async () => {
    // saveItems strips isShared/shareToken/sharedAt. With plain set() that strip would
    // REPLACE the cloud doc and silently revoke an active public share (and lose any
    // cloud-only field absent from the export). merge:true makes the strip a no-write,
    // not a deletion. Revert to `batch.set(doc(...), data)` (no opts) → 3rd arg is
    // undefined → this fails.
    const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn(async () => {}) };
    fs.writeBatch.mockReturnValueOnce(batch);
    const svc = makeItemService(() => ({ uid: 'u1', online: true }));
    await svc.saveItems({ a: baseItem({ id: 'a' }) });
    const itemSet = batch.set.mock.calls.find((c: any[]) => c[0]?.path === 'items/a');
    expect(itemSet).toBeDefined();
    expect(itemSet![2]).toEqual({ merge: true });
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

// Bound-identity import saves (identity-cancellation review). saveItems reads live
// auth; an import started under one identity must never write into another. The
// optional { expectedUid } guard is checked before every local write and before the
// cloud commit. Without the guard, behaviour is unchanged (useImportOnLogin et al.).
describe('itemService.saveItems — bound identity guard', () => {
  it('signed-in: identity changed before commit → no commit, IdentityChangedError(writesStarted=false)', async () => {
    const svc = makeItemService(() => ({ uid: 'B', online: true }));
    const err = await svc.saveItems({ a: baseItem({ id: 'a' }) }, { expectedUid: 'A' }).catch((e) => e);
    expect(err).toBeInstanceOf(IdentityChangedError);
    expect(err.writesStarted).toBe(false);
    // No batch is even built for B (no set, no commit).
    expect(fs.writeBatch).not.toHaveBeenCalled();
  });

  it('signed-in: switch while the batch is being built → no commit', async () => {
    let uid: string | null = 'A';
    const batch = { set: vi.fn(() => { uid = 'B'; }), update: vi.fn(), commit: vi.fn(async () => {}) };
    fs.writeBatch.mockReturnValueOnce(batch);
    const svc = makeItemService(() => ({ uid, online: true }));
    const err = await svc
      .saveItems({ a: baseItem({ id: 'a' }), b: baseItem({ id: 'b' }) }, { expectedUid: 'A' })
      .catch((e) => e);
    expect(err).toBeInstanceOf(IdentityChangedError);
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it('A → signed out: an import bound to A never falls into the local signed-out path', async () => {
    const svc = makeItemService(() => ({ uid: null, online: true }));
    const err = await svc.saveItems({ a: baseItem({ id: 'a' }) }, { expectedUid: 'A' }).catch((e) => e);
    expect(err).toBeInstanceOf(IdentityChangedError);
    expect(await localStore.get('a', null)).toBeNull();
    expect(await localItems.list()).toEqual([]);
  });

  it('signed-out multi-item save stops at the first write after sign-in (writesStarted=true)', async () => {
    let uid: string | null = null;
    const svc = makeItemService(() => ({ uid, online: true }));
    const setSpy = vi.spyOn(localStore, 'set');
    // Sign in right after the first item record is written.
    setSpy.mockImplementationOnce(async (k, v) => {
      window.localStorage.setItem(k, JSON.stringify(v));
      uid = 'B';
    });
    const err = await svc
      .saveItems({ a: baseItem({ id: 'a' }), b: baseItem({ id: 'b' }), c: baseItem({ id: 'c' }) }, { expectedUid: null })
      .catch((e) => e);
    setSpy.mockRestore();
    expect(err).toBeInstanceOf(IdentityChangedError);
    expect(err.writesStarted).toBe(true);
    expect(await localStore.get('b', null)).toBeNull();
    expect(await localStore.get('c', null)).toBeNull();
    expect(fs.writeBatch).not.toHaveBeenCalled();
  });

  it('matching identity behaves exactly like the unguarded call', async () => {
    const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn(async () => {}) };
    fs.writeBatch.mockReturnValueOnce(batch);
    const svc = makeItemService(() => ({ uid: 'A', online: true }));
    await svc.saveItems({ a: baseItem({ id: 'a' }) }, { expectedUid: 'A' });
    expect(batch.set).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledTimes(1);
    const local = makeItemService(() => ({ uid: null, online: true }));
    await local.saveItems({ z: baseItem({ id: 'z' }) }, { expectedUid: null });
    expect(await localItems.list()).toContain('z');
  });

  it('no guard: unchanged legacy behaviour (writes under whatever identity is live)', async () => {
    const local = makeItemService(() => ({ uid: null, online: true }));
    await local.saveItems({ q: baseItem({ id: 'q' }) });
    expect(await localItems.list()).toContain('q');
  });
});

// IE-C2: the optional isCurrent predicate stops NOT-YET-ISSUED writes after the
// operation's generation is invalidated, even when the live uid matches again.
describe('itemService.saveItems — current-attempt predicate (IE-C2)', () => {
  function holdFirstLocalWrite() {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const real = localStore.set.bind(localStore);
    const spy = vi.spyOn(localStore, 'set').mockImplementationOnce(async (k: string, v: unknown) => {
      await gate;
      await real(k, v);
    });
    return { release, spy };
  }

  it('first local write held, attempt invalidated (uid still null), settled: no index or later record writes', async () => {
    const { release, spy } = holdFirstLocalWrite();
    let current = true;
    const svc = makeItemService(() => ({ uid: null, online: true }));
    const run = svc
      .saveItems({ a: baseItem({ id: 'a' }), b: baseItem({ id: 'b' }), c: baseItem({ id: 'c' }) },
        { expectedUid: null, isCurrent: () => current })
      .catch((e) => e);
    current = false; // e.g. owner unmounted, or null → B → null
    release();
    const err = await run;
    spy.mockRestore();
    expect(err).toBeInstanceOf(IdentityChangedError);
    expect(err.writesStarted).toBe(true);
    expect(await localItems.list()).toEqual([]); // the index write for 'a' never started
    expect(await localStore.get('b', null)).toBeNull();
    expect(await localStore.get('c', null)).toBeNull();
  });

  it('signed-in: attempt invalidated while the batch is built → no commit', async () => {
    let current = true;
    const batch = { set: vi.fn(() => { current = false; }), update: vi.fn(), commit: vi.fn(async () => {}) };
    fs.writeBatch.mockReturnValueOnce(batch);
    const svc = makeItemService(() => ({ uid: 'A', online: true }));
    const err = await svc.saveItems({ a: baseItem({ id: 'a' }) }, { expectedUid: 'A', isCurrent: () => current }).catch((e) => e);
    expect(err).toBeInstanceOf(IdentityChangedError);
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it('expectedUid alone (account-flow callers) keeps the round-3 behaviour', async () => {
    const svc = makeItemService(() => ({ uid: null, online: true }));
    await svc.saveItems({ k: baseItem({ id: 'k' }) }, { expectedUid: null });
    expect(await localItems.list()).toContain('k');
  });

  // Real service seam end to end: the controller forwards its token predicate.
  it('runImport + real saveItems: first local write held, null → B → null, settled: later writes stopped, no success', async () => {
    useImportFeedbackStore.getState().reset();
    let current: OperationIdentity = { uid: null, generation: 1 };
    const binding: IdentityBinding = {
      current: () => current,
      isCurrent: (t) => t.uid === current.uid && t.generation === current.generation,
    };
    let liveUid: string | null = null;
    const svc = makeItemService(() => ({ uid: liveUid, online: true }));
    const { release, spy } = holdFirstLocalWrite();
    const onItemsAdded = vi.fn();
    const text = JSON.stringify({ items: [{ id: 'a', title: 'a', js: '' }, { id: 'b', title: 'b', js: '' }, { id: 'c', title: 'c', js: '' }] });
    const run = runImport(text, { identity: binding, existingIds: [], saveItems: svc.saveItems, onItemsAdded });
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    liveUid = 'B'; current = { uid: 'B', generation: 2 };
    liveUid = null; current = { uid: null, generation: 3 };
    release();
    await run;
    spy.mockRestore();
    expect(await localItems.list()).toEqual([]);
    expect(await localStore.get('b', null)).toBeNull();
    expect(await localStore.get('c', null)).toBeNull();
    expect(onItemsAdded).not.toHaveBeenCalled();
    expect(useImportFeedbackStore.getState()).toMatchObject({ phase: 'cancelled', writesMayHaveStarted: true, prepared: null });
  });

  it('A cloud commit already issued, A → B → A, commit settles: interrupted, no success, no analytics', async () => {
    useImportFeedbackStore.getState().reset();
    let current: OperationIdentity = { uid: 'A', generation: 1 };
    const binding: IdentityBinding = {
      current: () => current,
      isCurrent: (t) => t.uid === current.uid && t.generation === current.generation,
    };
    let commitDone!: () => void;
    const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn(() => new Promise<void>((r) => { commitDone = r; })) };
    fs.writeBatch.mockReturnValueOnce(batch);
    let liveUid: string | null = 'A';
    const svc = makeItemService(() => ({ uid: liveUid, online: true }));
    const onItemsAdded = vi.fn();
    const run = runImport(JSON.stringify({ items: [{ id: 'a', title: 'a', js: '' }] }),
      { identity: binding, existingIds: [], saveItems: svc.saveItems, onItemsAdded });
    await vi.waitFor(() => expect(batch.commit).toHaveBeenCalled());
    liveUid = 'B'; current = { uid: 'B', generation: 2 };
    liveUid = 'A'; current = { uid: 'A', generation: 3 };
    commitDone();
    await run;
    expect(onItemsAdded).not.toHaveBeenCalled();
    expect(useImportFeedbackStore.getState()).toMatchObject({ phase: 'cancelled', writesMayHaveStarted: true });
  });
});

// IE-C2-index: the index write inside localItems.add happens after its own awaited
// index read. An attempt invalidated during that read must not issue the index write.
describe('itemService.saveItems — nested index-write boundary (IE-C2-index)', () => {
  const spies: Array<{ mockRestore(): void }> = [];
  afterEach(() => { while (spies.length) spies.pop()!.mockRestore(); });
  function holdIndexRead() {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const realGet = localStore.get.bind(localStore);
    let held = false;
    const getSpy = vi.spyOn(localStore, 'get').mockImplementation(async (k: string, fb: any) => {
      if (k === LS_KEYS.items && !held) { held = true; await gate; }
      return realGet(k, fb);
    });
    const setSpy = vi.spyOn(localStore, 'set');
    spies.push(getSpy, setSpy);
    const reached = () => held;
    return { release, getSpy, setSpy, reached };
  }
  const indexWrites = (setSpy: ReturnType<typeof vi.spyOn>) =>
    setSpy.mock.calls.filter((c: unknown[]) => c[0] === LS_KEYS.items).length;

  it('service: attempt invalidated during the index read (uid stays null): no index write, no next record', async () => {
    const h = holdIndexRead();
    let current = true;
    const svc = makeItemService(() => ({ uid: null, online: true }));
    const run = svc
      .saveItems({ a: baseItem({ id: 'a' }), b: baseItem({ id: 'b' }) }, { expectedUid: null, isCurrent: () => current })
      .catch((e) => e);
    await vi.waitFor(() => expect(h.reached()).toBe(true));
    current = false; // owner unmounted
    h.release();
    const err = await run;
    expect(err).toBeInstanceOf(IdentityChangedError);
    expect(err.writesStarted).toBe(true); // record 'a' was already issued
    expect(indexWrites(h.setSpy)).toBe(0);
    expect(h.setSpy.mock.calls.some((c: unknown[]) => c[0] === 'b')).toBe(false);
    h.getSpy.mockRestore(); h.setSpy.mockRestore();
    expect(await localItems.list()).toEqual([]);
    expect(await localStore.get('b', null)).toBeNull();
  });

  it('runImport + real saveItems: null → B → null during the index read: cancelled, no index, no analytics', async () => {
    useImportFeedbackStore.getState().reset();
    let current: OperationIdentity = { uid: null, generation: 1 };
    const binding: IdentityBinding = {
      current: () => current,
      isCurrent: (t) => t.uid === current.uid && t.generation === current.generation,
    };
    let liveUid: string | null = null;
    const svc = makeItemService(() => ({ uid: liveUid, online: true }));
    const h = holdIndexRead();
    const onItemsAdded = vi.fn();
    const text = JSON.stringify({ items: [{ id: 'a', title: 'a', js: '' }, { id: 'b', title: 'b', js: '' }] });
    const run = runImport(text, { identity: binding, existingIds: [], saveItems: svc.saveItems, onItemsAdded });
    await vi.waitFor(() => expect(h.reached()).toBe(true));
    liveUid = 'B'; current = { uid: 'B', generation: 2 };
    liveUid = null; current = { uid: null, generation: 3 };
    h.release();
    await run;
    expect(indexWrites(h.setSpy)).toBe(0);
    expect(h.setSpy.mock.calls.some((c: unknown[]) => c[0] === 'b')).toBe(false);
    h.getSpy.mockRestore(); h.setSpy.mockRestore();
    expect(await localItems.list()).toEqual([]);
    expect(onItemsAdded).not.toHaveBeenCalled();
    expect(useImportFeedbackStore.getState()).toMatchObject({ phase: 'cancelled', writesMayHaveStarted: true, prepared: null });
  });

  it('runImport + real saveItems: reader unmount during the index read: cancelled, no index write', async () => {
    useImportFeedbackStore.getState().reset();
    const reader = renderHook(() => useLibraryReader({ items: [], loading: false, uid: null }));
    const binding = reader.result.current.identity;
    const svc = makeItemService(() => ({ uid: null, online: true }));
    const h = holdIndexRead();
    const onItemsAdded = vi.fn();
    const run = runImport(JSON.stringify({ items: [{ id: 'a', title: 'a', js: '' }] }),
      { identity: binding, existingIds: [], saveItems: svc.saveItems, onItemsAdded });
    await vi.waitFor(() => expect(h.reached()).toBe(true));
    reader.unmount();
    h.release();
    await run;
    expect(indexWrites(h.setSpy)).toBe(0);
    h.getSpy.mockRestore(); h.setSpy.mockRestore();
    expect(onItemsAdded).not.toHaveBeenCalled();
    expect(useImportFeedbackStore.getState()).toMatchObject({ phase: 'cancelled', writesMayHaveStarted: true });
  });

  it('matching attempt and legacy callers still index every record', async () => {
    const svc = makeItemService(() => ({ uid: null, online: true }));
    await svc.saveItems({ m: baseItem({ id: 'm' }), n: baseItem({ id: 'n' }) }, { expectedUid: null, isCurrent: () => true });
    await svc.saveItems({ o: baseItem({ id: 'o' }) });
    await localItems.add('p'); // unguarded helper caller
    expect((await localItems.list()).sort()).toEqual(['m', 'n', 'o', 'p']);
  });
});
