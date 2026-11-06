import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useExportFeedbackStore, runExportAll, EXPORT_FILE_NAME } from './exportFeedbackStore';
import { LIBRARY_CANCELLED } from './libraryIdentity';
import type { Item } from '../../domain/types';

// Local fixtures only.
const item = (id: string) => ({ id, title: id, js: 'A.b()', css: '', updatedOn: 1, pages: [] }) as unknown as Item;
const state = () => useExportFeedbackStore.getState();

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

beforeEach(() => {
  state().reset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('runExportAll', () => {
  it('downloads every library diagram and reports the real total and filename', async () => {
    const download = vi.fn();
    const items = [item('a'), item('b'), item('c')];
    await runExportAll({ getItems: async () => items, download, onStart: vi.fn() });
    expect(download).toHaveBeenCalledTimes(1);
    const [name, json] = download.mock.calls[0];
    expect(name).toBe(EXPORT_FILE_NAME);
    expect(JSON.parse(json).items.map((i: Item) => i.id)).toEqual(['a', 'b', 'c']);
    expect(state()).toMatchObject({ phase: 'started', total: 3, fileName: 'zenuml-diagrams.json' });
  });

  it('is preparing while the library is still loading, then uses the loaded total', async () => {
    const d = deferred<Item[] | null>();
    const download = vi.fn();
    const run = runExportAll({ getItems: () => d.promise, download, onStart: vi.fn() });
    expect(state().phase).toBe('preparing');
    expect(state().total).toBeNull();
    expect(state().busy()).toBe(true);
    d.resolve([item('a'), item('b')]);
    await run;
    expect(state()).toMatchObject({ phase: 'started', total: 2 });
  });

  it('an empty library shows the empty state and downloads nothing', async () => {
    const download = vi.fn();
    await runExportAll({ getItems: async () => [], download, onStart: vi.fn() });
    expect(download).not.toHaveBeenCalled();
    expect(state()).toMatchObject({ phase: 'empty', total: 0 });
  });

  it('a download that throws is failed (not started); Try again can succeed', async () => {
    const download = vi.fn().mockImplementationOnce(() => { throw new Error('blocked'); });
    const deps = { getItems: async () => [item('a')], download, onStart: vi.fn() };
    await expect(runExportAll(deps)).resolves.toBeUndefined();
    expect(state()).toMatchObject({ phase: 'failed' });
    await runExportAll(deps);
    expect(state()).toMatchObject({ phase: 'started', total: 1 });
    expect(download).toHaveBeenCalledTimes(2);
  });

  it('a library that cannot be read is failed, not empty and not started', async () => {
    const download = vi.fn();
    await runExportAll({ getItems: async () => null, download, onStart: vi.fn() });
    expect(state().phase).toBe('failed');
    await runExportAll({ getItems: () => Promise.reject(new Error('x')), download, onStart: vi.fn() });
    expect(state().phase).toBe('failed');
    expect(download).not.toHaveBeenCalled();
  });

  it('ignores repeated clicks while preparing and a double click right after the download starts', async () => {
    const d = deferred<Item[] | null>();
    const download = vi.fn();
    const onStart = vi.fn();
    const deps = { getItems: () => d.promise, download, onStart };
    const first = runExportAll(deps);
    await runExportAll(deps);
    await runExportAll(deps);
    d.resolve([item('a')]);
    await first;
    await runExportAll({ ...deps, getItems: async () => [item('a')] });
    expect(download).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('a deliberate export after the double-click window downloads again', async () => {
    vi.useFakeTimers();
    const download = vi.fn();
    const deps = { getItems: async () => [item('a')], download, onStart: vi.fn() };
    await runExportAll(deps);
    vi.advanceTimersByTime(2000);
    await runExportAll(deps);
    expect(download).toHaveBeenCalledTimes(2);
  });

  it('records the library size for the Export all disabled state', () => {
    state().setLibraryCount(0);
    expect(state().libraryCount).toBe(0);
    state().setLibraryCount(null);
    expect(state().libraryCount).toBeNull();
  });
});

describe('runExportAll — bound to the identity that started it', () => {
  function makeIdentity(uid: string | null) {
    let current = { uid, generation: 1 };
    return {
      binding: {
        current: () => current,
        isCurrent: (t: { uid: string | null; generation: number }) =>
          t.uid === current.uid && t.generation === current.generation,
      },
      switchTo(next: string | null) { current = { uid: next, generation: current.generation + 1 }; },
    };
  }

  it('started under A, library arrives after switching to B: no download, cancelled', async () => {
    const id = makeIdentity('A');
    const d = deferred<Item[] | null | typeof LIBRARY_CANCELLED>();
    const download = vi.fn();
    const run = runExportAll({ identity: id.binding, getItems: () => d.promise, download, onStart: vi.fn() });
    id.switchTo('B');
    d.resolve([item('b1'), item('b2')]);
    await run;
    expect(download).not.toHaveBeenCalled();
    expect(state()).toMatchObject({ phase: 'cancelled' });
  });

  it('reader answers CANCELLED: no download, cancelled (not failed, not empty)', async () => {
    const id = makeIdentity('A');
    const download = vi.fn();
    await runExportAll({ identity: id.binding, getItems: async () => LIBRARY_CANCELLED, download, onStart: vi.fn() });
    expect(download).not.toHaveBeenCalled();
    expect(state().phase).toBe('cancelled');
  });

  it('passes the starting identity token to getItems', async () => {
    const id = makeIdentity('A');
    const getItems = vi.fn(async () => [item('a')]);
    await runExportAll({ identity: id.binding, getItems, download: vi.fn(), onStart: vi.fn() });
    expect(getItems).toHaveBeenCalledWith({ uid: 'A', generation: 1 });
  });

  it('identityChanged() clears a finished export result but not a preparing one', () => {
    useExportFeedbackStore.setState({ phase: 'failed' });
    state().identityChanged();
    expect(state().phase).toBe('idle');
    useExportFeedbackStore.setState({ phase: 'preparing' });
    state().identityChanged();
    expect(state().phase).toBe('preparing');
  });
});
