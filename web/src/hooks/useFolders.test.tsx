import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { Folder } from '../domain/types';

const svc = vi.hoisted(() => ({
  getFolders: vi.fn(),
  createFolder: vi.fn(),
  renameFolder: vi.fn(),
  deleteFolder: vi.fn(),
}));

vi.mock('../services/folderService', () => ({
  getFolders: svc.getFolders,
  createFolder: svc.createFolder,
  renameFolder: svc.renameFolder,
  deleteFolder: svc.deleteFolder,
}));

const mockGetFolders = svc.getFolders;
const mockCreateFolder = svc.createFolder;
const mockRenameFolder = svc.renameFolder;
const mockDeleteFolder = svc.deleteFolder;

import { useFolders } from './useFolders';
import { useAuthStore } from '../state/authStore';

const FOLDERS: Folder[] = [
  { id: 'folder-1', name: 'A', createdOn: 1, updatedOn: 1 },
  { id: 'folder-2', name: 'B', createdOn: 1, updatedOn: 1 },
];

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, online: true, authReady: false });
});

describe('useFolders — signed in', () => {
  beforeEach(() => {
    mockGetFolders.mockResolvedValue(FOLDERS);
    mockCreateFolder.mockResolvedValue(undefined);
    mockRenameFolder.mockResolvedValue(undefined);
    mockDeleteFolder.mockResolvedValue(undefined);

    useAuthStore.setState({
      user: { uid: 'u1', email: 'a@b.c' },
      authReady: true,
    });
  });

  it('loads folders on mount when signed in', async () => {
    const { result } = renderHook(() => useFolders());

    await waitFor(() => expect(result.current.folders).toHaveLength(2));
    expect(mockGetFolders).toHaveBeenCalledWith('u1');
    expect(result.current.loading).toBe(false);
  });

  it('createFolder calls service with uid+name then re-loads', async () => {
    // First call from mount, subsequent calls from re-load after mutation
    mockGetFolders.mockResolvedValue(FOLDERS);

    const { result } = renderHook(() => useFolders());
    await waitFor(() => expect(result.current.folders).toHaveLength(2));

    const callCountBefore = mockGetFolders.mock.calls.length;

    await act(async () => {
      await result.current.createFolder('X');
    });

    expect(mockCreateFolder).toHaveBeenCalledWith('u1', 'X');
    expect(mockGetFolders.mock.calls.length).toBeGreaterThan(callCountBefore);
  });

  it('renameFolder calls service with uid+id+name then re-loads', async () => {
    const { result } = renderHook(() => useFolders());
    await waitFor(() => expect(result.current.folders).toHaveLength(2));

    const callCountBefore = mockGetFolders.mock.calls.length;

    await act(async () => {
      await result.current.renameFolder('folder-1', 'A-renamed');
    });

    expect(mockRenameFolder).toHaveBeenCalledWith('u1', 'folder-1', 'A-renamed');
    expect(mockGetFolders.mock.calls.length).toBeGreaterThan(callCountBefore);
  });

  it('deleteFolder calls service with uid+id then re-loads', async () => {
    const { result } = renderHook(() => useFolders());
    await waitFor(() => expect(result.current.folders).toHaveLength(2));

    const callCountBefore = mockGetFolders.mock.calls.length;

    await act(async () => {
      await result.current.deleteFolder('folder-1');
    });

    expect(mockDeleteFolder).toHaveBeenCalledWith('u1', 'folder-1');
    expect(mockGetFolders.mock.calls.length).toBeGreaterThan(callCountBefore);
  });
});

describe('useFolders — uid-change race (advisor fix #9)', () => {
  it('does NOT apply a folder-mutation reload after the user signs out mid-flight', async () => {
    // Repro: createFolder is invoked under uid=u1; the user signs out before the
    // create + reload round-trip resolves. Without a stale-uid guard, the in-flight
    // reload's setFolders(u1 folders) lands on the now signed-out view, leaking one
    // user's folders into another's session.
    useAuthStore.setState({ user: { uid: 'u1', email: 'a@b.c' }, authReady: true });
    mockGetFolders.mockResolvedValue(FOLDERS);

    // Gate svcCreate so we can sign out while it's pending.
    let releaseCreate!: () => void;
    mockCreateFolder.mockImplementation(
      () => new Promise<void>((resolve) => { releaseCreate = () => resolve(); }),
    );

    const { result } = renderHook(() => useFolders());
    await waitFor(() => expect(result.current.folders).toHaveLength(2));

    // Start the mutation (captures uid=u1), then sign out before it resolves.
    let createPromise!: Promise<void>;
    act(() => { createPromise = result.current.createFolder('X'); });
    act(() => { useAuthStore.setState({ user: null }); });
    await waitFor(() => expect(result.current.folders).toEqual([]));

    // Now let the create (and its reload) finish.
    await act(async () => { releaseCreate(); await createPromise; });

    // The signed-out view must stay empty — u1's folders must not reappear.
    expect(result.current.folders).toEqual([]);
  });
});

describe('useFolders — signed out', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, authReady: true });
  });

  it('returns empty folders when signed out', async () => {
    const { result } = renderHook(() => useFolders());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.folders).toEqual([]);
    expect(mockGetFolders).not.toHaveBeenCalled();
  });

  it('createFolder is a no-op when signed out', async () => {
    const { result } = renderHook(() => useFolders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createFolder('X');
    });

    expect(mockCreateFolder).not.toHaveBeenCalled();
  });

  it('renameFolder is a no-op when signed out', async () => {
    const { result } = renderHook(() => useFolders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.renameFolder('folder-1', 'New');
    });

    expect(mockRenameFolder).not.toHaveBeenCalled();
  });

  it('deleteFolder is a no-op when signed out', async () => {
    const { result } = renderHook(() => useFolders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteFolder('folder-1');
    });

    expect(mockDeleteFolder).not.toHaveBeenCalled();
  });
});
