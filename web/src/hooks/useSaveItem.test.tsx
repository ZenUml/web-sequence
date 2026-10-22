import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const user = vi.hoisted(() => ({
  ensureUser: vi.fn(async () => ({})),
  setItemForUser: vi.fn(async () => {}),
  getUserItemIds: vi.fn(async (): Promise<string[]> => []),
}));
vi.mock('../services/userService', () => user);
vi.mock('../services/storage', () => ({
  localStore: { get: vi.fn(async () => true), set: vi.fn(async () => {}) },
}));

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
  useEditorStore.setState({ currentItem: item(), dirty: true });
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
    expect(opts.track).toHaveBeenCalledWith('Free Limit', expect.anything());
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
});
