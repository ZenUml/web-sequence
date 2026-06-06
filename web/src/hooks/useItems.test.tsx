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
