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

  it('doImport is re-entrancy-guarded: a concurrent second call is a no-op (adversarial review)', async () => {
    // The modal stays open during the async import and the Import button is not
    // disabled, so a fast double-click can re-enter doImport before the first
    // resolves → two concurrent saveItems batches. Keep saveItems unresolved so the
    // two calls genuinely overlap. Revert the in-flight ref guard → saveItems is
    // called twice → this fails.
    await localItems.add('item-a');
    await localStore.set('item-a', makeItem('item-a'));

    useAuthStore.setState({ user: SIGNED_IN_USER, online: true });

    let release!: () => void;
    const blocker = new Promise<void>((res) => { release = res; });
    const mockSaveItems = vi.fn(() => blocker);
    const { result } = renderHook(() => useImportOnLogin(mockSaveItems));

    await waitFor(() => expect(result.current.pending).toBe(true));

    await act(async () => {
      // Fire both before either resolves (saveItems is still blocked).
      const first = result.current.doImport();
      const second = result.current.doImport();
      release();
      await Promise.all([first, second]);
    });

    // Only the first import ran; the second was a synchronous no-op.
    expect(mockSaveItems).toHaveBeenCalledTimes(1);
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

// ── Account-flows hardening (2026-10-20). Each test below was written RED against
// the pre-change hook and reproduces a concrete defect before the fix.
describe('useImportOnLogin — failure, busy and identity safety', () => {
  async function seed(ids: string[], { withRecords = ids }: { withRecords?: string[] } = {}) {
    for (const id of ids) await localItems.add(id);
    for (const id of withRecords) await localStore.set(id, makeItem(id));
  }

  async function renderPending(saveItems: (m: Record<string, Item>) => Promise<void>) {
    useAuthStore.setState({ user: SIGNED_IN_USER, online: true });
    const hook = renderHook(() => useImportOnLogin(saveItems));
    await waitFor(() => expect(hook.result.current.pending).toBe(true));
    return hook;
  }

  it('saveItems failure: doImport resolves, reports error, keeps prompt, flag and local records', async () => {
    await seed(['item-a']);
    const saveItems = vi.fn(async () => { throw new Error('offline'); });
    const { result } = await renderPending(saveItems);

    // Pre-fix: doImport rejected (AppRoot calls `void doImport()` → unhandled).
    await act(async () => { await expect(result.current.doImport()).resolves.toBeUndefined(); });

    expect(saveItems).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toMatch(/couldn.t import/i);
    expect(await localStore.get('askedToImportCreations', false)).toBe(false);
    expect(await localItems.list()).toEqual(['item-a']);
    expect(await localStore.get('item-a', null)).not.toBeNull();
  });

  it('retry after a failed import saves again and only then marks asked + closes', async () => {
    await seed(['item-a']);
    const saveItems = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const { result } = await renderPending(saveItems);

    await act(async () => { await result.current.doImport(); });
    expect(result.current.error).not.toBeNull();

    await act(async () => { await result.current.doImport(); });
    expect(saveItems).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(result.current.pending).toBe(false);
    expect(await localStore.get('askedToImportCreations', false)).toBe(true);
  });

  it('count reflects real local records only (index entries without a record are skipped)', async () => {
    await seed(['item-a', 'ghost'], { withRecords: ['item-a'] });
    const saveItems = vi.fn(async () => {});
    const { result } = await renderPending(saveItems);
    expect(result.current.count).toBe(1);

    await act(async () => { await result.current.doImport(); });
    const map = (saveItems.mock.calls[0] as unknown as [Record<string, Item>])[0];
    expect(Object.keys(map)).toEqual(['item-a']);
  });

  it('does not prompt when the index only lists missing records', async () => {
    await seed(['ghost-1', 'ghost-2'], { withRecords: [] });
    useAuthStore.setState({ user: SIGNED_IN_USER, online: true });
    const { result } = renderHook(() => useImportOnLogin(vi.fn(async () => {})));
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.pending).toBe(false);
  });

  it('busy: true while saving; a dismiss during the import is ignored (no flag, no close)', async () => {
    await seed(['item-a']);
    let release!: () => void;
    const saveItems = vi.fn(() => new Promise<void>((res) => { release = res; }));
    const { result } = await renderPending(saveItems);

    let importDone!: Promise<void>;
    act(() => { importDone = result.current.doImport(); });
    await waitFor(() => expect(result.current.busy).toBe(true));

    await act(async () => { await result.current.dismiss(); });
    expect(result.current.pending).toBe(true);
    expect(await localStore.get('askedToImportCreations', false)).toBe(false);

    await act(async () => { release(); await importDone; });
    expect(result.current.busy).toBe(false);
    expect(result.current.pending).toBe(false);
  });

  it('signing out while the prompt is open closes it', async () => {
    await seed(['item-a']);
    const { result } = await renderPending(vi.fn(async () => {}));
    act(() => { useAuthStore.setState({ user: null }); });
    await waitFor(() => expect(result.current.pending).toBe(false));
  });

  it('identity change before saveItems runs: nothing is imported into the new account', async () => {
    await seed(['item-a']);
    const saveItems = vi.fn(async () => {});
    const { result } = await renderPending(saveItems);

    // Hold the record read so the account switches mid-import.
    const realGet = localStore.get.bind(localStore);
    let releaseRead!: () => void;
    const gate = new Promise<void>((res) => { releaseRead = res; });
    const spy = vi.spyOn(localStore, 'get').mockImplementation(async (key: string, fb: unknown) => {
      if (key === 'item-a') await gate;
      return realGet(key, fb);
    });

    let importDone!: Promise<void>;
    act(() => { importDone = result.current.doImport(); });
    act(() => { useAuthStore.setState({ user: { ...SIGNED_IN_USER, uid: 'user-2' } }); });
    await act(async () => { releaseRead(); await importDone; });
    spy.mockRestore();

    expect(saveItems).not.toHaveBeenCalled();
    expect(await localStore.get('askedToImportCreations', false)).toBe(false);
  });

  it('dismiss flag-write failure: resolves, reports error, keeps the prompt', async () => {
    await seed(['item-a']);
    const { result } = await renderPending(vi.fn(async () => {}));
    const spy = vi.spyOn(localStore, 'set').mockRejectedValueOnce(new Error('quota'));
    await act(async () => { await expect(result.current.dismiss()).resolves.toBeUndefined(); });
    spy.mockRestore();
    expect(result.current.pending).toBe(true);
    expect(result.current.error).toMatch(/couldn.t save/i);
  });

  it('flag write fails after a successful save: error shown; retry rewrites only the flag', async () => {
    await seed(['item-a']);
    const saveItems = vi.fn(async () => {});
    const { result } = await renderPending(saveItems);
    const spy = vi.spyOn(localStore, 'set').mockRejectedValueOnce(new Error('quota'));
    await act(async () => { await result.current.doImport(); });
    spy.mockRestore();
    expect(saveItems).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);
    expect(result.current.error).not.toBeNull();

    await act(async () => { await result.current.doImport(); });
    expect(saveItems).toHaveBeenCalledTimes(1); // not re-uploaded
    expect(result.current.pending).toBe(false);
    expect(await localStore.get('askedToImportCreations', false)).toBe(true);
  });

  it('record read failure during import: resolves, reports error, does not call saveItems', async () => {
    await seed(['item-a']);
    const saveItems = vi.fn(async () => {});
    const { result } = await renderPending(saveItems);
    const spy = vi.spyOn(localItems, 'list').mockRejectedValueOnce(new Error('read'));
    await act(async () => { await expect(result.current.doImport()).resolves.toBeUndefined(); });
    spy.mockRestore();
    expect(saveItems).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(true);
    expect(result.current.error).not.toBeNull();
  });

  it('unmount during import: no state update after unmount, no rejection', async () => {
    await seed(['item-a']);
    let reject!: (e: unknown) => void;
    const saveItems = vi.fn(() => new Promise<void>((_, rej) => { reject = rej; }));
    const { result, unmount } = await renderPending(saveItems);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let importDone!: Promise<void>;
    act(() => { importDone = result.current.doImport(); });
    await waitFor(() => expect(saveItems).toHaveBeenCalled());
    unmount();
    reject(new Error('late'));
    await expect(importDone).resolves.toBeUndefined();
    // React would log "state update on an unmounted component" style warnings via console.error.
    expect(errSpy.mock.calls.filter((c) => String(c[0]).includes('unmounted'))).toHaveLength(0);
    errSpy.mockRestore();
  });
});

// ── Review round 2 (2026-10-20): generation ownership of the upload memo and the
// busy lock, and a recoverable initial check. Written RED against the round-1 hook.
describe('useImportOnLogin — generation ownership and check recovery', () => {
  const A = SIGNED_IN_USER;
  const B = { ...SIGNED_IN_USER, uid: 'user-b', email: 'b@test.com' };

  function deferred() {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }
  async function addRecord(id: string) {
    await localItems.add(id);
    await localStore.set(id, makeItem(id));
  }
  const keysOf = (call: unknown[]) => Object.keys(call[0] as Record<string, Item>).sort();

  it.each(['resolve', 'reject'] as const)(
    'P1: an obsolete A save that settles (%s) later cannot mark a newer A prompt as uploaded',
    async (outcome) => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await addRecord('old');
      const events: string[] = [];
      const first = deferred();
      const saveItems = vi.fn((m: Record<string, Item>) => {
        events.push(`save:${Object.keys(m).sort().join(',')}`);
        return saveItems.mock.calls.length === 1 ? first.promise : Promise.resolve();
      });
      const realSet = localStore.set.bind(localStore);
      const setSpy = vi.spyOn(localStore, 'set').mockImplementation(async (k: string, v: unknown) => {
        if (k === 'askedToImportCreations') events.push('flag');
        return realSet(k, v);
      });

      useAuthStore.setState({ user: A, online: true });
      const { result } = renderHook(() => useImportOnLogin(saveItems));
      await waitFor(() => expect(result.current.pending).toBe(true));

      let staleImport!: Promise<void>;
      act(() => { staleImport = result.current.doImport(); });
      await waitFor(() => expect(saveItems).toHaveBeenCalledTimes(1));

      act(() => { useAuthStore.setState({ user: B }); });
      await addRecord('new');
      act(() => { useAuthStore.setState({ user: A }); });
      await waitFor(() => expect(result.current.count).toBe(2));
      expect(result.current.pending).toBe(true);

      await act(async () => {
        if (outcome === 'resolve') first.resolve(); else first.reject(new Error('late'));
        await staleImport;
      });
      // The stale attempt neither closed the new prompt nor set an error on it.
      expect(result.current.pending).toBe(true);
      expect(result.current.error).toBeNull();
      expect(events).not.toContain('flag');

      await act(async () => { await result.current.doImport(); });
      setSpy.mockRestore();
      errSpy.mockRestore();

      expect(saveItems).toHaveBeenCalledTimes(2);
      expect(keysOf(saveItems.mock.calls[1])).toEqual(['new', 'old']);
      expect(events).toEqual(['save:old', 'save:new,old', 'flag']);
      expect(result.current.pending).toBe(false);
    },
  );

  it('same-generation flag-only retry still skips the upload when the payload is unchanged', async () => {
    await addRecord('a');
    const saveItems = vi.fn(async () => {});
    useAuthStore.setState({ user: A, online: true });
    const { result } = renderHook(() => useImportOnLogin(saveItems));
    await waitFor(() => expect(result.current.pending).toBe(true));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const spy = vi.spyOn(localStore, 'set').mockRejectedValueOnce(new Error('quota'));
    await act(async () => { await result.current.doImport(); });
    spy.mockRestore();
    await act(async () => { await result.current.doImport(); });
    errSpy.mockRestore();
    expect(saveItems).toHaveBeenCalledTimes(1);
    expect(await localStore.get('askedToImportCreations', false)).toBe(true);
  });

  it('flag-only retry uploads again when the local payload changed after the successful save', async () => {
    await addRecord('a');
    const saveItems = vi.fn(async () => {});
    useAuthStore.setState({ user: A, online: true });
    const { result } = renderHook(() => useImportOnLogin(saveItems));
    await waitFor(() => expect(result.current.pending).toBe(true));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const spy = vi.spyOn(localStore, 'set').mockRejectedValueOnce(new Error('quota'));
    await act(async () => { await result.current.doImport(); });
    spy.mockRestore();
    await addRecord('b');
    await act(async () => { await result.current.doImport(); });
    errSpy.mockRestore();
    expect(saveItems).toHaveBeenCalledTimes(2);
    expect(keysOf(saveItems.mock.calls[1])).toEqual(['a', 'b']);
  });

  it.each(['resolve', 'reject'] as const)(
    'P2: a held A import does not lock the B prompt; late A %s leaves B busy/lock untouched',
    async (outcome) => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await addRecord('x');
      const aSave = deferred();
      const bSave = deferred();
      const saveItems = vi.fn().mockReturnValueOnce(aSave.promise).mockReturnValueOnce(bSave.promise);
      useAuthStore.setState({ user: A, online: true });
      const { result } = renderHook(() => useImportOnLogin(saveItems));
      await waitFor(() => expect(result.current.pending).toBe(true));
      let aImport!: Promise<void>;
      act(() => { aImport = result.current.doImport(); });
      await waitFor(() => expect(saveItems).toHaveBeenCalledTimes(1));

      act(() => { useAuthStore.setState({ user: B }); });
      await waitFor(() => expect(result.current.pending).toBe(true));
      expect(result.current.busy).toBe(false);

      let bImport!: Promise<void>;
      act(() => { bImport = result.current.doImport(); });
      await waitFor(() => expect(saveItems).toHaveBeenCalledTimes(2));
      expect(result.current.busy).toBe(true);

      await act(async () => {
        if (outcome === 'resolve') aSave.resolve(); else aSave.reject(new Error('late A'));
        await aImport;
      });
      // A's finally released only A's attempt: B is still busy and still locked.
      expect(result.current.busy).toBe(true);
      expect(result.current.error).toBeNull();
      await act(async () => { await result.current.dismiss(); });
      expect(await localStore.get('askedToImportCreations', false)).toBe(false);
      expect(result.current.pending).toBe(true);

      await act(async () => { bSave.resolve(); await bImport; });
      errSpy.mockRestore();
      expect(result.current.busy).toBe(false);
      expect(result.current.pending).toBe(false);
      expect(await localStore.get('askedToImportCreations', false)).toBe(true);
    },
  );

  it('P2: dismiss is usable on the B prompt while an A import is still held', async () => {
    await addRecord('x');
    const aSave = deferred();
    const saveItems = vi.fn().mockReturnValueOnce(aSave.promise);
    useAuthStore.setState({ user: A, online: true });
    const { result } = renderHook(() => useImportOnLogin(saveItems));
    await waitFor(() => expect(result.current.pending).toBe(true));
    act(() => { void result.current.doImport(); });
    await waitFor(() => expect(saveItems).toHaveBeenCalledTimes(1));
    act(() => { useAuthStore.setState({ user: B }); });
    await waitFor(() => expect(result.current.pending).toBe(true));
    await act(async () => { await result.current.dismiss(); });
    expect(result.current.pending).toBe(false);
    expect(await localStore.get('askedToImportCreations', false)).toBe(true);
    await act(async () => { aSave.resolve(); });
  });

  it('passes the initiating uid to saveItems (narrow guard contract)', async () => {
    await addRecord('x');
    const saveItems = vi.fn(async () => {});
    useAuthStore.setState({ user: A, online: true });
    const { result } = renderHook(() => useImportOnLogin(saveItems));
    await waitFor(() => expect(result.current.pending).toBe(true));
    await act(async () => { await result.current.doImport(); });
    expect((saveItems.mock.calls[0] as unknown[])[1]).toEqual({ uid: A.uid });
  });

  describe('P3: initial check failure is reported and retryable', () => {
    it.each([
      ['index read', () => vi.spyOn(localItems, 'list').mockRejectedValueOnce(new Error('read'))],
      ['asked-flag read', () => {
        const realGet = localStore.get.bind(localStore);
        let failed = false;
        return vi.spyOn(localStore, 'get').mockImplementation(async (k: string, fb: unknown) => {
          if (k === 'askedToImportCreations' && !failed) { failed = true; throw new Error('read'); }
          return realGet(k, fb);
        });
      }],
      ['record read', () => {
        const realGet = localStore.get.bind(localStore);
        let failed = false;
        return vi.spyOn(localStore, 'get').mockImplementation(async (k: string, fb: unknown) => {
          if (k === 'x' && !failed) { failed = true; throw new Error('read'); }
          return realGet(k, fb);
        });
      }],
    ] as const)('%s failure: checkError set, no count claim, retryCheck finds the real count without importing', async (_l, arm) => {
      await addRecord('x');
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const spy = arm();
      const saveItems = vi.fn(async () => {});
      useAuthStore.setState({ user: A, online: true });
      const { result } = renderHook(() => useImportOnLogin(saveItems));
      await waitFor(() => expect(result.current.checkError).toMatch(/couldn.t check/i));
      expect(result.current.pending).toBe(false);
      expect(result.current.count).toBe(0);

      await act(async () => { await result.current.retryCheck(); });
      spy.mockRestore();
      errSpy.mockRestore();
      expect(result.current.checkError).toBeNull();
      expect(result.current.pending).toBe(true);
      expect(result.current.count).toBe(1);
      expect(saveItems).not.toHaveBeenCalled();
    });

    it('retryCheck failing again keeps the check error; local records untouched', async () => {
      await addRecord('x');
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const spy = vi.spyOn(localItems, 'list').mockRejectedValue(new Error('read'));
      useAuthStore.setState({ user: A, online: true });
      const { result } = renderHook(() => useImportOnLogin(vi.fn(async () => {})));
      await waitFor(() => expect(result.current.checkError).not.toBeNull());
      await act(async () => { await result.current.retryCheck(); });
      spy.mockRestore();
      errSpy.mockRestore();
      expect(result.current.checkError).not.toBeNull();
      expect(result.current.busy).toBe(false);
      expect(await localStore.get('x', null)).not.toBeNull();
    });

    it("Don't ask again from the check-failure state persists the flag and clears the error", async () => {
      await addRecord('x');
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const spy = vi.spyOn(localItems, 'list').mockRejectedValueOnce(new Error('read'));
      useAuthStore.setState({ user: A, online: true });
      const { result } = renderHook(() => useImportOnLogin(vi.fn(async () => {})));
      await waitFor(() => expect(result.current.checkError).not.toBeNull());
      spy.mockRestore();
      errSpy.mockRestore();
      await act(async () => { await result.current.dismiss(); });
      expect(result.current.checkError).toBeNull();
      expect(await localStore.get('askedToImportCreations', false)).toBe(true);
      expect(await localStore.get('x', null)).not.toBeNull();
    });

    it('check error is cleared on identity change', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const spy = vi.spyOn(localItems, 'list').mockRejectedValueOnce(new Error('read'));
      useAuthStore.setState({ user: A, online: true });
      const { result } = renderHook(() => useImportOnLogin(vi.fn(async () => {})));
      await waitFor(() => expect(result.current.checkError).not.toBeNull());
      act(() => { useAuthStore.setState({ user: null }); });
      spy.mockRestore();
      errSpy.mockRestore();
      await waitFor(() => expect(result.current.checkError).toBeNull());
    });
  });
});
