import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// --- Mock itemService (factory) ---
const mockSubscribeAllItems = vi.fn();
vi.mock('../services/itemService', () => ({
  makeItemService: vi.fn(() => ({ subscribeAllItems: mockSubscribeAllItems })),
}));

import { useItems } from './useItems';
import { useAuthStore } from '../state/authStore';
import * as localItems from '../services/localItems';
import { localStore } from '../services/storage';
import type { Item } from '../domain/types';

function makeItem(id: string, updatedOn: number): Item {
  return {
    id,
    title: id,
    js: '',
    css: '',
    html: '',
    htmlMode: 'html',
    cssMode: 'css',
    jsMode: 'js',
    pages: [],
    currentPageId: '',
    updatedOn,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, online: true });
  window.localStorage.clear();
});

describe('useItems — signed in', () => {
  it('subscribes via itemService and returns items sorted desc by updatedOn', async () => {
    mockSubscribeAllItems.mockImplementation((_uid: string, cb: (items: Item[]) => void) => {
      cb([makeItem('a', 1), makeItem('b', 5)]);
      return () => {};
    });

    useAuthStore.setState({
      user: { uid: 'u1', email: 'a@b.c', displayName: null, photoURL: null },
      online: true,
    });

    const { result } = renderHook(() => useItems());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('calls unsubscribe on unmount', async () => {
    const unsub = vi.fn();
    mockSubscribeAllItems.mockImplementation((_uid: string, cb: (items: Item[]) => void) => {
      cb([]);
      return unsub;
    });

    useAuthStore.setState({
      user: { uid: 'u1', email: 'a@b.c', displayName: null, photoURL: null },
      online: true,
    });

    const { unmount } = renderHook(() => useItems());
    await waitFor(() => {}); // let effect run
    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });
});

describe('useItems — signed out', () => {
  it('loads from localItems/localStore and returns items sorted desc by updatedOn', async () => {
    useAuthStore.setState({ user: null, online: true });

    // Seed local storage: two items
    await localItems.add('x');
    await localStore.set('x', makeItem('x', 2));
    await localItems.add('y');
    await localStore.set('y', makeItem('y', 9));

    const { result } = renderHook(() => useItems());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((i) => i.id)).toEqual(['y', 'x']);
    // itemService.subscribeAllItems must NOT be called for signed-out
    expect(mockSubscribeAllItems).not.toHaveBeenCalled();
  });

  it('returns empty list when no local items exist', async () => {
    useAuthStore.setState({ user: null, online: true });

    const { result } = renderHook(() => useItems());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
  });
});

// Reactivity regression: the signed-out list must refresh on local create/delete/move
// WITHOUT a remount. We drive the changes through the REAL itemService (signed-out
// branch) — not direct localStore pokes — so the test exercises the same emit path the
// app uses. Revert the localItems.notifyChange() emits (or the useItems.subscribe) →
// these fail because the one-shot effect never re-runs (adversarial review).
describe('useItems — signed out reactivity', () => {
  // The signed-in itemService import is mocked above, so build a real service here
  // by importing the actual module under a separate path is not possible; instead we
  // exercise the signed-out write paths directly via localItems + the service's own
  // notify, mirroring what setItem/removeItem do.
  it('create through itemService.setItem refreshes the list without remount', async () => {
    const { makeItemService } = await vi.importActual<typeof import('../services/itemService')>(
      '../services/itemService',
    );
    const svc = makeItemService(() => ({ uid: null, online: true }));

    useAuthStore.setState({ user: null, online: true });
    const { result } = renderHook(() => useItems());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);

    await svc.setItem('new1', makeItem('new1', 3));
    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['new1']));
  });

  it('delete through itemService.removeItem refreshes the list without remount', async () => {
    const { makeItemService } = await vi.importActual<typeof import('../services/itemService')>(
      '../services/itemService',
    );
    const svc = makeItemService(() => ({ uid: null, online: true }));

    useAuthStore.setState({ user: null, online: true });
    await localItems.add('gone');
    await localStore.set('gone', makeItem('gone', 1));

    const { result } = renderHook(() => useItems());
    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['gone']));

    await svc.removeItem('gone');
    await waitFor(() => expect(result.current.items).toEqual([]));
  });

  it('move-to-folder through itemService.moveToFolder refreshes the list without remount', async () => {
    const { makeItemService } = await vi.importActual<typeof import('../services/itemService')>(
      '../services/itemService',
    );
    const svc = makeItemService(() => ({ uid: null, online: true }));

    useAuthStore.setState({ user: null, online: true });
    const it = makeItem('m1', 1);
    await svc.setItem('m1', it);

    const { result } = renderHook(() => useItems());
    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['m1']));
    expect(result.current.items[0].folderId).toBeUndefined();

    // Move never changes the index (add() is a no-op for an existing id), so the only
    // way the list reflects the new folderId is the notifyChange() emit (adversarial review).
    await svc.moveToFolder(result.current.items[0], 'folder-x');
    await waitFor(() => expect(result.current.items[0].folderId).toBe('folder-x'));
  });
});
