import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useImportOnLogin } from './useImportOnLogin';
import { useAuthStore } from '../state/authStore';
import * as localItems from '../services/localItems';
import { localStore } from '../services/storage';
import type { Item } from '../domain/types';

function makeItem(id: string): Item {
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
    updatedOn: Date.now(),
  };
}

const SIGNED_IN_USER = {
  uid: 'user-1',
  email: 'a@test.com',
  displayName: 'Test User',
  photoURL: null,
};

beforeEach(() => {
  window.localStorage.clear();
  useAuthStore.setState({ user: null, online: true });
  vi.clearAllMocks();
});

describe('useImportOnLogin', () => {
  it('is not pending when user is signed out', async () => {
    const mockSaveItems = vi.fn(async () => {});
    useAuthStore.setState({ user: null, online: true });
    const { result } = renderHook(() => useImportOnLogin(mockSaveItems));
    // Give effects a chance to run
    await waitFor(() => {});
    expect(result.current.pending).toBe(false);
    expect(mockSaveItems).not.toHaveBeenCalled();
  });

  it('is not pending when flag already set, even with local items', async () => {
    // Seed local items
    await localItems.add('item-1');
    await localStore.set('item-1', makeItem('item-1'));
    // Mark flag already set
    await localStore.set('askedToImportCreations', true);

    useAuthStore.setState({ user: SIGNED_IN_USER, online: true });

    const mockSaveItems = vi.fn(async () => {});
    const { result } = renderHook(() => useImportOnLogin(mockSaveItems));

    await waitFor(() => {});
    expect(result.current.pending).toBe(false);
  });

  it('sets pending=true and count when signed in + flag unset + local items exist', async () => {
    // Seed two local items
    await localItems.add('item-a');
    await localStore.set('item-a', makeItem('item-a'));
    await localItems.add('item-b');
    await localStore.set('item-b', makeItem('item-b'));

    useAuthStore.setState({ user: SIGNED_IN_USER, online: true });

    const mockSaveItems = vi.fn(async () => {});
    const { result } = renderHook(() => useImportOnLogin(mockSaveItems));

    await waitFor(() => expect(result.current.pending).toBe(true));
    expect(result.current.count).toBe(2);
  });

  it('doImport calls saveItems with the correct map and sets the flag', async () => {
    const itemA = makeItem('item-a');
    const itemB = makeItem('item-b');
    await localItems.add('item-a');
    await localStore.set('item-a', itemA);
    await localItems.add('item-b');
    await localStore.set('item-b', itemB);

    useAuthStore.setState({ user: SIGNED_IN_USER, online: true });

    const mockSaveItems = vi.fn(async () => {});
    const { result } = renderHook(() => useImportOnLogin(mockSaveItems));

    await waitFor(() => expect(result.current.pending).toBe(true));

    await act(async () => { await result.current.doImport(); });

    expect(mockSaveItems).toHaveBeenCalledTimes(1);
    const calledWith = (mockSaveItems.mock.calls[0] as unknown as [Record<string, Item>])[0];
    expect(Object.keys(calledWith)).toEqual(expect.arrayContaining(['item-a', 'item-b']));
    expect(calledWith['item-a'].id).toBe('item-a');
    expect(calledWith['item-b'].id).toBe('item-b');

    expect(result.current.pending).toBe(false);

    // Flag must be set in localStorage
    const flag = await localStore.get<boolean>('askedToImportCreations', false);
    expect(flag).toBe(true);
  });

  it('dismiss sets the flag without calling saveItems', async () => {
    await localItems.add('item-x');
    await localStore.set('item-x', makeItem('item-x'));

    useAuthStore.setState({ user: SIGNED_IN_USER, online: true });

    const mockSaveItems = vi.fn(async () => {});
    const { result } = renderHook(() => useImportOnLogin(mockSaveItems));

    await waitFor(() => expect(result.current.pending).toBe(true));

    await act(async () => { await result.current.dismiss(); });

    expect(mockSaveItems).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);

    const flag = await localStore.get<boolean>('askedToImportCreations', false);
    expect(flag).toBe(true);
  });

  it('is not pending when there are no local items', async () => {
    // No local items seeded
    useAuthStore.setState({ user: SIGNED_IN_USER, online: true });

    const mockSaveItems = vi.fn(async () => {});
    const { result } = renderHook(() => useImportOnLogin(mockSaveItems));

    await waitFor(() => {});
    // enough time to resolve
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.pending).toBe(false);
    expect(mockSaveItems).not.toHaveBeenCalled();
  });
});
