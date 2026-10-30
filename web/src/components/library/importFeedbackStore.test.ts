import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useImportFeedbackStore, runImport, readImportFile, type ImportFileContext } from './importFeedbackStore';
import { LIBRARY_CANCELLED, registerLibraryIdentity, type IdentityBinding, type OperationIdentity } from './libraryIdentity';
import { useLibraryReader } from './useLibraryReader';
import { IdentityChangedError } from '../../services/itemService';
import type { Item } from '../../domain/types';

// Local fixtures only. A legacy single-page item (no `pages`) exercises the
// multi-page migration, which generates page ids — retry must not regenerate them.
const legacy = (id: string) => ({ id, title: id, js: 'A.b()', css: '' });
const exportText = (...ids: string[]) => JSON.stringify({ items: ids.map(legacy) });

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function fileWith(text: string, name = 'zenuml-diagrams.json'): File {
  const f = new File([text], name, { type: 'application/json' });
  // jsdom's File.text() is unreliable across versions — make the source explicit.
  f.text = () => Promise.resolve(text);
  return f;
}

const state = () => useImportFeedbackStore.getState();

beforeEach(() => {
  state().reset();
});

describe('readImportFile', () => {
  it('records the real filename, hands the text to onImport and keeps it for retry', async () => {
    const onImport = vi.fn();
    await readImportFile(fileWith('{"items":[]}', 'my-export.json'), onImport);
    expect(onImport).toHaveBeenCalledWith('{"items":[]}');
    expect(state().fileName).toBe('my-export.json');
    expect(state().text).toBe('{"items":[]}');
  });

  it('a file read failure becomes read-failed feedback, not an exception or onImport call', async () => {
    const onImport = vi.fn();
    const f = new File(['x'], 'locked.json');
    f.text = () => Promise.reject(new DOMException('The requested file could not be read', 'NotReadableError'));
    await readImportFile(f, onImport);
    expect(onImport).not.toHaveBeenCalled();
    expect(state().phase).toBe('readFailed');
    expect(state().fileName).toBe('locked.json');
  });

  it('is pending while reading and ignores a second file until the first settles', async () => {
    const d = deferred<string>();
    const first = new File(['x'], 'one.json');
    first.text = () => d.promise;
    const onImport = vi.fn();
    const p = readImportFile(first, onImport);
    expect(state().phase).toBe('reading');
    expect(state().busy()).toBe(true);
    await readImportFile(fileWith('[]', 'two.json'), onImport);
    expect(onImport).not.toHaveBeenCalled();
    d.resolve('[]');
    await p;
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(state().fileName).toBe('one.json');
  });

  it('a new attempt clears earlier feedback', async () => {
    useImportFeedbackStore.setState({ phase: 'success', added: 3, updated: 0, fileName: 'old.json' });
    const d = deferred<string>();
    const f = new File(['x'], 'new.json');
    f.text = () => d.promise;
    const p = readImportFile(f, vi.fn());
    expect(state().phase).toBe('reading');
    expect(state().added).toBe(0);
    d.resolve('[]');
    await p;
  });
});

describe('runImport', () => {
  it('reports success only after saveItems resolves, with real new and updated counts', async () => {
    const save = deferred();
    const saveItems = vi.fn((_items: Record<string, Item>) => save.promise);
    const onItemsAdded = vi.fn();
    const text = JSON.stringify({ items: [legacy('n1'), legacy('n1'), legacy('e1'), legacy('n2')] });
    const run = runImport(text, { existingIds: ['e1'], saveItems, onItemsAdded });
    expect(state().phase).toBe('saving');
    expect(onItemsAdded).not.toHaveBeenCalled();
    save.resolve();
    await run;
    expect(state()).toMatchObject({ phase: 'success', added: 2, updated: 1 });
    expect(Object.keys(saveItems.mock.calls[0][0]).sort()).toEqual(['e1', 'n1', 'n2']);
    expect(onItemsAdded).toHaveBeenCalledWith(2);
  });

  it('an all-existing import is a success with updates and fires no added analytics', async () => {
    const onItemsAdded = vi.fn();
    await runImport(exportText('a', 'b'), { existingIds: ['a', 'b'], saveItems: async () => {}, onItemsAdded });
    expect(state()).toMatchObject({ phase: 'success', added: 0, updated: 2 });
    expect(onItemsAdded).not.toHaveBeenCalled();
  });

  it('invalid JSON and empty/unsupported files are invalid, never saved, never success', async () => {
    const saveItems = vi.fn(async () => {});
    await runImport('{oops', { existingIds: [], saveItems, onItemsAdded: vi.fn() });
    expect(state()).toMatchObject({ phase: 'invalid', invalidReason: 'invalid-json' });
    await runImport('{"items":[]}', { existingIds: [], saveItems, onItemsAdded: vi.fn() });
    expect(state()).toMatchObject({ phase: 'invalid', invalidReason: 'no-diagrams' });
    await runImport('{"version":2}', { existingIds: [], saveItems, onItemsAdded: vi.fn() });
    expect(state()).toMatchObject({ phase: 'invalid', invalidReason: 'no-diagrams' });
    expect(saveItems).not.toHaveBeenCalled();
  });

  it('a rejected save is saveFailed — no success, no analytics, no counts claimed', async () => {
    const onItemsAdded = vi.fn();
    await runImport(exportText('a', 'b'), {
      existingIds: [],
      saveItems: async () => { throw new Error('FirebaseError: PERMISSION_DENIED stack…'); },
      onItemsAdded,
    });
    expect(state().phase).toBe('saveFailed');
    expect(state().added).toBe(0);
    expect(state().updated).toBe(0);
    expect(onItemsAdded).not.toHaveBeenCalled();
  });

  it('retry reuses the same text, the same diagram ids and the same page ids', async () => {
    const saveItems = vi
      .fn<(items: Record<string, Item>) => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const deps = { existingIds: [] as string[], saveItems, onItemsAdded: vi.fn() };
    const text = exportText('a', 'b');
    await runImport(text, deps);
    expect(state().phase).toBe('saveFailed');
    // A partial local write may have landed 'a' before the failure: the live list now
    // contains it. Counts must stay relative to the first attempt, not the partial state.
    await runImport(text, { ...deps, existingIds: ['a'] });
    expect(state()).toMatchObject({ phase: 'success', added: 2, updated: 0 });
    const [first, second] = saveItems.mock.calls.map((c) => c[0]);
    expect(Object.keys(second)).toEqual(Object.keys(first));
    for (const id of Object.keys(first)) {
      expect(second[id].pages.map((p) => p.id)).toEqual(first[id].pages.map((p) => p.id));
    }
    expect(deps.onItemsAdded).toHaveBeenCalledTimes(1);
    expect(deps.onItemsAdded).toHaveBeenCalledWith(2);
  });

  it('a different file (even with identical content) is a fresh attempt with a fresh baseline', async () => {
    const deps = { existingIds: [] as string[], saveItems: async () => {}, onItemsAdded: vi.fn() };
    const text = exportText('a');
    await readImportFile(fileWith(text, 'first.json'), (t) => runImport(t, deps));
    expect(state()).toMatchObject({ phase: 'success', added: 1, fileName: 'first.json' });
    await readImportFile(fileWith(text, 'first.json'), (t) => runImport(t, { ...deps, existingIds: ['a'] }));
    expect(state()).toMatchObject({ phase: 'success', added: 0, updated: 1 });
  });

  it('ignores a repeated submission while a save is pending', async () => {
    const save = deferred();
    const saveItems = vi.fn(() => save.promise);
    const deps = { existingIds: [], saveItems, onItemsAdded: vi.fn() };
    const first = runImport(exportText('a'), deps);
    await runImport(exportText('a'), deps);
    await runImport(exportText('b'), deps);
    expect(saveItems).toHaveBeenCalledTimes(1);
    save.resolve();
    await first;
    expect(state().phase).toBe('success');
  });

  it('text that did not come through readImportFile has no filename instead of a stale one', async () => {
    useImportFeedbackStore.setState({ fileName: 'stale.json', text: 'other' });
    await runImport(exportText('a'), { existingIds: [], saveItems: async () => {}, onItemsAdded: vi.fn() });
    expect(state().fileName).toBeNull();
  });

  it('dismiss returns to idle and drops the held input', async () => {
    await runImport('{oops', { existingIds: [], saveItems: async () => {}, onItemsAdded: vi.fn() });
    state().dismiss();
    expect(state()).toMatchObject({ phase: 'idle', text: null, fileName: null });
  });
});

describe('runImport — existing ids from a settled library', () => {
  it('awaits async existing ids before classifying, and stays pending meanwhile', async () => {
    const ids = deferred<Iterable<string>>();
    const saveItems = vi.fn(async () => {});
    const run = runImport(exportText('old', 'new'), {
      existingIds: () => ids.promise,
      saveItems,
      onItemsAdded: vi.fn(),
    });
    expect(state().phase).toBe('saving');
    expect(saveItems).not.toHaveBeenCalled();
    ids.resolve(['old']);
    await run;
    expect(state()).toMatchObject({ phase: 'success', added: 1, updated: 1, countsKnown: true });
  });

  it('unknown existing ids (library never loaded) still saves but claims no added/updated split', async () => {
    const onItemsAdded = vi.fn();
    const saveItems = vi.fn(async () => {});
    await runImport(exportText('a', 'b', 'b'), { existingIds: async () => null, saveItems, onItemsAdded });
    expect(saveItems).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({ phase: 'success', countsKnown: false, total: 2 });
    expect(onItemsAdded).not.toHaveBeenCalled();
  });

  it('a rejecting id lookup is treated as unknown counts, never an unhandled rejection', async () => {
    await expect(
      runImport(exportText('a'), {
        existingIds: () => Promise.reject(new Error('snapshot failed')),
        saveItems: async () => {},
        onItemsAdded: vi.fn(),
      }),
    ).resolves.toBeUndefined();
    expect(state()).toMatchObject({ phase: 'success', countsKnown: false, total: 1 });
  });

  it('a throwing analytics callback does not turn a committed import into a failure', async () => {
    await expect(
      runImport(exportText('a'), {
        existingIds: [],
        saveItems: async () => {},
        onItemsAdded: () => { throw new Error('tracker down'); },
      }),
    ).resolves.toBeUndefined();
    expect(state()).toMatchObject({ phase: 'success', added: 1 });
  });
});

describe('readImportFile — public API hardening', () => {
  it('an import handler that throws becomes save-failed feedback, never an unhandled rejection', async () => {
    await expect(
      readImportFile(fileWith(exportText('a'), 'x.json'), () => { throw new Error('boom'); }),
    ).resolves.toBeUndefined();
    expect(state()).toMatchObject({ phase: 'saveFailed', fileName: 'x.json' });
  });

  it('an import handler that rejects becomes save-failed feedback', async () => {
    await expect(
      readImportFile(fileWith(exportText('a')), () => Promise.reject(new Error('boom'))),
    ).resolves.toBeUndefined();
    expect(state().phase).toBe('saveFailed');
  });

  it('a void handler that never records a result leaves nothing pending', async () => {
    await readImportFile(fileWith(exportText('a')), () => {});
    expect(state().busy()).toBe(false);
  });
});

// Identity-bound import attempts (identity-cancellation review).
describe('runImport — bound to the identity that started it', () => {
  // A controllable identity: generation bumps on every switch, like useLibraryReader.
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

  it('A read pending → switch to B: cancelled, nothing saved, no analytics, no counts', async () => {
    const id = makeIdentity('A');
    const ids = deferred<Iterable<string> | typeof LIBRARY_CANCELLED>();
    const saveItems = vi.fn(async () => {});
    const onItemsAdded = vi.fn();
    const run = runImport(exportText('a'), {
      identity: id.binding,
      existingIds: () => ids.promise,
      saveItems,
      onItemsAdded,
    });
    id.switchTo('B');
    ids.resolve(['unrelated-B-id']); // even a resolved answer is ignored once stale
    await run;
    expect(saveItems).not.toHaveBeenCalled();
    expect(onItemsAdded).not.toHaveBeenCalled();
    expect(state()).toMatchObject({ phase: 'cancelled', writesMayHaveStarted: false, prepared: null, added: 0 });
  });

  it('reader answers CANCELLED → cancelled without saving', async () => {
    const id = makeIdentity('A');
    const saveItems = vi.fn(async () => {});
    await runImport(exportText('a'), {
      identity: id.binding,
      existingIds: async () => LIBRARY_CANCELLED,
      saveItems,
      onItemsAdded: vi.fn(),
    });
    expect(saveItems).not.toHaveBeenCalled();
    expect(state().phase).toBe('cancelled');
  });

  it('passes the starting identity to saveItems as the bound guard', async () => {
    const id = makeIdentity('A');
    const saveItems = vi.fn(async (_items: Record<string, Item>, _guard?: { expectedUid: string | null }) => {});
    await runImport(exportText('a'), { identity: id.binding, existingIds: [], saveItems, onItemsAdded: vi.fn() });
    expect(saveItems.mock.calls[0][1]).toMatchObject({ expectedUid: 'A', isCurrent: expect.any(Function) });
  });

  it('switch during a multi-item save (guard throws) → interrupted, may have written to A only, no success', async () => {
    const id = makeIdentity(null);
    const onItemsAdded = vi.fn();
    const saveItems = vi.fn(async () => {
      id.switchTo('B');
      throw new IdentityChangedError(true);
    });
    await runImport(exportText('a', 'b', 'c'), { identity: id.binding, existingIds: [], saveItems, onItemsAdded });
    expect(state()).toMatchObject({ phase: 'cancelled', writesMayHaveStarted: true, prepared: null });
    expect(onItemsAdded).not.toHaveBeenCalled();
  });

  it('save resolves but identity changed meanwhile → interrupted, no success analytics', async () => {
    const id = makeIdentity('A');
    const onItemsAdded = vi.fn();
    const saveItems = vi.fn(async () => { id.switchTo('B'); });
    await runImport(exportText('a'), { identity: id.binding, existingIds: [], saveItems, onItemsAdded });
    expect(state()).toMatchObject({ phase: 'cancelled', writesMayHaveStarted: true });
    expect(onItemsAdded).not.toHaveBeenCalled();
  });

  it('failed prepared retry → account switch → Try again cannot replay A payload into B', async () => {
    const id = makeIdentity('A');
    const saveItems = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const deps = { identity: id.binding, existingIds: [] as string[], saveItems, onItemsAdded: vi.fn() };
    const text = exportText('a', 'b');
    await runImport(text, deps);
    expect(state().phase).toBe('saveFailed');
    id.switchTo('B');
    await runImport(text, deps); // Try again resubmits the held text
    expect(saveItems).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({ phase: 'cancelled', writesMayHaveStarted: true, prepared: null });
    expect(deps.onItemsAdded).not.toHaveBeenCalled();
  });

  it('identityChanged() drops a failed prepared retry and keeps nothing replayable', async () => {
    const saveItems = vi.fn().mockRejectedValueOnce(new Error('offline'));
    await runImport(exportText('a'), { existingIds: [], saveItems, onItemsAdded: vi.fn() });
    state().identityChanged();
    expect(state()).toMatchObject({ phase: 'cancelled', writesMayHaveStarted: true, prepared: null, text: null });
  });

  it('identityChanged() clears a finished success but leaves an in-flight attempt to its own checks', async () => {
    useImportFeedbackStore.setState({ phase: 'success', added: 2 });
    state().identityChanged();
    expect(state().phase).toBe('idle');
    useImportFeedbackStore.setState({ phase: 'saving' });
    state().identityChanged();
    expect(state().phase).toBe('saving');
  });

  it('same identity throughout: unchanged success and analytics', async () => {
    const id = makeIdentity('A');
    const onItemsAdded = vi.fn();
    await runImport(exportText('a'), { identity: id.binding, existingIds: async () => ['x'], saveItems: async () => {}, onItemsAdded });
    expect(state()).toMatchObject({ phase: 'success', added: 1 });
    expect(onItemsAdded).toHaveBeenCalledWith(1);
  });
});

describe('identityChanged keeps the only notice that writes may exist', () => {
  it('a second account switch does not clear an "Import interrupted" panel', () => {
    useImportFeedbackStore.setState({ phase: 'cancelled', writesMayHaveStarted: true, fileName: 'a.json' });
    useImportFeedbackStore.getState().identityChanged();
    expect(useImportFeedbackStore.getState()).toMatchObject({ phase: 'cancelled', writesMayHaveStarted: true, fileName: 'a.json' });
  });
});

// ---------------------------------------------------------------------------
// IE-C1 / IE-C3: file ownership is captured at the public file-controller entry,
// before `await file.text()`, and every later completion checks that immutable token.
// ---------------------------------------------------------------------------
function controllable(uid: string | null) {
  let current: OperationIdentity = { uid, generation: 1 };
  const binding: IdentityBinding = {
    current: () => current,
    isCurrent: (t) => t.uid === current.uid && t.generation === current.generation,
  };
  return {
    binding,
    // Mirrors useLibraryReader: new generation, then the store notification.
    switchTo(next: string | null) {
      current = { uid: next, generation: current.generation + 1 };
      useImportFeedbackStore.getState().identityChanged();
    },
  };
}

function deferredFile(name = 'a-choice.json') {
  const d = deferred<string>();
  const f = new File(['x'], name, { type: 'application/json' });
  f.text = () => d.promise;
  return { file: f, ...d };
}

describe('readImportFile — ownership captured before the read (IE-C1)', () => {
  let unregister: () => void = () => {};
  afterEach(() => unregister());

  const switches: Array<[string, (id: ReturnType<typeof controllable>) => void]> = [
    ['A → B', (id) => id.switchTo('B')],
    ['A → signed out', (id) => id.switchTo(null)],
    ['A → B → A', (id) => { id.switchTo('B'); id.switchTo('A'); }],
  ];

  for (const [label, change] of switches) {
    for (const outcome of ['resolve', 'reject'] as const) {
      it(`${label}, then the read ${outcome}s: no handler, cancelled, nothing replayable, not busy`, async () => {
        const id = controllable('A');
        unregister = registerLibraryIdentity(id.binding);
        const onImport = vi.fn();
        const { file, resolve, reject } = deferredFile();
        const run = readImportFile(file, onImport);
        expect(state().phase).toBe('reading');
        change(id);
        // Cancelled at once: the reading stage is covered by identityChanged.
        expect(state()).toMatchObject({ phase: 'cancelled', writesMayHaveStarted: false });
        if (outcome === 'resolve') resolve(exportText('a')); else reject(new DOMException('gone', 'NotReadableError'));
        await run;
        expect(onImport).not.toHaveBeenCalled();
        expect(state()).toMatchObject({ phase: 'cancelled', writesMayHaveStarted: false, text: null, prepared: null });
        expect(state().busy()).toBe(false);
      });
    }
  }

  it('a fresh choice for the new owner works while the stale read is pending, and the stale read stays inert', async () => {
    const id = controllable('A');
    unregister = registerLibraryIdentity(id.binding);
    const onImport = vi.fn();
    const stale = deferredFile('a-choice.json');
    const staleRun = readImportFile(stale.file, onImport);
    id.switchTo('B');
    await readImportFile(fileWith(exportText('b'), 'b-choice.json'), onImport);
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport).toHaveBeenCalledWith(exportText('b'), { token: { uid: 'B', generation: 2 } });
    stale.resolve(exportText('a'));
    await staleRun;
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({ fileName: 'b-choice.json', text: exportText('b') });
  });

  it('owner unmount before the read settles (resolve and reject): no handler, cancelled, not busy', async () => {
    for (const outcome of ['resolve', 'reject'] as const) {
      state().reset();
      const reader = renderHook(() => useLibraryReader({ items: [], loading: false, uid: 'A' }));
      const onImport = vi.fn();
      const { file, resolve, reject } = deferredFile();
      const run = readImportFile(file, onImport);
      reader.unmount();
      if (outcome === 'resolve') resolve(exportText('a')); else reject(new Error('read failed'));
      await run;
      expect(onImport).not.toHaveBeenCalled();
      expect(state()).toMatchObject({ phase: 'cancelled', writesMayHaveStarted: false, text: null });
      expect(state().busy()).toBe(false);
    }
  });

  it('carries the ORIGINAL token through the controller contract into the guarded save', async () => {
    const id = controllable('A');
    unregister = registerLibraryIdentity(id.binding);
    const saveItems = vi.fn(async (_items: Record<string, Item>, _guard?: unknown) => {});
    const onItemsAdded = vi.fn();
    const handler = (text: string, ctx?: ImportFileContext) =>
      runImport(text, { identity: id.binding, token: ctx?.token, existingIds: [], saveItems, onItemsAdded });
    await readImportFile(fileWith(exportText('a')), handler);
    expect(saveItems).toHaveBeenCalledTimes(1);
    const guard = saveItems.mock.calls[0][1] as { expectedUid: string | null; isCurrent?: () => boolean };
    expect(guard.expectedUid).toBe('A');
    expect(guard.isCurrent?.()).toBe(true);
    id.switchTo('A'); // same uid, new generation: the forwarded predicate follows the token, not the uid
    expect(guard.isCurrent?.()).toBe(false);
    expect(onItemsAdded).toHaveBeenCalledWith(1);
  });

  it('runImport never recaptures: a stale carried token cancels before any save', async () => {
    const id = controllable('A');
    const original = id.binding.current();
    id.switchTo('B');
    id.switchTo('A'); // the live identity is A again, but a newer generation
    const saveItems = vi.fn(async () => {});
    const onItemsAdded = vi.fn();
    await runImport(exportText('a'), { identity: id.binding, token: original, existingIds: [], saveItems, onItemsAdded });
    expect(saveItems).not.toHaveBeenCalled();
    expect(onItemsAdded).not.toHaveBeenCalled();
    expect(state()).toMatchObject({ phase: 'cancelled', writesMayHaveStarted: false, prepared: null, text: null });
  });

  it('without a registered binding: legacy single-argument handler call is unchanged', async () => {
    const onImport = vi.fn();
    await readImportFile(fileWith('{"items":[]}'), onImport);
    expect(onImport).toHaveBeenCalledWith('{"items":[]}');
    expect(onImport.mock.calls[0]).toHaveLength(1);
  });
});

describe('runImport — late ordinary rejection stays inert (IE-C3)', () => {
  const cases: Array<[string, (id: ReturnType<typeof controllable>) => void]> = [
    ['A → B', (id) => id.switchTo('B')],
    ['A → B → A', (id) => { id.switchTo('B'); id.switchTo('A'); }],
  ];
  for (const [label, change] of cases) {
    it(`${label} while the save is pending, then a normal rejection: cancelled, no replay, no retry`, async () => {
      const id = controllable('A');
      const save = deferred<void>();
      const saveItems = vi.fn(() => save.promise);
      const onItemsAdded = vi.fn();
      const run = runImport(exportText('a', 'b'), { identity: id.binding, existingIds: [], saveItems, onItemsAdded });
      await vi.waitFor(() => expect(saveItems).toHaveBeenCalled());
      change(id);
      save.reject(new Error('network'));
      await run;
      expect(state()).toMatchObject({ phase: 'cancelled', writesMayHaveStarted: true, prepared: null, text: null });
      expect(onItemsAdded).not.toHaveBeenCalled();
    });
  }

  it('owner unmount while the save is pending, then a normal rejection: cancelled, no replay', async () => {
    const reader = renderHook(() => useLibraryReader({ items: [], loading: false, uid: 'A' }));
    const binding = reader.result.current.identity;
    const save = deferred<void>();
    const saveItems = vi.fn(() => save.promise);
    const run = runImport(exportText('a'), { identity: binding, existingIds: [], saveItems, onItemsAdded: vi.fn() });
    await vi.waitFor(() => expect(saveItems).toHaveBeenCalled());
    reader.unmount();
    save.reject(new Error('network'));
    await run;
    expect(state()).toMatchObject({ phase: 'cancelled', prepared: null, text: null });
  });

  it('same generation: a normal rejection still offers Try again with the same prepared payload', async () => {
    const id = controllable('A');
    const saveItems = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const deps = { identity: id.binding, existingIds: [] as string[], saveItems, onItemsAdded: vi.fn() };
    await runImport(exportText('a'), deps);
    expect(state().phase).toBe('saveFailed');
    const first = saveItems.mock.calls[0][0];
    await runImport(exportText('a'), deps);
    expect(saveItems.mock.calls[1][0]).toBe(first); // exact item and page ids
    expect(state()).toMatchObject({ phase: 'success', added: 1 });
  });
});
