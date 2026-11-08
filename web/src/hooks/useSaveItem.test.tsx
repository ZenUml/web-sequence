import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const user = vi.hoisted(() => ({
  ensureUser: vi.fn(async () => ({})),
  setItemForUser: vi.fn(async () => {}),
  getUserItemIds: vi.fn(async (): Promise<string[]> => []),
}));
vi.mock('../services/userService', () => user);
const storage = vi.hoisted(() => ({
  get: vi.fn(async (_k?: string, _d?: unknown): Promise<boolean> => true),
  set: vi.fn(async (_k?: string, _v?: unknown) => {}),
}));
vi.mock('../services/storage', () => ({ localStore: storage }));

import { useSaveItem, type UseSaveItemOpts } from './useSaveItem';
import { useEditorStore } from '../state/editorStore';
import { useAuthStore } from '../state/authStore';
import type { Item } from '../domain/types';
import type { ItemService } from '../services/itemService';

const item = (id = 'item-1'): Item => ({ id, title: 'T', js: 'A->B: x', css: '', html: '' } as Item);

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function makeOpts(setItem: ItemService['setItem'], over: Partial<UseSaveItemOpts> = {}): UseSaveItemOpts {
  return {
    itemService: { setItem } as unknown as ItemService,
    subscription: null,
    subLoading: false,
    track: vi.fn(),
    onLimitReached: vi.fn(),
    onFirstLocalSave: vi.fn(),
    onForkedToNewId: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  user.getUserItemIds.mockResolvedValue([]);
  useAuthStore.setState({ user: { uid: 'u1' } as never, online: true });
  useEditorStore.setState({ currentItem: item(), dirty: true, saving: false });
  storage.get.mockResolvedValue(true);
});

describe('useSaveItem', () => {
  it('returns a stable save across renders', () => {
    const { result, rerender } = renderHook((p: UseSaveItemOpts) => useSaveItem(p), {
      initialProps: makeOpts(vi.fn(async () => ({ status: 'cloud' as const }))),
    });
    const first = result.current.save;
    rerender(makeOpts(vi.fn(async () => ({ status: 'cloud' as const }))));
    expect(result.current.save).toBe(first);
  });

  it('cloud save: marks saved, writes membership, confirms cloud', async () => {
    const setItem = vi.fn(async () => ({ status: 'cloud' as const }));
    const { result } = renderHook(() => useSaveItem(makeOpts(setItem)));
    let ok = false;
    await act(async () => { ok = await result.current.save(); });
    expect(ok).toBe(true);
    expect(user.ensureUser).toHaveBeenCalledWith('u1');
    expect(user.setItemForUser).toHaveBeenCalledWith('u1', 'item-1');
    expect(result.current.cloudConfirmed).toBe(true);
    expect(result.current.saveFeedback).toEqual({ error: false, queued: false });
    expect(useEditorStore.getState().dirty).toBe(false);
  });

  it('discards a stale result when the user switches mid-save', async () => {
    const d = deferred<{ status: 'cloud' }>();
    const setItem = vi.fn(() => d.promise);
    const { result } = renderHook(() => useSaveItem(makeOpts(setItem)));
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.save(); });
    await vi.waitFor(() => expect(setItem).toHaveBeenCalled());
    act(() => { useAuthStore.setState({ user: { uid: 'u2' } as never }); });
    await act(async () => { d.resolve({ status: 'cloud' }); expect(await pending).toBe(false); });
    expect(user.setItemForUser).not.toHaveBeenCalled();
    expect(result.current.cloudConfirmed).toBe(false);
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it('discards a stale result when the item switches mid-save', async () => {
    const d = deferred<{ status: 'cloud' }>();
    const setItem = vi.fn(() => d.promise);
    const { result } = renderHook(() => useSaveItem(makeOpts(setItem)));
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.save(); });
    await vi.waitFor(() => expect(setItem).toHaveBeenCalled());
    act(() => { useEditorStore.setState({ currentItem: item('item-2'), dirty: true }); });
    await act(async () => { d.resolve({ status: 'cloud' }); expect(await pending).toBe(false); });
    expect(user.setItemForUser).not.toHaveBeenCalled();
    expect(result.current.cloudConfirmed).toBe(false);
  });

  it('over the free limit: saves locally only, keeps dirty, notifies once per episode', async () => {
    user.getUserItemIds.mockResolvedValue(['a', 'b', 'c', 'd']);
    const setItem = vi.fn(async () => ({ status: 'local' as const }));
    const opts = makeOpts(setItem);
    const { result } = renderHook(() => useSaveItem(opts));
    await act(async () => { expect(await result.current.save()).toBe(false); });
    expect(setItem).toHaveBeenCalledWith('item-1', expect.anything(), expect.objectContaining({ skipCloud: true }));
    expect(user.ensureUser).not.toHaveBeenCalled();
    expect(result.current.saveFeedback).toEqual({ error: false, queued: false, withheld: true });
    expect(useEditorStore.getState().dirty).toBe(true);
    await act(async () => { await result.current.save(); });
    expect(opts.onLimitReached).toHaveBeenCalledTimes(1);
    expect(opts.track).toHaveBeenCalledWith('free_limit_reached', expect.anything());
  });

  it('queued outcome: reports sync pending and returns false', async () => {
    const setItem = vi.fn(async () => ({ status: 'queued' as const }));
    const { result } = renderHook(() => useSaveItem(makeOpts(setItem)));
    await act(async () => { expect(await result.current.save()).toBe(false); });
    expect(result.current.saveFeedback).toEqual({ error: false, queued: true });
    expect(result.current.cloudConfirmed).toBe(false);
  });

  it('permission-denied: retries once under a new id and reports the fork', async () => {
    const setItem = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'permission-denied' }))
      .mockResolvedValueOnce({ status: 'cloud' });
    const opts = makeOpts(setItem);
    const { result } = renderHook(() => useSaveItem(opts));
    await act(async () => { expect(await result.current.save()).toBe(true); });
    expect(setItem).toHaveBeenCalledTimes(2);
    const newId = setItem.mock.calls[1][0] as string;
    expect(newId).not.toBe('item-1');
    expect(opts.onForkedToNewId).toHaveBeenCalledWith(newId);
    expect(useEditorStore.getState().currentItem?.id).toBe(newId);
    expect(result.current.saveFeedback.error).toBe(false);
  });

  it('permission-denied twice: stops after one retry and shows the error', async () => {
    const denied = Object.assign(new Error('denied'), { code: 'permission-denied' });
    const setItem = vi.fn().mockRejectedValue(denied);
    const opts = makeOpts(setItem);
    const { result } = renderHook(() => useSaveItem(opts));
    await act(async () => { expect(await result.current.save()).toBe(false); });
    expect(setItem).toHaveBeenCalledTimes(2);
    expect(opts.onForkedToNewId).toHaveBeenCalledTimes(1);
    expect(result.current.saveFeedback).toEqual({ error: true, queued: false });
  });

  it('over the free limit: notifies again after a successful save resets the episode', async () => {
    user.getUserItemIds.mockResolvedValue(['a', 'b', 'c', 'd']);
    const setItem = vi.fn(async () => ({ status: 'local' as const }));
    const opts = makeOpts(setItem);
    const { result } = renderHook(() => useSaveItem(opts));
    await act(async () => { await result.current.save(); await result.current.save(); });
    expect(opts.onLimitReached).toHaveBeenCalledTimes(1);
    // Back under the cap: the save succeeds and clears the guard.
    user.getUserItemIds.mockResolvedValue([]);
    useEditorStore.setState({ dirty: true });
    await act(async () => { expect(await result.current.save()).toBe(true); });
    user.getUserItemIds.mockResolvedValue(['a', 'b', 'c', 'd']);
    useEditorStore.setState({ dirty: true });
    await act(async () => { await result.current.save(); });
    expect(opts.onLimitReached).toHaveBeenCalledTimes(2);
  });

  it('over the free limit: a different item gets its own notice', async () => {
    user.getUserItemIds.mockResolvedValue(['a', 'b', 'c', 'd']);
    const setItem = vi.fn(async () => ({ status: 'local' as const }));
    const opts = makeOpts(setItem);
    const { result } = renderHook(() => useSaveItem(opts));
    await act(async () => { await result.current.save(); });
    act(() => { useEditorStore.setState({ currentItem: item('item-2'), dirty: true }); });
    await act(async () => { await result.current.save(); });
    expect(opts.onLimitReached).toHaveBeenCalledTimes(2);
  });

  describe('signed-out first-save notice', () => {
    beforeEach(() => {
      useAuthStore.setState({ user: null, online: true });
      storage.get.mockResolvedValue(false);
    });
    const local = () => vi.fn(async () => ({ status: 'local' as const }));

    it('opens the notice once and records it as seen', async () => {
      const opts = makeOpts(local());
      const { result } = renderHook(() => useSaveItem(opts));
      await act(async () => { expect(await result.current.save()).toBe(true); });
      expect(opts.onFirstLocalSave).toHaveBeenCalledTimes(1);
      expect(storage.set).toHaveBeenCalledWith(expect.any(String), true);
    });

    it('silent save skips the notice and leaves it unseen', async () => {
      const opts = makeOpts(local());
      const { result } = renderHook(() => useSaveItem(opts));
      await act(async () => { expect(await result.current.save({ silent: true })).toBe(true); });
      expect(opts.onFirstLocalSave).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('blank diagram skips the notice', async () => {
      useEditorStore.setState({ currentItem: { ...item(), js: '  \n' }, dirty: true });
      const opts = makeOpts(local());
      const { result } = renderHook(() => useSaveItem(opts));
      await act(async () => { await result.current.save(); });
      expect(opts.onFirstLocalSave).not.toHaveBeenCalled();
    });

    it('already-seen notice is not opened again', async () => {
      storage.get.mockResolvedValue(true);
      const opts = makeOpts(local());
      const { result } = renderHook(() => useSaveItem(opts));
      await act(async () => { await result.current.save(); });
      expect(opts.onFirstLocalSave).not.toHaveBeenCalled();
    });
  });

  describe('analytics events', () => {
    it('click and success', async () => {
      const opts = makeOpts(vi.fn(async () => ({ status: 'cloud' as const })));
      const { result } = renderHook(() => useSaveItem(opts));
      await act(async () => { await result.current.save(); });
      expect(opts.track).toHaveBeenCalledWith('diagram_save_clicked', { category: 'ui', label: 'saved' });
      expect(opts.track).toHaveBeenCalledWith('diagram_save_succeeded', { feature_area: 'editor', destination: 'cloud' });
    });

    it('failure carries the error code', async () => {
      const setItem = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { code: 'unavailable' }));
      const opts = makeOpts(setItem);
      const { result } = renderHook(() => useSaveItem(opts));
      await act(async () => { expect(await result.current.save()).toBe(false); });
      expect(opts.track).toHaveBeenCalledWith('diagram_save_failed', { category: 'error', label: 'unavailable' });
      expect(result.current.saveFeedback).toEqual({ error: true, queued: false });
    });
  });

  describe('saveBeforeNew', () => {
    it('no current item: safe to continue', async () => {
      useEditorStore.setState({ currentItem: null as never });
      const setItem = vi.fn();
      const { result } = renderHook(() => useSaveItem(makeOpts(setItem)));
      await act(async () => { expect(await result.current.saveBeforeNew()).toBe(true); });
      expect(setItem).not.toHaveBeenCalled();
    });

    it('clean item: true without writing', async () => {
      useEditorStore.setState({ dirty: false });
      const setItem = vi.fn();
      const { result } = renderHook(() => useSaveItem(makeOpts(setItem)));
      await act(async () => { expect(await result.current.saveBeforeNew()).toBe(true); });
      expect(setItem).not.toHaveBeenCalled();
    });

    it('dirty item: saves silently and resolves true', async () => {
      useAuthStore.setState({ user: null, online: true });
      storage.get.mockResolvedValue(false);
      const opts = makeOpts(vi.fn(async () => ({ status: 'local' as const })));
      const { result } = renderHook(() => useSaveItem(opts));
      await act(async () => { expect(await result.current.saveBeforeNew()).toBe(true); });
      expect(opts.itemService.setItem).toHaveBeenCalledTimes(1);
      expect(opts.onFirstLocalSave).not.toHaveBeenCalled();
    });

    it('queued (offline, signed-in) save counts as safe', async () => {
      const opts = makeOpts(vi.fn(async () => ({ status: 'queued' as const })));
      const { result } = renderHook(() => useSaveItem(opts));
      await act(async () => { expect(await result.current.saveBeforeNew()).toBe(true); });
    });

    it('failed save resolves false and keeps the item dirty', async () => {
      const opts = makeOpts(vi.fn().mockRejectedValue(Object.assign(new Error('x'), { code: 'unavailable' })));
      const { result } = renderHook(() => useSaveItem(opts));
      await act(async () => { expect(await result.current.saveBeforeNew()).toBe(false); });
      expect(useEditorStore.getState().dirty).toBe(true);
    });

    it('over the free limit resolves false', async () => {
      user.getUserItemIds.mockResolvedValue(['a', 'b', 'c', 'd']);
      const opts = makeOpts(vi.fn(async () => ({ status: 'local' as const })));
      const { result } = renderHook(() => useSaveItem(opts));
      await act(async () => { expect(await result.current.saveBeforeNew()).toBe(false); });
    });

    it('waits for an in-flight save instead of failing, then writes nothing extra', async () => {
      const d = deferred<{ status: 'cloud' }>();
      const setItem = vi.fn(() => d.promise);
      const { result } = renderHook(() => useSaveItem(makeOpts(setItem)));
      let inflight!: Promise<boolean>;
      let before!: Promise<boolean>;
      act(() => { inflight = result.current.save(); });
      await vi.waitFor(() => expect(setItem).toHaveBeenCalled());
      let settled = false;
      act(() => { before = result.current.saveBeforeNew().then((v) => { settled = true; return v; }); });
      await Promise.resolve();
      expect(settled).toBe(false);
      await act(async () => { d.resolve({ status: 'cloud' }); await inflight; });
      await act(async () => { expect(await before).toBe(true); });
      expect(setItem).toHaveBeenCalledTimes(1);
    });

    it('item changed while waiting: resolves false', async () => {
      const d = deferred<{ status: 'cloud' }>();
      const setItem = vi.fn(() => d.promise);
      const { result } = renderHook(() => useSaveItem(makeOpts(setItem)));
      let before!: Promise<boolean>;
      act(() => { void result.current.save(); });
      await vi.waitFor(() => expect(setItem).toHaveBeenCalled());
      act(() => { before = result.current.saveBeforeNew(); });
      act(() => { useEditorStore.setState({ currentItem: item('item-2'), dirty: true }); });
      await act(async () => { d.resolve({ status: 'cloud' }); expect(await before).toBe(false); });
    });
  });
});
